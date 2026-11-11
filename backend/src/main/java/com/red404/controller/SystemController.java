package com.red404.controller;

import com.red404.dao.DonorDao;
import com.red404.model.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping({"/api/system", "/api/stats"})
public class SystemController {

    private final DonorDao donorDao = new DonorDao();

    @GetMapping({"", "/", "/stats", "/platform-stats"})
    public ResponseEntity<ApiResponse> getStats() {
        try {
            Map<String, Object> stats = donorDao.getPlatformStats();
            return ResponseEntity.ok(new ApiResponse(true, "Platform stats loaded", stats));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ApiResponse(false, e.getMessage()));
        }
    }
}

