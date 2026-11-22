package com.red404.service;

import com.red404.config.EnvConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * RateLimitService
 *
 * Part 8: Scale & Cost Control.
 * Distributed rate-limiting and realtime event fan-out:
 * - If REDIS_URL or REDIS_HOST is configured, communicates with Redis via standard RESP.
 * - If Redis is unavailable or unconfigured, falls back seamlessly to an in-memory
 *   concurrent sliding-window limiter without interrupting service.
 */
@Service
public class RateLimitService {

    private static final Logger log = LoggerFactory.getLogger(RateLimitService.class);

    // In-Memory sliding-window storage fallback
    private static final Map<String, WindowCounter> IN_MEMORY_LIMITS = new ConcurrentHashMap<>();

    private static class WindowCounter {
        long windowStart;
        final AtomicInteger count = new AtomicInteger(0);

        WindowCounter(long windowStart) {
            this.windowStart = windowStart;
        }
    }

    public static class RateLimitResult {
        public final boolean allowed;
        public final int limit;
        public final int remaining;
        public final long retryAfterSeconds;

        public RateLimitResult(boolean allowed, int limit, int remaining, long retryAfterSeconds) {
            this.allowed = allowed;
            this.limit = limit;
            this.remaining = Math.max(0, remaining);
            this.retryAfterSeconds = Math.max(0, retryAfterSeconds);
        }
    }

    /**
     * Checks if a request is allowed under the given key, limit, and window.
     *
     * @param key           e.g., "auth:192.168.1.1" or "dispatch:hosp_1"
     * @param maxRequests   maximum allowed requests in window
     * @param windowSeconds window duration in seconds
     * @return RateLimitResult with remaining tokens and retry-after
     */
    public RateLimitResult checkLimit(String key, int maxRequests, int windowSeconds) {
        String redisHost = EnvConfig.get("REDIS_HOST");
        String redisUrl = EnvConfig.get("REDIS_URL");

        if ((redisHost != null && !redisHost.isBlank()) || (redisUrl != null && !redisUrl.isBlank())) {
            try {
                return checkRedisLimit(key, maxRequests, windowSeconds);
            } catch (Exception e) {
                log.warn("Redis rate-limiter unavailable (falling back to in-memory): {}", e.getMessage());
            }
        }

        return checkInMemoryLimit(key, maxRequests, windowSeconds);
    }

    /**
     * Checks if a limit has been exceeded WITHOUT incrementing the counter.
     */
    public boolean isExceeded(String key, int maxRequests, int windowSeconds) {
        long now = System.currentTimeMillis();
        long windowMs = windowSeconds * 1000L;
        WindowCounter counter = IN_MEMORY_LIMITS.get(key);
        if (counter == null || (now - counter.windowStart) > windowMs) {
            return false;
        }
        return counter.count.get() >= maxRequests;
    }

    /**
     * Resets a rate limit counter (e.g. after a successful login).
     */
    public void resetLimit(String key) {
        IN_MEMORY_LIMITS.remove(key);
    }

    /**
     * Resets all rate limits (maintenance / lockout recovery).
     */
    public void resetAllLimits() {
        IN_MEMORY_LIMITS.clear();
    }

    private RateLimitResult checkInMemoryLimit(String key, int maxRequests, int windowSeconds) {
        long now = System.currentTimeMillis();
        long windowMs = windowSeconds * 1000L;

        WindowCounter counter = IN_MEMORY_LIMITS.compute(key, (k, existing) -> {
            if (existing == null || (now - existing.windowStart) > windowMs) {
                WindowCounter fresh = new WindowCounter(now);
                fresh.count.set(1);
                return fresh;
            } else {
                existing.count.incrementAndGet();
                return existing;
            }
        });

        int current = counter.count.get();
        long elapsed = now - counter.windowStart;
        long retryAfter = Math.max(1, (windowMs - elapsed) / 1000L);

        if (current > maxRequests) {
            return new RateLimitResult(false, maxRequests, 0, retryAfter);
        } else {
            return new RateLimitResult(true, maxRequests, maxRequests - current, 0);
        }
    }

    /**
     * Minimal native RESP check: sends INCR and EXPIRE to Redis if configured.
     */
    private RateLimitResult checkRedisLimit(String key, int maxRequests, int windowSeconds) throws Exception {
        String host = EnvConfig.get("REDIS_HOST", "127.0.0.1");
        int port = 6379;
        try {
            port = Integer.parseInt(EnvConfig.get("REDIS_PORT", "6379"));
        } catch (Exception ignored) {}

        try (Socket socket = new Socket(host, port)) {
            socket.setSoTimeout(1000);
            OutputStream out = socket.getOutputStream();
            BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));

            // Optional AUTH
            String password = EnvConfig.get("REDIS_PASSWORD");
            if (password != null && !password.isBlank()) {
                out.write(("AUTH " + password + "\r\n").getBytes(StandardCharsets.UTF_8));
                out.flush();
                in.readLine();
            }

            // INCR
            out.write(("INCR red404:" + key + "\r\n").getBytes(StandardCharsets.UTF_8));
            // EXPIRE
            out.write(("EXPIRE red404:" + key + " " + windowSeconds + "\r\n").getBytes(StandardCharsets.UTF_8));
            out.flush();

            String incrResp = in.readLine();
            int current = 1;
            if (incrResp != null && incrResp.startsWith(":")) {
                current = Integer.parseInt(incrResp.substring(1).trim());
            }
            in.readLine(); // consume EXPIRE response

            if (current > maxRequests) {
                return new RateLimitResult(false, maxRequests, 0, windowSeconds);
            } else {
                return new RateLimitResult(true, maxRequests, maxRequests - current, 0);
            }
        }
    }

    /**
     * Publish an event to the Redis distributed pub/sub bus (if Redis active).
     */
    public void publishEvent(String channel, String message) {
        String redisHost = EnvConfig.get("REDIS_HOST");
        if (redisHost == null || redisHost.isBlank()) return;

        try {
            int port = Integer.parseInt(EnvConfig.get("REDIS_PORT", "6379"));
            try (Socket socket = new Socket(redisHost, port)) {
                socket.setSoTimeout(1000);
                OutputStream out = socket.getOutputStream();
                String cmd = "PUBLISH " + channel + " " + message.replace("\r", "").replace("\n", " ") + "\r\n";
                out.write(cmd.getBytes(StandardCharsets.UTF_8));
                out.flush();
            }
        } catch (Exception e) {
            log.warn("Notice publishing event to Redis channel {}: {}", channel, e.getMessage());
        }
    }

    /**
     * Clean up expired in-memory counters periodically to prevent memory bloat.
     */
    public void cleanExpiredCounters() {
        long now = System.currentTimeMillis();
        IN_MEMORY_LIMITS.entrySet().removeIf(entry -> (now - entry.getValue().windowStart) > 3600000L); // 1 hr idle
    }
}
