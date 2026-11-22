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
import java.util.regex.Pattern;

/**
 * HospitalAssistantChatService
 *
 * Implements Part 3: AI Chat for the Hospital Portal using Anthropic tool use.
 *
 * STRICT CONSTRAINTS:
 * 1. Read-only assistant: no send, broadcast, cancel, stock edit, or mutation tools.
 * 2. Hospital ID is taken STRICTLY from the authenticated server session, never from request or model.
 * 3. Never logs or transmits donor personal data, phone numbers, coordinates, patient references or raw chat text.
 * 4. Fallback when ANTHROPIC_API_KEY is not set: friendly disabled response without crashing or 500 error.
 * 5. Mandatory doctor disclaimer at the end of every response.
 */
@Service
public class HospitalAssistantChatService {

    private static final Logger log = LoggerFactory.getLogger(HospitalAssistantChatService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
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

    @Autowired
    private HospitalAssistantService assistantService;

    @Autowired
    private RateLimitService rateLimitService;

    /**
     * Checks if AI chat is configured via ANTHROPIC_API_KEY.
     */
    public boolean isConfigured() {
        String apiKey = EnvConfig.get("ANTHROPIC_API_KEY");
        return apiKey != null && !apiKey.trim().isBlank() && !apiKey.trim().startsWith("your_");
    }

    public String getModelName() {
        return EnvConfig.get("ANTHROPIC_MODEL", "claude-3-haiku-20240307");
    }

    public int getMaxTokens() {
        return EnvConfig.getAsInt("ASSISTANT_MAX_TOKENS", 400);
    }

    public int getDailyLimitPerHospital() {
        return EnvConfig.getAsInt("ASSISTANT_DAILY_LIMIT_PER_HOSPITAL", 200);
    }

    public int getRatePerUserPerHour() {
        return EnvConfig.getAsInt("ASSISTANT_RATE_PER_USER_PER_HOUR", 30);
    }

    public int getMonthlyBudgetCalls() {
        return EnvConfig.getAsInt("ASSISTANT_MONTHLY_BUDGET_CALLS", 5000);
    }

    /**
     * Chat response wrapper.
     */
    public static class ChatResult {
        public final boolean success;
        public final boolean configured;
        public final String reply;
        public final List<Map<String, Object>> toolCalls;
        public final String error;
        public final String errorCode;

        public ChatResult(boolean success, boolean configured, String reply, List<Map<String, Object>> toolCalls, String error, String errorCode) {
            this.success = success;
            this.configured = configured;
            this.reply = reply;
            this.toolCalls = toolCalls != null ? toolCalls : Collections.emptyList();
            this.error = error;
            this.errorCode = errorCode;
        }

        public static ChatResult notConfigured() {
            return new ChatResult(
                    true,
                    false,
                    "AI chat is not configured. Use the Quick Check panel on your dashboard for instant availability answers.",
                    Collections.emptyList(),
                    null,
                    null
            );
        }

        public static ChatResult rateLimited(String message) {
            return new ChatResult(false, true, null, Collections.emptyList(), message, "rate_limited");
        }

        public static ChatResult budgetExceeded(String message) {
            return new ChatResult(false, true, null, Collections.emptyList(), message, "budget_exceeded");
        }

        public static ChatResult failure(String error, String code) {
            return new ChatResult(false, true, null, Collections.emptyList(), error, code);
        }
    }

    /**
     * Sanitizes user message to prevent leaking PII.
     */
    private String sanitizeUserMessage(String message) {
        if (message == null) return "";
        String clean = PHONE_PATTERN.matcher(message).replaceAll("[PHONE_REDACTED]");
        clean = EMAIL_PATTERN.matcher(clean).replaceAll("[EMAIL_REDACTED]");
        return clean.trim();
    }

    /**
     * Builds Anthropic tool definitions for the 4 read-only tools.
     */
    private ArrayNode buildAnthropicTools() {
        ArrayNode tools = MAPPER.createArrayNode();

        // 1. donor_availability
        ObjectNode t1 = MAPPER.createObjectNode();
        t1.put("name", "donor_availability");
        t1.put("description", "Checks aggregate counts of eligible blood donors in a radius (1-20 km) for a blood group, including exact/compatible breakdown and distance bands. Returns aggregates only.");
        ObjectNode s1 = MAPPER.createObjectNode();
        s1.put("type", "object");
        ObjectNode p1 = MAPPER.createObjectNode();
        p1.set("blood_group", MAPPER.createObjectNode().put("type", "string").put("description", "Blood group, e.g. O+, O-, A+, A-, B+, B-, AB+, AB-"));
        p1.set("radius_km", MAPPER.createObjectNode().put("type", "number").put("description", "Search radius in km between 1 and 20 (default 10)"));
        p1.set("include_compatible", MAPPER.createObjectNode().put("type", "boolean").put("description", "Whether to include compatible groups (default true)"));
        s1.set("properties", p1);
        ArrayNode req1 = MAPPER.createArrayNode();
        req1.add("blood_group");
        s1.set("required", req1);
        t1.set("input_schema", s1);
        tools.add(t1);

        // 2. get_stock
        ObjectNode t2 = MAPPER.createObjectNode();
        t2.put("name", "get_stock");
        t2.put("description", "Retrieves this hospital's current blood inventory units across all 8 blood groups with Critical/Low/OK status and last updated timestamp.");
        ObjectNode s2 = MAPPER.createObjectNode();
        s2.put("type", "object");
        s2.set("properties", MAPPER.createObjectNode());
        t2.set("input_schema", s2);
        tools.add(t2);

        // 3. active_requests
        ObjectNode t3 = MAPPER.createObjectNode();
        t3.put("name", "active_requests");
        t3.put("description", "Retrieves this hospital's active blood requests with status, urgency, units, and response counts.");
        ObjectNode s3 = MAPPER.createObjectNode();
        s3.put("type", "object");
        s3.set("properties", MAPPER.createObjectNode());
        t3.set("input_schema", s3);
        tools.add(t3);

        // 4. prepare_search
        ObjectNode t4 = MAPPER.createObjectNode();
        t4.put("name", "prepare_search");
        t4.put("description", "Prepares a prefill payload for hospital staff to open in Find Donors form. It sends nothing.");
        ObjectNode s4 = MAPPER.createObjectNode();
        s4.put("type", "object");
        ObjectNode p4 = MAPPER.createObjectNode();
        p4.set("blood_group", MAPPER.createObjectNode().put("type", "string").put("description", "Blood group to prefill"));
        p4.set("radius_km", MAPPER.createObjectNode().put("type", "number").put("description", "Search radius (1-20 km)"));
        p4.set("include_compatible", MAPPER.createObjectNode().put("type", "boolean").put("description", "Include compatible groups"));
        p4.set("units", MAPPER.createObjectNode().put("type", "number").put("description", "Units needed"));
        p4.set("urgency", MAPPER.createObjectNode().put("type", "string").put("description", "Urgency level"));
        s4.set("properties", p4);
        ArrayNode req4 = MAPPER.createArrayNode();
        req4.add("blood_group");
        s4.set("required", req4);
        t4.set("input_schema", s4);
        tools.add(t4);

        return tools;
    }

    /**
     * Executes an authorized read-only tool using the verified hospitalId from the session.
     */
    private Map<String, Object> executeTool(int hospitalId, String userIdentifier, String toolName, JsonNode input) throws Exception {
        // Enforce strict read-only validation
        assistantService.validateReadOnlyTool(toolName);

        String clean = toolName.trim().toLowerCase();
        Map<String, Object> output;

        if ("donor_availability".equals(clean)) {
            String bg = input.has("blood_group") ? input.get("blood_group").asText() : (input.has("bloodGroup") ? input.get("bloodGroup").asText() : "O+");
            double rad = input.has("radius_km") ? input.get("radius_km").asDouble() : (input.has("radiusKm") ? input.get("radiusKm").asDouble() : 10.0);
            boolean inc = !input.has("include_compatible") || input.get("include_compatible").asBoolean();

            output = assistantService.donorAvailability(hospitalId, bg, rad, inc);
            assistantService.recordToolAudit(hospitalId, userIdentifier, "donor_availability",
                    Map.of("blood_group", bg, "radius_km", rad),
                    Map.of("totalEligible", output.getOrDefault("totalEligible", 0)));

        } else if ("get_stock".equals(clean)) {
            output = assistantService.getStock(hospitalId);
            assistantService.recordToolAudit(hospitalId, userIdentifier, "get_stock",
                    Map.of(), Map.of("groupCount", 8));

        } else if ("active_requests".equals(clean)) {
            output = assistantService.activeRequests(hospitalId);
            assistantService.recordToolAudit(hospitalId, userIdentifier, "active_requests",
                    Map.of(), Map.of("count", output.getOrDefault("count", 0)));

        } else if ("prepare_search".equals(clean)) {
            String bg = input.has("blood_group") ? input.get("blood_group").asText() : "O+";
            int rad = input.has("radius_km") ? input.get("radius_km").asInt() : 10;
            boolean inc = !input.has("include_compatible") || input.get("include_compatible").asBoolean();
            int u = input.has("units") ? input.get("units").asInt() : 1;
            String urg = input.has("urgency") ? input.get("urgency").asText() : "NORMAL";
            int needed = input.has("needed_within_minutes") ? input.get("needed_within_minutes").asInt() : 60;

            output = assistantService.prepareSearch(bg, rad, inc, u, urg, needed);
            assistantService.recordToolAudit(hospitalId, userIdentifier, "prepare_search",
                    Map.of("blood_group", bg, "radius_km", rad), Map.of());

        } else {
            throw new IllegalArgumentException("Unknown assistant tool: " + toolName);
        }

        return output;
    }

    /**
     * Processes a chat query with tool use via the Anthropic API.
     */
    public ChatResult processChat(int hospitalId, String userIdentifier, String userMessage, List<Map<String, Object>> browserHistory) {
        if (!isConfigured()) {
            return ChatResult.notConfigured();
        }

        // 1. Rate Limits & Budget Checks
        int ratePerHour = getRatePerUserPerHour();
        RateLimitService.RateLimitResult userRl = rateLimitService.checkLimit("asst_chat_u:" + userIdentifier, ratePerHour, 3600);
        if (!userRl.allowed) {
            return ChatResult.rateLimited("Hourly chat limit reached (max " + ratePerHour + "/hour). Please wait or use Quick Check.");
        }

        int dailyHospLimit = getDailyLimitPerHospital();
        RateLimitService.RateLimitResult hospRl = rateLimitService.checkLimit("asst_chat_h:" + hospitalId, dailyHospLimit, 86400);
        if (!hospRl.allowed) {
            return ChatResult.rateLimited("Hospital daily assistant limit reached (max " + dailyHospLimit + "/day). Please use Quick Check.");
        }

        int monthlyBudget = getMonthlyBudgetCalls();
        String currentMonthKey = YearMonth.now().toString();
        RateLimitService.RateLimitResult budgetRl = rateLimitService.checkLimit("asst_chat_m:" + currentMonthKey, monthlyBudget, 31 * 86400);
        if (!budgetRl.allowed) {
            return ChatResult.budgetExceeded("Monthly assistant budget limit reached. Please use the Quick Check panel on your dashboard.");
        }

        String apiKey = EnvConfig.get("ANTHROPIC_API_KEY");
        String model = getModelName();
        int maxTokens = getMaxTokens();

        String sanitizedMsg = sanitizeUserMessage(userMessage);
        if (sanitizedMsg.isBlank()) {
            return ChatResult.failure("User message cannot be empty.", "invalid_message");
        }

        try {
            // Build messages array
            ArrayNode messages = MAPPER.createArrayNode();

            // Append sanitized browser history if provided (only user and assistant roles)
            if (browserHistory != null) {
                for (Map<String, Object> hist : browserHistory) {
                    String role = (String) hist.get("role");
                    String content = (String) hist.get("content");
                    if (role != null && content != null && ("user".equals(role) || "assistant".equals(role))) {
                        ObjectNode msgNode = MAPPER.createObjectNode();
                        msgNode.put("role", role);
                        msgNode.put("content", sanitizeUserMessage(content));
                        messages.add(msgNode);
                    }
                }
            }

            // Append latest user message
            ObjectNode latestUserMsg = MAPPER.createObjectNode();
            latestUserMsg.put("role", "user");
            latestUserMsg.put("content", sanitizedMsg);
            messages.add(latestUserMsg);

            // First API Call (User Prompt -> Tool Selection)
            ObjectNode requestPayload = MAPPER.createObjectNode();
            requestPayload.put("model", model);
            requestPayload.put("max_tokens", maxTokens);
            requestPayload.put("system", SYSTEM_PROMPT);
            requestPayload.set("tools", buildAnthropicTools());
            requestPayload.set("messages", messages);

            JsonNode response1 = callAnthropicApi(apiKey, requestPayload);
            String stopReason = response1.has("stop_reason") ? response1.get("stop_reason").asText() : "";

            List<Map<String, Object>> recordedToolCalls = new ArrayList<>();

            // If model wants to invoke tools
            if ("tool_use".equals(stopReason)) {
                JsonNode contentArr = response1.get("content");

                // Assistant response with tool_use block
                ObjectNode asstMsg = MAPPER.createObjectNode();
                asstMsg.put("role", "assistant");
                asstMsg.set("content", contentArr);
                messages.add(asstMsg);

                // User response containing tool_result blocks
                ObjectNode toolResultMsg = MAPPER.createObjectNode();
                toolResultMsg.put("role", "user");
                ArrayNode toolResultContents = MAPPER.createArrayNode();

                for (JsonNode c : contentArr) {
                    if ("tool_use".equals(c.path("type").asText())) {
                        String toolUseId = c.path("id").asText();
                        String toolName = c.path("name").asText();
                        JsonNode toolInput = c.path("input");

                        Map<String, Object> toolOutput = executeTool(hospitalId, userIdentifier, toolName, toolInput);
                        recordedToolCalls.add(Map.of(
                                "tool", toolName,
                                "input", toolInput,
                                "result", toolOutput
                        ));

                        ObjectNode resultBlock = MAPPER.createObjectNode();
                        resultBlock.put("type", "tool_result");
                        resultBlock.put("tool_use_id", toolUseId);
                        resultBlock.put("content", MAPPER.writeValueAsString(toolOutput));
                        toolResultContents.add(resultBlock);
                    }
                }

                toolResultMsg.set("content", toolResultContents);
                messages.add(toolResultMsg);

                // Second API Call (Tool Result -> Final Response)
                ObjectNode requestPayload2 = MAPPER.createObjectNode();
                requestPayload2.put("model", model);
                requestPayload2.put("max_tokens", maxTokens);
                requestPayload2.put("system", SYSTEM_PROMPT);
                requestPayload2.set("tools", buildAnthropicTools());
                requestPayload2.set("messages", messages);

                JsonNode response2 = callAnthropicApi(apiKey, requestPayload2);
                String finalReply = extractTextContent(response2);
                finalReply = ensureDisclaimer(finalReply);

                return new ChatResult(true, true, finalReply, recordedToolCalls, null, null);
            } else {
                // Direct response without tool calls
                String directReply = extractTextContent(response1);
                directReply = ensureDisclaimer(directReply);
                return new ChatResult(true, true, directReply, recordedToolCalls, null, null);
            }

        } catch (Exception e) {
            log.error("Anthropic Assistant API error: {}", e.getMessage(), e);
            return ChatResult.failure("Assistant request failed: " + e.getMessage(), "anthropic_api_error");
        }
    }

    private JsonNode callAnthropicApi(String apiKey, ObjectNode payload) throws Exception {
        String bodyString = MAPPER.writeValueAsString(payload);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.anthropic.com/v1/messages"))
                .header("Content-Type", "application/json")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .POST(HttpRequest.BodyPublishers.ofString(bodyString))
                .timeout(Duration.ofSeconds(20))
                .build();

        HttpResponse<String> resp = HTTP_CLIENT.send(req, HttpResponse.BodyHandlers.ofString());

        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            log.error("Anthropic API returned status {}: {}", resp.statusCode(), resp.body());
            throw new RuntimeException("Anthropic API returned status " + resp.statusCode());
        }

        return MAPPER.readTree(resp.body());
    }

    private String extractTextContent(JsonNode responseNode) {
        if (responseNode == null || !responseNode.has("content")) return "";
        StringBuilder sb = new StringBuilder();
        for (JsonNode c : responseNode.get("content")) {
            if ("text".equals(c.path("type").asText())) {
                sb.append(c.path("text").asText()).append("\n");
            }
        }
        return sb.toString().trim();
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
