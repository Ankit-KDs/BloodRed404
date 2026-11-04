package com.red404.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.red404.model.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.Date;

public final class JsonUtil {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private JsonUtil() {}

    public static ObjectMapper mapper() {
        return MAPPER;
    }

    public static JsonNode readBody(HttpServletRequest request) throws IOException {
        return MAPPER.readTree(request.getInputStream());
    }

    public static void write(HttpServletResponse response, int status, ApiResponse body) throws IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setStatus(status);
        MAPPER.writeValue(response.getWriter(), body);
    }

    public static void ok(HttpServletResponse response, String message, Object data) throws IOException {
        write(response, HttpServletResponse.SC_OK, new ApiResponse(true, message, data));
    }

    public static void created(HttpServletResponse response, String message, Object data) throws IOException {
        write(response, HttpServletResponse.SC_CREATED, new ApiResponse(true, message, data));
    }

    public static void error(HttpServletResponse response, int status, String message) throws IOException {
        write(response, status, new ApiResponse(false, message));
    }

    public static String text(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) {
            return "";
        }
        String value = node.get(field).asText();
        return "null".equalsIgnoreCase(value) ? "" : value.trim();
    }

    public static String textOrNull(JsonNode node, String field) {
        String value = text(node, field);
        return value.isEmpty() ? null : value;
    }

    public static Double asDouble(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) {
            return null;
        }
        JsonNode value = node.get(field);
        try {
            if (value.isNumber()) {
                return value.asDouble();
            }
            String raw = value.asText();
            if (raw == null || raw.isBlank() || "null".equalsIgnoreCase(raw)) {
                return null;
            }
            return Double.parseDouble(raw);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static Integer asInt(JsonNode node, String field, int fallback) {
        if (node == null || !node.has(field) || node.get(field).isNull()) {
            return fallback;
        }
        JsonNode value = node.get(field);
        if (value.isNumber()) {
            return value.asInt();
        }
        try {
            return Integer.parseInt(value.asText());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    public static boolean asBoolean(JsonNode node, String field, boolean fallback) {
        if (node == null || !node.has(field) || node.get(field).isNull()) {
            return fallback;
        }
        return node.get(field).asBoolean(fallback);
    }

    public static Date asDate(JsonNode node, String field) {
        String raw = textOrNull(node, field);
        if (raw == null) {
            return null;
        }
        try {
            return Date.valueOf(raw);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static String path(HttpServletRequest request) {
        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isBlank()) {
            return "/";
        }
        return pathInfo;
    }
}
