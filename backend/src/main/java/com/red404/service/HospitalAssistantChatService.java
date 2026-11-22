package com.red404.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.red404.config.EnvConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.YearMonth;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * HospitalAssistantChatService
 *
 * Provides emergency blood availability assistance for hospital staff.
 * Supports Google Gemini (GEMINI_API_KEY), Groq (GROQ_API_KEY),
 * and a high-speed deterministic fallback engine with sub-second response times.
 *
 * Highlights donor acceptance accuracy and fast-response metrics,
 * and attaches direct "Send Request" ready donor cards.
 */
@Service
public class HospitalAssistantChatService {

    private static final Logger log = LoggerFactory.getLogger(HospitalAssistantChatService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public static final String SYSTEM_PROMPT =
            "You are RED404's emergency blood assistant for hospital staff. " +
            "Answer urgent availability and compatibility questions concisely in the user's language (default English; Hindi and Hinglish supported). " +
            "Always use tools for donor counts and stock; never guess or make up numbers. " +
            "You cannot send requests, notify donors, broadcast, edit stock, or perform any action - tell staff to use the buttons on their dashboard. " +
            "End every answer with: 'Counts are estimates. A doctor makes the final decision.'";

    public static final String MANDATORY_DISCLAIMER = "Counts are estimates. A doctor makes the final decision.";

    private static final Pattern PHONE_PATTERN = Pattern.compile("\\b[6-9]\\d{9}\\b");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");

    private static final Pattern BLOOD_GROUP_PATTERN = Pattern.compile("(?:^|\\b)(AB|A|B|O)\\s*([+\\-])(?=[^a-zA-Z0-9]|$)", Pattern.CASE_INSENSITIVE);
    private static final Pattern BLOOD_WORD_PATTERN = Pattern.compile("\\b(AB|A|B|O)\\s+(POSITIVE|NEGATIVE|POS|NEG)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern RADIUS_PATTERN = Pattern.compile("\\b(\\d{1,2})\\s*(?:km|kms|k\\.m\\.)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern UNITS_PATTERN = Pattern.compile("\\b(\\d{1,2})\\s*(?:unit|units|bottle|bottles|packet|packets)\\b", Pattern.CASE_INSENSITIVE);

    @Autowired
    private HospitalAssistantService assistantService;

    @Autowired
    private RateLimitService rateLimitService;

    /**
     * Checks if external LLM or assistant is configured.
     * Assistant is always active thanks to the built-in deterministic engine.
     */
    public boolean isConfigured() {
        return true;
    }

    public boolean hasLlmKey() {
        return hasGeminiKey() || hasGroqKey() || hasAnthropicKey();
    }

    public boolean hasGeminiKey() {
        String key = EnvConfig.get("GEMINI_API_KEY");
        return key != null && !key.trim().isBlank() && !key.trim().startsWith("your_");
    }

    public boolean hasGroqKey() {
        String key = EnvConfig.get("GROQ_API_KEY");
        return key != null && !key.trim().isBlank() && !key.trim().startsWith("your_");
    }

    public boolean hasAnthropicKey() {
        String key = EnvConfig.get("ANTHROPIC_API_KEY");
        return key != null && !key.trim().isBlank() && !key.trim().startsWith("your_");
    }

    public String getActiveModelInfo() {
        if (hasGroqKey()) {
            return "Groq (" + EnvConfig.get("GROQ_MODEL", "llama-3.1-8b-instant") + ")";
        }
        if (hasGeminiKey()) {
            return "Google Gemini (" + EnvConfig.get("GEMINI_MODEL", "gemini-1.5-flash") + ")";
        }
        if (hasAnthropicKey()) {
            return "Anthropic (" + EnvConfig.get("ANTHROPIC_MODEL", "claude-3-haiku-20240307") + ")";
        }
        return "Deterministic Emergency Engine (Sub-second)";
    }

    public String getModelName() {
        return getActiveModelInfo();
    }

    public int getMaxTokens() {
        return EnvConfig.getAsInt("ASSISTANT_MAX_TOKENS", 400);
    }

    public int getDailyLimitPerHospital() {
        return EnvConfig.getAsInt("ASSISTANT_DAILY_LIMIT_PER_HOSPITAL", 300);
    }

    public int getRatePerUserPerHour() {
        return EnvConfig.getAsInt("ASSISTANT_RATE_PER_USER_PER_HOUR", 60);
    }

    public int getMonthlyBudgetCalls() {
        return EnvConfig.getAsInt("ASSISTANT_MONTHLY_BUDGET_CALLS", 10000);
    }

    /**
     * Chat response wrapper.
     */
    public static class ChatResult {
        public final boolean success;
        public final boolean configured;
        public final String reply;
        public final List<Map<String, Object>> donors;
        public final List<Map<String, Object>> toolCalls;
        public final String error;
        public final String errorCode;

        public ChatResult(boolean success, boolean configured, String reply, List<Map<String, Object>> donors, List<Map<String, Object>> toolCalls, String error, String errorCode) {
            this.success = success;
            this.configured = configured;
            this.reply = reply;
            this.donors = donors != null ? donors : Collections.emptyList();
            this.toolCalls = toolCalls != null ? toolCalls : Collections.emptyList();
            this.error = error;
            this.errorCode = errorCode;
        }

        public static ChatResult notConfigured() {
            return new ChatResult(
                    true,
                    true,
                    "RED404 Assistant is active and ready. Ask for donor availability or stock anytime.\n\n" + MANDATORY_DISCLAIMER,
                    Collections.emptyList(),
                    Collections.emptyList(),
                    null,
                    null
            );
        }

        public static ChatResult rateLimited(String message) {
            return new ChatResult(false, true, null, Collections.emptyList(), Collections.emptyList(), message, "rate_limited");
        }

        public static ChatResult budgetExceeded(String message) {
            return new ChatResult(false, true, null, Collections.emptyList(), Collections.emptyList(), message, "budget_exceeded");
        }

        public static ChatResult failure(String error, String code) {
            return new ChatResult(false, true, null, Collections.emptyList(), Collections.emptyList(), error, code);
        }
    }

    private String sanitizeUserMessage(String message) {
        if (message == null) return "";
        String clean = PHONE_PATTERN.matcher(message).replaceAll("[PHONE_REDACTED]");
        clean = EMAIL_PATTERN.matcher(clean).replaceAll("[EMAIL_REDACTED]");
        return clean.trim();
    }

    /**
     * Extracts blood group from user text (e.g. "A-", "O+", "AB POSITIVE").
     */
    public static String extractBloodGroup(String text) {
        if (text == null) return null;
        Matcher m = BLOOD_GROUP_PATTERN.matcher(text);
        if (m.find()) {
            return m.group(1).toUpperCase() + m.group(2);
        }
        Matcher mW = BLOOD_WORD_PATTERN.matcher(text);
        if (mW.find()) {
            String grp = mW.group(1).toUpperCase();
            String sign = mW.group(2).toUpperCase().startsWith("POS") ? "+" : "-";
            return grp + sign;
        }
        return null;
    }

    public static double extractRadius(String text, double defaultRadius) {
        if (text == null) return defaultRadius;
        Matcher m = RADIUS_PATTERN.matcher(text);
        if (m.find()) {
            try {
                int r = Integer.parseInt(m.group(1));
                return Math.max(1, Math.min(20, r));
            } catch (Exception ignored) {}
        }
        return defaultRadius;
    }

    public static int extractUnits(String text, int defaultUnits) {
        if (text == null) return defaultUnits;
        Matcher m = UNITS_PATTERN.matcher(text);
        if (m.find()) {
            try {
                return Math.max(1, Integer.parseInt(m.group(1)));
            } catch (Exception ignored) {}
        }
        return defaultUnits;
    }

    public static String extractUrgency(String text) {
        if (text == null) return "Normal";
        String lower = text.toLowerCase();
        if (lower.contains("urgent") || lower.contains("emergency") || lower.contains("critical") || lower.contains("jaldi") || lower.contains("immediate")) {
            return "Urgent";
        }
        return "Normal";
    }

    /**
     * Processes a chat query with Gemini/Groq LLM or deterministic fallback engine.
     */
    public ChatResult processChat(int hospitalId, String userIdentifier, String userMessage, List<Map<String, Object>> browserHistory) {
        // 1. Rate Limits & Budget Checks
        if (rateLimitService != null) {
            int ratePerHour = getRatePerUserPerHour();
            RateLimitService.RateLimitResult userRl = rateLimitService.checkLimit("asst_chat_u:" + userIdentifier, ratePerHour, 3600);
            if (!userRl.allowed) {
                return ChatResult.rateLimited("Hourly chat limit reached (max " + ratePerHour + "/hour). Please wait a moment.");
            }

            int dailyHospLimit = getDailyLimitPerHospital();
            RateLimitService.RateLimitResult hospRl = rateLimitService.checkLimit("asst_chat_h:" + hospitalId, dailyHospLimit, 86400);
            if (!hospRl.allowed) {
                return ChatResult.rateLimited("Hospital daily assistant limit reached (max " + dailyHospLimit + "/day).");
            }

            int monthlyBudget = getMonthlyBudgetCalls();
            String currentMonthKey = YearMonth.now().toString();
            RateLimitService.RateLimitResult budgetRl = rateLimitService.checkLimit("asst_chat_m:" + currentMonthKey, monthlyBudget, 31 * 86400);
            if (!budgetRl.allowed) {
                return ChatResult.budgetExceeded("Monthly assistant budget limit reached.");
            }
        }

        String sanitizedMsg = sanitizeUserMessage(userMessage);
        if (sanitizedMsg.isBlank()) {
            return ChatResult.failure("User message cannot be empty.", "invalid_message");
        }

        // 2. Extract Intent and Query Parameters
        String bloodGroup = extractBloodGroup(sanitizedMsg);
        double radius = extractRadius(sanitizedMsg, 10.0);
        int units = extractUnits(sanitizedMsg, 1);
        String urgency = extractUrgency(sanitizedMsg);
        boolean includeCompatible = !sanitizedMsg.toLowerCase().contains("exact only") && !sanitizedMsg.toLowerCase().contains("no compatible");

        boolean isStockQuery = sanitizedMsg.toLowerCase().contains("stock") || sanitizedMsg.toLowerCase().contains("inventory");
        boolean isRequestQuery = sanitizedMsg.toLowerCase().contains("active request") || sanitizedMsg.toLowerCase().contains("pending request");

        List<Map<String, Object>> matchingDonors = Collections.emptyList();
        List<Map<String, Object>> recordedToolCalls = new ArrayList<>();
        Map<String, Object> availabilityData = null;
        Map<String, Object> stockData = null;

        // Perform backend searches
        if (bloodGroup != null && assistantService != null) {
            try {
                availabilityData = assistantService.donorAvailability(hospitalId, bloodGroup, radius, includeCompatible);
                recordedToolCalls.add(Map.of(
                        "tool", "donor_availability",
                        "input", Map.of("blood_group", bloodGroup, "radius_km", radius, "include_compatible", includeCompatible),
                        "result", availabilityData
                ));

                // Fetch actual donor cards with acceptance accuracy and response speed
                matchingDonors = assistantService.searchDonorsForAssistant(hospitalId, bloodGroup, radius, includeCompatible);
            } catch (Exception e) {
                log.warn("Error retrieving donor availability in assistant: {}", e.getMessage());
            }
        }

        if (isStockQuery && assistantService != null) {
            try {
                stockData = assistantService.getStock(hospitalId);
                recordedToolCalls.add(Map.of(
                        "tool", "get_stock",
                        "input", Map.of(),
                        "result", stockData
                ));
            } catch (Exception e) {
                log.warn("Error retrieving stock in assistant: {}", e.getMessage());
            }
        }

        // 3. Attempt LLM generation if free API key is configured
        String llmReply = null;
        if (hasLlmKey()) {
            try {
                llmReply = tryCallLlm(sanitizedMsg, availabilityData, stockData);
            } catch (Exception e) {
                log.warn("LLM call timed out or failed (switching to deterministic fallback): {}", e.getMessage());
            }
        }

        // 4. Deterministic fallback if LLM is slow, unconfigured or returned null
        String finalReply;
        if (llmReply != null && !llmReply.isBlank()) {
            finalReply = ensureDisclaimer(llmReply);
        } else {
            finalReply = generateDeterministicReply(sanitizedMsg, bloodGroup, radius, units, urgency, availabilityData, matchingDonors, stockData, isRequestQuery);
        }

        return new ChatResult(true, true, finalReply, matchingDonors, recordedToolCalls, null, null);
    }

    /**
     * Tries calling Groq or Gemini with 5-second fast timeout.
     */
    private String tryCallLlm(String userMsg, Map<String, Object> avail, Map<String, Object> stock) throws Exception {
        String contextStr = "";
        if (avail != null) {
            contextStr += "\n[Live Donor Availability Result]: " + MAPPER.writeValueAsString(avail);
        }
        if (stock != null) {
            contextStr += "\n[Live Blood Stock Result]: " + MAPPER.writeValueAsString(stock);
        }

        String promptWithContext = userMsg;
        if (!contextStr.isBlank()) {
            promptWithContext = userMsg + "\n" + contextStr;
        }

        if (hasGroqKey()) {
            String apiKey = EnvConfig.get("GROQ_API_KEY");
            String model = EnvConfig.get("GROQ_MODEL", "llama-3.1-8b-instant");
            return callGroqApi(apiKey, model, SYSTEM_PROMPT, promptWithContext);
        } else if (hasGeminiKey()) {
            String apiKey = EnvConfig.get("GEMINI_API_KEY");
            String model = EnvConfig.get("GEMINI_MODEL", "gemini-1.5-flash");
            return callGeminiApi(apiKey, model, SYSTEM_PROMPT, promptWithContext);
        }
        return null;
    }

    private String callGroqApi(String apiKey, String model, String systemPrompt, String userMessage) throws Exception {
        ObjectNode payload = MAPPER.createObjectNode();
        payload.put("model", model);
        payload.put("max_tokens", getMaxTokens());
        payload.put("temperature", 0.2);

        ArrayNode messages = MAPPER.createArrayNode();
        messages.add(MAPPER.createObjectNode().put("role", "system").put("content", systemPrompt));
        messages.add(MAPPER.createObjectNode().put("role", "user").put("content", userMessage));
        payload.set("messages", messages);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.groq.com/openai/v1/chat/completions"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(payload)))
                .timeout(Duration.ofSeconds(5))
                .build();

        HttpResponse<String> resp = HTTP_CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() == 200) {
            JsonNode json = MAPPER.readTree(resp.body());
            JsonNode choices = json.path("choices");
            if (choices.isArray() && choices.size() > 0) {
                return choices.get(0).path("message").path("content").asText();
            }
        }
        throw new RuntimeException("Groq API returned HTTP " + resp.statusCode());
    }

    private String callGeminiApi(String apiKey, String model, String systemPrompt, String userMessage) throws Exception {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

        ObjectNode payload = MAPPER.createObjectNode();
        ObjectNode sys = MAPPER.createObjectNode();
        ArrayNode sysParts = MAPPER.createArrayNode();
        sysParts.add(MAPPER.createObjectNode().put("text", systemPrompt));
        sys.set("parts", sysParts);
        payload.set("systemInstruction", sys);

        ArrayNode contents = MAPPER.createArrayNode();
        ObjectNode userMsgNode = MAPPER.createObjectNode();
        userMsgNode.put("role", "user");
        ArrayNode userParts = MAPPER.createArrayNode();
        userParts.add(MAPPER.createObjectNode().put("text", userMessage));
        userMsgNode.set("parts", userParts);
        contents.add(userMsgNode);
        payload.set("contents", contents);

        ObjectNode genConfig = MAPPER.createObjectNode();
        genConfig.put("maxOutputTokens", getMaxTokens());
        genConfig.put("temperature", 0.2);
        payload.set("generationConfig", genConfig);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(payload)))
                .timeout(Duration.ofSeconds(5))
                .build();

        HttpResponse<String> resp = HTTP_CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() == 200) {
            JsonNode json = MAPPER.readTree(resp.body());
            JsonNode candidates = json.path("candidates");
            if (candidates.isArray() && candidates.size() > 0) {
                JsonNode parts = candidates.get(0).path("content").path("parts");
                if (parts.isArray() && parts.size() > 0) {
                    return parts.get(0).path("text").asText();
                }
            }
        }
        throw new RuntimeException("Gemini API returned HTTP " + resp.statusCode());
    }

    /**
     * Deterministic reply generator when LLM is slow or unconfigured.
     */
    private String generateDeterministicReply(
            String userMsg,
            String bloodGroup,
            double radius,
            int units,
            String urgency,
            Map<String, Object> avail,
            List<Map<String, Object>> donors,
            Map<String, Object> stock,
            boolean isRequestQuery) {

        StringBuilder sb = new StringBuilder();

        if (bloodGroup != null && avail != null) {
            int total = ((Number) avail.getOrDefault("totalEligible", donors.size())).intValue();
            int exact = ((Number) avail.getOrDefault("exactGroupCount", 0)).intValue();
            int comp = total - exact;

            if (total > 0) {
                sb.append("Found ").append(total).append(" eligible donor(s) within ").append((int) radius).append(" km for ").append(bloodGroup);
                if (exact > 0 && comp > 0) {
                    sb.append(" (").append(exact).append(" exact match, ").append(comp).append(" compatible).");
                } else if (exact > 0) {
                    sb.append(" (").append(exact).append(" exact match).");
                } else {
                    sb.append(" (0 exact match, ").append(comp).append(" compatible donor(s) available).");
                }
                sb.append("\n\nHigh-accuracy and fast-response donors are prioritized below. You can send emergency requests directly to each donor without leaving this page.");
            } else {
                sb.append("No eligible donors found for ").append(bloodGroup).append(" within ").append((int) radius).append(" km.");
                if (radius < 20.0) {
                    sb.append(" Try expanding your search radius to 20 km to locate more donors.");
                } else {
                    sb.append(" Please review your hospital blood stock or consider planning an emergency donation drive.");
                }
            }
        } else if (stock != null) {
            sb.append("Hospital Blood Stock Status:\n");
            Object groupsObj = stock.get("groups");
            if (groupsObj instanceof List<?>) {
                for (Object g : (List<?>) groupsObj) {
                    if (g instanceof Map<?, ?>) {
                        Map<?, ?> gm = (Map<?, ?>) g;
                        sb.append("• ").append(gm.get("group")).append(": ").append(gm.get("units")).append(" units (").append(gm.get("status")).append(")\n");
                    }
                }
            }
        } else if (isRequestQuery) {
            sb.append("Active emergency blood requests are tracked in real-time. Check the Active Requests tab on your dashboard to review response statuses.");
        } else {
            sb.append("Hello! I am your RED404 Hospital Emergency Assistant.\n\n")
              .append("Ask me about blood availability (e.g., 'blood chahiye A- 10km' or 'compatible donors for AB+'), check current blood stock, or dispatch direct donor requests immediately.");
        }

        return ensureDisclaimer(sb.toString().trim());
    }

    private String ensureDisclaimer(String reply) {
        if (reply == null || reply.isBlank()) {
            return MANDATORY_DISCLAIMER;
        }
        if (!reply.contains("Counts are estimates. A doctor makes the final decision.")) {
            return reply + "\n\n" + MANDATORY_DISCLAIMER;
        }
        return reply;
    }
}
