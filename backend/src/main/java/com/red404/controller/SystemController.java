package com.red404.controller;

import com.red404.dao.DonorDao;
import com.red404.model.ApiResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping({"/api/system", "/api/stats"})
public class SystemController {

    private final DonorDao donorDao = new DonorDao();
    private static final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    @GetMapping({"", "/", "/stats", "/platform-stats"})
    public ResponseEntity<ApiResponse> getStats() {
        try {
            Map<String, Object> stats = donorDao.getPlatformStats();
            return ResponseEntity.ok(new ApiResponse(true, "Platform stats loaded", stats));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @GetMapping({"/national-blood-stock", "/blood-stock", "/inventory-overview"})
    public ResponseEntity<ApiResponse> getNationalBloodStock() {
        try {
            Map<String, Object> stock = donorDao.getNationalBloodStock();
            return ResponseEntity.ok(new ApiResponse(true, "National blood stock loaded", stock));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @GetMapping(value = {"/national-blood-stock/stream", "/blood-stock/stream"}, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamBloodStock() {
        SseEmitter emitter = new SseEmitter(180_000L); // 3 minutes timeout
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));

        // Immediately send initial state
        try {
            Map<String, Object> initial = donorDao.getNationalBloodStock();
            emitter.send(SseEmitter.event().name("stock-update").data(initial));
        } catch (Exception ignored) {}

        return emitter;
    }

    public static void broadcastStockUpdate(Map<String, Object> stockData) {
        if (stockData == null) return;
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("stock-update").data(stockData));
            } catch (Exception e) {
                emitters.remove(emitter);
            }
        }
    }
}

