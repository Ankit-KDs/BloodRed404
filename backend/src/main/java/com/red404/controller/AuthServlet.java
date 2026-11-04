package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.util.JsonUtil;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public class AuthServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        if (path.equals("/check-session")) {
            HttpSession session = request.getSession(false);
            if (session == null) {
                JsonUtil.error(response, HttpServletResponse.SC_UNAUTHORIZED, "No active session");
                return;
            }
            Object user = session.getAttribute("user");
            Object hospital = session.getAttribute("hospitalUser");
            if (user == null && hospital == null) {
                JsonUtil.error(response, HttpServletResponse.SC_UNAUTHORIZED, "No active session");
                return;
            }
            Map<String, Object> data = new HashMap<>();
            data.put("role", session.getAttribute("role"));
            data.put("donor", user);
            data.put("hospital", hospital);
            if (user instanceof Map<?, ?> donor) {
                data.put("donorId", donor.get("id"));
                data.put("name", donor.get("name"));
                data.put("email", donor.get("email"));
            }
            JsonUtil.ok(response, "Session active", data);
            return;
        }
        JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown auth endpoint");
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        if (path.equals("/logout")) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            JsonUtil.ok(response, "Logged out", null);
            return;
        }
        if (path.equals("/forgot-password")) {
            JsonNode body = JsonUtil.readBody(request);
            String email = JsonUtil.text(body, "email");
            JsonUtil.ok(response, "If that email is registered, a reset link will be sent to " + email, null);
            return;
        }
        JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown auth endpoint");
    }
}
