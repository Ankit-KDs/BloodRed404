package com.red404.controller;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@Controller
public class CustomErrorController implements ErrorController {

    @RequestMapping(value = "/error", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> handleErrorHtml(HttpServletRequest request) {
        int statusCode = getStatusCode(request);
        HttpStatus httpStatus = HttpStatus.resolve(statusCode);
        if (httpStatus == null) httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;

        String resourcePath = (statusCode == 404) ? "static/error/404.html" : "static/error/500.html";
        try {
            ClassPathResource res = new ClassPathResource(resourcePath);
            if (res.exists()) {
                try (InputStream in = res.getInputStream()) {
                    String html = StreamUtils.copyToString(in, StandardCharsets.UTF_8);
                    return ResponseEntity.status(httpStatus)
                            .contentType(MediaType.TEXT_HTML)
                            .body(html);
                }
            }
        } catch (Exception ignored) {}

        // Fallback HTML if static file cannot be read
        String fallback = "<!DOCTYPE html><html><head><title>RED404 Error " + statusCode + "</title></head>"
                + "<body style='background:#090a0f;color:#fff;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;'>"
                + "<div style='text-align:center;'><h1>Error " + statusCode + "</h1><p><a href='/' style='color:#e63946;'>Return to Home</a></p></div></body></html>";
        return ResponseEntity.status(httpStatus).contentType(MediaType.TEXT_HTML).body(fallback);
    }

    @RequestMapping(value = "/error")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> handleErrorJson(HttpServletRequest request) {
        int statusCode = getStatusCode(request);
        HttpStatus httpStatus = HttpStatus.resolve(statusCode);
        if (httpStatus == null) httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("status", statusCode);
        body.put("error", httpStatus.getReasonPhrase());
        body.put("message", statusCode == 404 ? "Resource not found" : "Internal server processing error");
        body.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.status(httpStatus).body(body);
    }

    private int getStatusCode(HttpServletRequest request) {
        Object status = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        if (status != null) {
            try {
                return Integer.parseInt(status.toString());
            } catch (Exception ignored) {}
        }
        return 500;
    }
}
