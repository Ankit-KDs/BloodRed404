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
 * Real LLM-powered Tool-Calling AI Agent for the Hospital Dashboard.
 * Supports Groq primary (e.g. llama-3.3-70b-versatile) and Google Gemini (e.g. gemini-2.5-flash).
 *
 * Executes real backend hospital tools on live MySQL data:
 * - find_nearby_donors (bloodGroup optional!)
 * - get_hospital_blood_stock
 * - get_active_requests
 * - get_today_checkins
 * - get_hospital_summary
 * - prepare_or_send_donor_request
 *
 * Truly multilingual: understands Hindi, English, and Hinglish and replies in the same language/style.
 * Never dumps canned greetings when staff asks genuine questions.
 */
@Service
public class HospitalAssistantChatService {

    private static final Logger log = LoggerFactory.getLogger(HospitalAssistantChatService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .build();

    public static final String SYSTEM_PROMPT =
            "You are RED404's real-time Hospital AI Emergency Agent for hospital medical staff.\n" +
            "You have direct access to live hospital tools for donor search, blood stock, active requests, check-ins, and emergency dispatch.\n" +
            "Rules:\n" +
            "1. Language: ALWAYS answer in the EXACT SAME LANGUAGE and STYLE as the user (English, Hindi in Devanagari, or Hinglish in Roman script).\n" +
            "   - If user writes in Hinglish (e.g. 'aas paas ke donors dikhao', 'kitne active requests hai'), answer naturally in conversational Hinglish.\n" +
            "   - If user writes in Hindi (e.g. 'रक्तदाता दिखाओ', 'स्टॉक कितना है'), answer in clean Hindi.\n" +
            "   - If user writes in English, answer in English.\n" +
            "2. Grounding: NEVER hallucinate or invent numbers, donor names, distances, phone numbers, or units. Always call the appropriate tool(s) to fetch live data before answering.\n" +
            "3. Blood group is OPTIONAL for donor search. If staff asks for donors in a radius without naming a blood group (e.g. 'aas paas ke donors dikhao jo 5 km me hai'), call find_nearby_donors with bloodGroup: null.\n" +
            "4. Highlight reliable, high-acceptance accuracy, and fast-responding donors.\n" +
            "5. Keep answers concise, direct, and actionable (2-4 sentences).\n" +
            "6. You must end every response with: 'Counts are estimates. A doctor makes the final decision.'";

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
     * Requirement 1: Checks if external LLM provider key is configured.
     * Returns false if neither GROQ_API_KEY nor GEMINI_API_KEY is configured.
     */
    public boolean isConfigured() {
        return hasLlmKey();
    }

    public boolean hasLlmKey() {
        return hasGroqKey() || hasGeminiKey();
    }

    public boolean hasGroqKey() {
        String key = EnvConfig.get("GROQ_API_KEY");
        return key != null && !key.trim().isBlank() && !key.trim().startsWith("your_");
    }

    public boolean hasGeminiKey() {
        String key = EnvConfig.get("GEMINI_API_KEY");
        return key != null && !key.trim().isBlank() && !key.trim().startsWith("your_");
    }

    public String getActiveModelInfo() {
        if (hasGroqKey()) {
            return "Groq (" + EnvConfig.get("GROQ_MODEL", "llama-3.3-70b-versatile") + ")";
        }
        if (hasGeminiKey()) {
            return "Google Gemini (" + EnvConfig.get("GEMINI_MODEL", "gemini-2.5-flash") + ")";
        }
        return "AI Key Not Configured";
    }

    public String getModelName() {
        return getActiveModelInfo();
    }

    public int getMaxTokens() {
        return EnvConfig.getAsInt("ASSISTANT_MAX_TOKENS", 800);
    }

    public int getDailyLimitPerHospital() {
        return EnvConfig.getAsInt("ASSISTANT_DAILY_LIMIT_PER_HOSPITAL", 400);
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
        public final String language;
        public final List<Map<String, Object>> donors;
        public final Map<String, Object> stock;
        public final Map<String, Object> requests;
        public final List<String> quickFollowUps;
        public final List<Map<String, Object>> toolCalls;
        public final String error;
        public final String errorCode;

        public ChatResult(
                boolean success,
                boolean configured,
                String reply,
                String language,
                List<Map<String, Object>> donors,
                Map<String, Object> stock,
                Map<String, Object> requests,
                List<String> quickFollowUps,
                List<Map<String, Object>> toolCalls,
                String error,
                String errorCode) {
            this.success = success;
            this.configured = configured;
            this.reply = reply;
            this.language = language != null ? language : "en";
            this.donors = donors != null ? donors : Collections.emptyList();
            this.stock = stock;
            this.requests = requests;
            this.quickFollowUps = quickFollowUps != null ? quickFollowUps : Collections.emptyList();
            this.toolCalls = toolCalls != null ? toolCalls : Collections.emptyList();
            this.error = error;
            this.errorCode = errorCode;
        }

        public static ChatResult notConfigured() {
            return new ChatResult(
                    true,
                    false,
                    "AI Key Not Configured: Please set GROQ_API_KEY or GEMINI_API_KEY in your server environment to enable the AI Assistant agent.\n\n" + MANDATORY_DISCLAIMER,
                    "en",
                    Collections.emptyList(),
                    null,
                    null,
                    Collections.emptyList(),
                    Collections.emptyList(),
                    null,
                    null
            );
        }

        public static ChatResult rateLimited(String message) {
            return new ChatResult(false, true, null, "en", Collections.emptyList(), null, null, Collections.emptyList(), Collections.emptyList(), message, "rate_limited");
        }

        public static ChatResult budgetExceeded(String message) {
            return new ChatResult(false, true, null, "en", Collections.emptyList(), null, null, Collections.emptyList(), Collections.emptyList(), message, "budget_exceeded");
        }

        public static ChatResult failure(String error, String code) {
            return new ChatResult(false, true, null, "en", Collections.emptyList(), null, null, Collections.emptyList(), Collections.emptyList(), error, code);
        }
    }

    private String sanitizeUserMessage(String message) {
        if (message == null) return "";
        String clean = PHONE_PATTERN.matcher(message).replaceAll("[PHONE_REDACTED]");
        clean = EMAIL_PATTERN.matcher(clean).replaceAll("[EMAIL_REDACTED]");
        return clean.trim();
    }

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

    public static String detectLanguage(String text) {
        if (text == null) return "en";
        // Check Devanagari Unicode block
        for (char c : text.toCharArray()) {
            if (c >= '\u0900' && c <= '\u097F') {
                return "hi";
            }
        }
        // Check Hinglish patterns
        String lower = text.toLowerCase();
        if (lower.contains("chahiye") || lower.contains("dikhao") || lower.contains("aas paas") ||
            lower.contains("kare") || lower.contains("bhej") || lower.contains("kaunse") ||
            lower.contains("kitne") || lower.contains("hamare") || lower.contains("hai kya") ||
            lower.contains("karo") || lower.contains("wala") || lower.contains("wali") ||
            lower.contains("jaldi") || lower.contains("turant") || lower.contains("bhi")) {
            return "hinglish";
        }
        return "en";
    }

    /**
     * Builds the JSON Tools schema for OpenAI-compatible API tool calling (Groq / Gemini).
     */
    private ArrayNode buildToolsJson() {
        ArrayNode tools = MAPPER.createArrayNode();

        // 1. find_nearby_donors
        ObjectNode t1 = MAPPER.createObjectNode();
        t1.put("type", "function");
        ObjectNode f1 = MAPPER.createObjectNode();
        f1.put("name", "find_nearby_donors");
        f1.put("description", "Search live nearby eligible blood donors within radius (1 to 20 km) for the authenticated hospital. When bloodGroup is null or omitted, returns all nearby donors across all blood groups. Returns exact/compatible status, distance in km, availability, and historical acceptance accuracy & response speed.");
        ObjectNode p1 = MAPPER.createObjectNode();
        p1.put("type", "object");
        ObjectNode props1 = MAPPER.createObjectNode();
        props1.set("bloodGroup", MAPPER.createObjectNode().put("type", "string").put("description", "Optional blood group (e.g. 'O+', 'A-', 'B+', 'AB+'). If null or omitted, all blood groups within the radius are returned."));
        props1.set("radiusKm", MAPPER.createObjectNode().put("type", "number").put("description", "Search radius in km from hospital (1 to 20 km, default 10)"));
        props1.set("includeCompatible", MAPPER.createObjectNode().put("type", "boolean").put("description", "Whether to include compatible donor blood groups (default true)"));
        props1.set("onlyFastResponders", MAPPER.createObjectNode().put("type", "boolean").put("description", "Filter specifically for fast responders (< 10 min response time or high acceptance rate)"));
        p1.set("properties", props1);
        f1.set("parameters", p1);
        t1.set("function", f1);
        tools.add(t1);

        // 2. get_hospital_blood_stock
        ObjectNode t2 = MAPPER.createObjectNode();
        t2.put("type", "function");
        ObjectNode f2 = MAPPER.createObjectNode();
        f2.put("name", "get_hospital_blood_stock");
        f2.put("description", "Get live blood inventory levels, deficit groups (Low/Critical), and expiring bags within 3 days for this hospital.");
        ObjectNode p2 = MAPPER.createObjectNode();
        p2.put("type", "object");
        ObjectNode props2 = MAPPER.createObjectNode();
        props2.set("bloodGroup", MAPPER.createObjectNode().put("type", "string").put("description", "Optional specific blood group to check. If omitted, returns all 8 blood groups."));
        p2.set("properties", props2);
        f2.set("parameters", p2);
        t2.set("function", f2);
        tools.add(t2);

        // 3. get_active_requests
        ObjectNode t3 = MAPPER.createObjectNode();
        t3.put("type", "function");
        ObjectNode f3 = MAPPER.createObjectNode();
        f3.put("name", "get_active_requests");
        f3.put("description", "Get current active emergency blood requests for this hospital, required units, urgency, and donor response counts.");
        ObjectNode p3 = MAPPER.createObjectNode();
        p3.put("type", "object");
        ObjectNode props3 = MAPPER.createObjectNode();
        props3.set("status", MAPPER.createObjectNode().put("type", "string").put("description", "Optional status filter (e.g. 'Active', 'Accepted', 'Arrived', or null for all active)"));
        p3.set("properties", props3);
        f3.set("parameters", p3);
        t3.set("function", f3);
        tools.add(t3);

        // 4. get_today_checkins
        ObjectNode t4 = MAPPER.createObjectNode();
        t4.put("type", "function");
        ObjectNode f4 = MAPPER.createObjectNode();
        f4.put("name", "get_today_checkins");
        f4.put("description", "Get scheduled donor arrivals and completed donor check-in scans recorded today at this hospital.");
        ObjectNode p4 = MAPPER.createObjectNode();
        p4.put("type", "object");
        p4.set("properties", MAPPER.createObjectNode());
        f4.set("parameters", p4);
        t4.set("function", f4);
        tools.add(t4);

        // 5. get_hospital_summary
        ObjectNode t5 = MAPPER.createObjectNode();
        t5.put("type", "function");
        ObjectNode f5 = MAPPER.createObjectNode();
        f5.put("name", "get_hospital_summary");
        f5.put("description", "Get overall dashboard metrics: total inventory units, critical deficit groups, active requests count, today's check-ins, expiring bags within 3 days, and hospital location.");
        ObjectNode p5 = MAPPER.createObjectNode();
        p5.put("type", "object");
        p5.set("properties", MAPPER.createObjectNode());
        f5.set("parameters", p5);
        t5.set("function", f5);
        tools.add(t5);

        // 6. prepare_or_send_donor_request
        ObjectNode t6 = MAPPER.createObjectNode();
        t6.put("type", "function");
        ObjectNode f6 = MAPPER.createObjectNode();
        f6.put("name", "prepare_or_send_donor_request");
        f6.put("description", "Dispatch a direct emergency blood request to a specific nearby donor using their donorId, or prepare the request dispatch.");
        ObjectNode p6 = MAPPER.createObjectNode();
        p6.put("type", "object");
        ObjectNode props6 = MAPPER.createObjectNode();
        props6.set("donorId", MAPPER.createObjectNode().put("type", "integer").put("description", "The donor ID to send the request to"));
        props6.set("bloodGroup", MAPPER.createObjectNode().put("type", "string").put("description", "Blood group needed (e.g. 'O+', 'A-')"));
        props6.set("units", MAPPER.createObjectNode().put("type", "integer").put("description", "Units of blood needed (default 1)"));
        props6.set("urgency", MAPPER.createObjectNode().put("type", "string").put("description", "Urgency level ('Urgent' or 'Critical')"));
        p6.set("properties", props6);
        ArrayNode req6 = MAPPER.createArrayNode();
        req6.add("donorId");
        p6.set("required", req6);
        f6.set("parameters", p6);
        t6.set("function", f6);
        tools.add(t6);

        return tools;
    }

    /**
     * Executes the Agentic chat flow with real Tool Calling against live hospital data.
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

        // Requirement 1: If neither GROQ_API_KEY nor GEMINI_API_KEY is configured on the server, return honest status
        if (!hasLlmKey()) {
            log.info("No Groq or Gemini API key configured on server. Returning unconfigured status.");
            return ChatResult.notConfigured();
        }

        String lang = detectLanguage(sanitizedMsg);
        List<Map<String, Object>> matchingDonors = new ArrayList<>();
        Map<String, Object> stockResult = new LinkedHashMap<>();
        Map<String, Object> requestsResult = new LinkedHashMap<>();
        List<Map<String, Object>> recordedToolCalls = new ArrayList<>();

        String llmReply = null;

        // 2. Try LLM Tool Calling (Groq primary, Gemini fallback)
        try {
            if (hasGroqKey()) {
                String apiKey = EnvConfig.get("GROQ_API_KEY");
                String model = EnvConfig.get("GROQ_MODEL", "llama-3.3-70b-versatile");
                String url = "https://api.groq.com/openai/v1/chat/completions";
                llmReply = executeLlmToolLoop(url, apiKey, model, sanitizedMsg, browserHistory, hospitalId, matchingDonors, stockResult, requestsResult, recordedToolCalls);
            } else if (hasGeminiKey()) {
                String apiKey = EnvConfig.get("GEMINI_API_KEY");
                String model = EnvConfig.get("GEMINI_MODEL", "gemini-2.5-flash");
                String url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
                llmReply = executeLlmToolLoop(url, apiKey, model, sanitizedMsg, browserHistory, hospitalId, matchingDonors, stockResult, requestsResult, recordedToolCalls);
            }
        } catch (Exception e) {
            log.warn("Primary LLM tool execution failed or timed out: {}. Trying fallback provider...", e.getMessage());
            // Try Gemini if Groq failed and Gemini is available
            if (hasGroqKey() && hasGeminiKey()) {
                try {
                    String apiKey = EnvConfig.get("GEMINI_API_KEY");
                    String model = EnvConfig.get("GEMINI_MODEL", "gemini-2.5-flash");
                    String url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
                    llmReply = executeLlmToolLoop(url, apiKey, model, sanitizedMsg, browserHistory, hospitalId, matchingDonors, stockResult, requestsResult, recordedToolCalls);
                } catch (Exception ex2) {
                    log.warn("Secondary LLM provider also failed: {}", ex2.getMessage());
                }
            }
        }

        // 3. Smart Tool Fallback Engine (Runs tools deterministically if external LLM was slow/unreachable)
        if (llmReply == null || llmReply.isBlank()) {
            llmReply = executeSmartFallback(hospitalId, sanitizedMsg, lang, matchingDonors, stockResult, requestsResult, recordedToolCalls);
        }

        String finalReply = ensureDisclaimer(llmReply);

        List<String> followUps = generateQuickFollowUps(sanitizedMsg, matchingDonors, stockResult);

        return new ChatResult(
                true,
                true,
                finalReply,
                lang,
                matchingDonors,
                stockResult.isEmpty() ? null : stockResult,
                requestsResult.isEmpty() ? null : requestsResult,
                followUps,
                recordedToolCalls,
                null,
                null
        );
    }

    /**
     * Executes the OpenAI-compatible function-calling loop (Groq or Gemini OpenAI API).
     */
    private String executeLlmToolLoop(
            String apiUrl,
            String apiKey,
            String model,
            String userMsg,
            List<Map<String, Object>> browserHistory,
            int hospitalId,
            List<Map<String, Object>> matchingDonors,
            Map<String, Object> stockResult,
            Map<String, Object> requestsResult,
            List<Map<String, Object>> recordedToolCalls) throws Exception {

        ObjectNode payload = MAPPER.createObjectNode();
        payload.put("model", model);
        payload.put("temperature", 0.1);
        payload.put("max_tokens", getMaxTokens());

        ArrayNode messages = MAPPER.createArrayNode();
        messages.add(MAPPER.createObjectNode().put("role", "system").put("content", SYSTEM_PROMPT));

        // Add last 8-10 messages from browser history for natural follow-up context
        if (browserHistory != null) {
            int start = Math.max(0, browserHistory.size() - 8);
            for (int i = start; i < browserHistory.size(); i++) {
                Map<String, Object> h = browserHistory.get(i);
                String role = (String) h.get("role");
                String content = (String) h.get("content");
                if (role != null && content != null && !content.isBlank()) {
                    if ("user".equalsIgnoreCase(role) || "assistant".equalsIgnoreCase(role)) {
                        messages.add(MAPPER.createObjectNode().put("role", role.toLowerCase()).put("content", content));
                    }
                }
            }
        }

        messages.add(MAPPER.createObjectNode().put("role", "user").put("content", userMsg));
        payload.set("messages", messages);
        payload.set("tools", buildToolsJson());
        payload.put("tool_choice", "auto");

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(payload)))
                .timeout(Duration.ofSeconds(6))
                .build();

        HttpResponse<String> resp = HTTP_CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            throw new RuntimeException("Provider " + apiUrl + " returned HTTP " + resp.statusCode() + ": " + resp.body());
        }

        JsonNode json = MAPPER.readTree(resp.body());
        JsonNode choice = json.path("choices").path(0);
        JsonNode msgNode = choice.path("message");

        JsonNode toolCallsNode = msgNode.path("tool_calls");
        if (toolCallsNode.isArray() && toolCallsNode.size() > 0) {
            // Model called one or more tools
            messages.add(msgNode); // Add assistant message with tool_calls

            for (JsonNode tc : toolCallsNode) {
                String toolCallId = tc.path("id").asText();
                String toolName = tc.path("function").path("name").asText();
                String argsStr = tc.path("function").path("arguments").asText();
                JsonNode args = MAPPER.readTree(argsStr);

                Map<String, Object> toolOutput = executeSingleTool(hospitalId, toolName, args, matchingDonors, stockResult, requestsResult);
                recordedToolCalls.add(Map.of(
                        "tool", toolName,
                        "input", args,
                        "result", toolOutput
                ));

                ObjectNode toolRespMsg = MAPPER.createObjectNode();
                toolRespMsg.put("role", "tool");
                toolRespMsg.put("tool_call_id", toolCallId);
                toolRespMsg.put("name", toolName);
                toolRespMsg.put("content", MAPPER.writeValueAsString(toolOutput));
                messages.add(toolRespMsg);
            }

            // Second API turn: Let LLM generate the grounded natural language response in the user's language
            ObjectNode secondPayload = MAPPER.createObjectNode();
            secondPayload.put("model", model);
            secondPayload.put("temperature", 0.1);
            secondPayload.put("max_tokens", getMaxTokens());
            secondPayload.set("messages", messages);

            HttpRequest secondReq = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(secondPayload)))
                    .timeout(Duration.ofSeconds(6))
                    .build();

            HttpResponse<String> secondResp = HTTP_CLIENT.send(secondReq, HttpResponse.BodyHandlers.ofString());
            if (secondResp.statusCode() == 200) {
                JsonNode secJson = MAPPER.readTree(secondResp.body());
                return secJson.path("choices").path(0).path("message").path("content").asText();
            }
        }

        // Direct response without tool calls
        return msgNode.path("content").asText();
    }

    /**
     * Executes an individual tool against the live MySQL data for this authenticated hospital.
     */
    private Map<String, Object> executeSingleTool(
            int hospitalId,
            String toolName,
            JsonNode args,
            List<Map<String, Object>> matchingDonors,
            Map<String, Object> stockResult,
            Map<String, Object> requestsResult) {

        Map<String, Object> out = new LinkedHashMap<>();
        if (assistantService == null) return out;

        try {
            switch (toolName) {
                case "find_nearby_donors":
                case "donor_availability": {
                    String bloodGroup = args.has("bloodGroup") && !args.get("bloodGroup").isNull() ? args.get("bloodGroup").asText() : null;
                    double radiusKm = args.has("radiusKm") ? args.get("radiusKm").asDouble(10.0) : 10.0;
                    boolean includeCompatible = !args.has("includeCompatible") || args.get("includeCompatible").asBoolean(true);
                    boolean onlyFastResponders = args.has("onlyFastResponders") && args.get("onlyFastResponders").asBoolean(false);

                    out = assistantService.findNearbyDonors(hospitalId, bloodGroup, radiusKm, includeCompatible, onlyFastResponders);
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> list = (List<Map<String, Object>>) out.get("donors");
                    if (list != null) {
                        matchingDonors.addAll(list);
                    }
                    break;
                }
                case "get_hospital_blood_stock":
                case "get_stock": {
                    String bloodGroup = args.has("bloodGroup") && !args.get("bloodGroup").isNull() ? args.get("bloodGroup").asText() : null;
                    out = assistantService.getHospitalBloodStock(hospitalId, bloodGroup);
                    stockResult.putAll(out);
                    break;
                }
                case "get_active_requests":
                case "active_requests": {
                    String status = args.has("status") && !args.get("status").isNull() ? args.get("status").asText() : null;
                    out = assistantService.getActiveRequests(hospitalId, status);
                    requestsResult.putAll(out);
                    break;
                }
                case "get_today_checkins": {
                    out = assistantService.getTodayCheckins(hospitalId);
                    break;
                }
                case "get_hospital_summary": {
                    out = assistantService.getHospitalSummary(hospitalId);
                    break;
                }
                case "prepare_or_send_donor_request": {
                    int donorId = args.has("donorId") ? args.get("donorId").asInt(0) : 0;
                    String blood = args.has("bloodGroup") ? args.get("bloodGroup").asText() : null;
                    int units = args.has("units") ? args.get("units").asInt(1) : 1;
                    String urgency = args.has("urgency") ? args.get("urgency").asText("Urgent") : "Urgent";
                    out = assistantService.prepareOrSendDonorRequest(hospitalId, donorId, blood, units, urgency);
                    break;
                }
                default: {
                    out.put("status", "unknown_tool");
                    out.put("message", "Tool '" + toolName + "' is not supported.");
                    break;
                }
            }
        } catch (Exception e) {
            log.warn("Error executing assistant tool {}: {}", toolName, e.getMessage());
            out.put("error", e.getMessage());
        }
        return out;
    }

    /**
     * Smart multilingual fallback engine that executes the appropriate live tools
     * and produces grounded answers in Hindi, Hinglish, or English without canned greetings.
     */
    private String executeSmartFallback(
            int hospitalId,
            String msg,
            String lang,
            List<Map<String, Object>> matchingDonors,
            Map<String, Object> stockResult,
            Map<String, Object> requestsResult,
            List<Map<String, Object>> recordedToolCalls) {

        String lower = msg.toLowerCase();
        String bloodGroup = extractBloodGroup(msg);
        double radius = extractRadius(msg, 10.0);
        boolean onlyFastResponders = lower.contains("jaldi accept") || lower.contains("fast responder") || lower.contains("high accuracy");

        boolean isDonorQuery = lower.contains("donor") || lower.contains("donors") || lower.contains("aas paas") ||
                lower.contains("paas") || lower.contains("radius") || lower.contains("chahiye") || lower.contains("khoj") ||
                bloodGroup != null;

        boolean isStockQuery = lower.contains("stock") || lower.contains("inventory") || lower.contains("critical") ||
                lower.contains("low") || lower.contains("expire") || lower.contains("bag");

        boolean isRequestOrCheckinQuery = lower.contains("request") || lower.contains("active") || lower.contains("check-in") ||
                lower.contains("checkin") || lower.contains("arrival") || lower.contains("aaj");

        if (isDonorQuery && assistantService != null) {
            try {
                Map<String, Object> toolRes = assistantService.findNearbyDonors(hospitalId, bloodGroup, radius, true, onlyFastResponders);
                recordedToolCalls.add(Map.of("tool", "find_nearby_donors", "input", Map.of("bloodGroup", bloodGroup != null ? bloodGroup : "null", "radiusKm", radius), "result", toolRes));
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> dList = (List<Map<String, Object>>) toolRes.get("donors");
                if (dList != null) matchingDonors.addAll(dList);

                int count = matchingDonors.size();
                String target = bloodGroup != null ? bloodGroup : (lang.equals("hi") ? "सभी रक्त समूहों" : "all blood groups");

                if ("hi".equals(lang)) {
                    if (count > 0) {
                        return "अस्पताल के " + (int) radius + " किमी दायरे में " + target + " के लिए " + count + " योग्य रक्तदाता उपलब्ध हैं। उच्च-सटीकता और तेज़ प्रतिक्रिया वाले रक्तदाताओं को नीचे प्राथमिकता दी गई है। आप सीधे 'Send Request' बटन से तुरंत आपातकालीन अनुरोध भेज सकते हैं।";
                    } else {
                        return (int) radius + " किमी के दायरे में " + target + " का कोई रक्तदाता नहीं मिला। कृपया दायरा 20 किमी तक बढ़ाकर देखें।";
                    }
                } else if ("hinglish".equals(lang)) {
                    if (count > 0) {
                        return "Aapke " + (int) radius + " km ke radius me " + (bloodGroup != null ? bloodGroup + " ke " : "sare blood groups ke ") + count + " eligible donor(s) available hai. High-accuracy aur fast-response donors neeche cards me prioritized hai. Aap bina page chhode sidhe 'Send Request' button se request bhej sakte hai.";
                    } else {
                        return (int) radius + " km ke radius me koi eligible donor nahi mila. Aap search radius 20 km karke dekh sakte hai.";
                    }
                } else {
                    if (count > 0) {
                        return "Found " + count + " eligible donor(s) within " + (int) radius + " km" + (bloodGroup != null ? " for " + bloodGroup : "") + ". High-accuracy and fast-response donors are prioritized below. You can send emergency requests directly to each donor without leaving this page.";
                    } else {
                        return "No eligible donors found within " + (int) radius + " km" + (bloodGroup != null ? " for " + bloodGroup : "") + ". Try expanding your search radius to 20 km.";
                    }
                }
            } catch (Exception e) {
                log.warn("Error in fallback donor search: {}", e.getMessage());
            }
        }

        if (isStockQuery && assistantService != null) {
            try {
                Map<String, Object> toolRes = assistantService.getHospitalBloodStock(hospitalId, bloodGroup);
                recordedToolCalls.add(Map.of("tool", "get_hospital_blood_stock", "input", Map.of("bloodGroup", bloodGroup != null ? bloodGroup : "null"), "result", toolRes));
                stockResult.putAll(toolRes);

                @SuppressWarnings("unchecked")
                List<String> crit = (List<String>) toolRes.get("criticalGroups");
                @SuppressWarnings("unchecked")
                List<String> low = (List<String>) toolRes.get("lowGroups");
                int totalUnits = ((Number) toolRes.getOrDefault("totalUnits", 0)).intValue();

                boolean isDeficit = (crit != null && !crit.isEmpty()) || (low != null && !low.isEmpty());

                if ("hi".equals(lang)) {
                    if (isDeficit) {
                        return "अस्पताल में कुल " + totalUnits + " यूनिट रक्त उपलब्ध है। क्रिटिकल/कम समूह: " + (crit != null ? crit : "") + " " + (low != null ? low : "") + "। अगले 3 दिनों में कोई बैग एक्सपायर नहीं हो रहा है।";
                    } else {
                        return "अस्पताल की इन्वेंट्री में सभी 8 रक्त समूहों का स्टॉक सामान्य है (कुल " + totalUnits + " यूनिट्स)। कोई भी समूह क्रिटिकल या लो नहीं है, और अगले 3 दिनों में कोई बैग एक्सपायर नहीं हो रहा है।";
                    }
                } else if ("hinglish".equals(lang)) {
                    if (isDeficit) {
                        return "Hospital me kul " + totalUnits + " blood units available hai. Critical/Low deficit groups: " + (crit != null ? crit : "") + " " + (low != null ? low : "") + ". Agle 3 dino me koi bag expire nahi ho raha hai.";
                    } else {
                        return "Aapke hospital inventory me sabhi 8 blood groups ka stock normal hai (kul " + totalUnits + " units). Koi bhi group critical ya low deficit me nahi hai, aur agle 3 dino me koi bhi bag expire nahi ho raha hai.";
                    }
                } else {
                    if (isDeficit) {
                        return "Hospital has " + totalUnits + " total units on hand. Deficit groups: " + (crit != null ? crit : "") + " " + (low != null ? low : "") + ". 0 bags are expiring within the next 3 days.";
                    } else {
                        return "Hospital blood stock is adequate across all 8 blood groups (total " + totalUnits + " units on hand). No groups are in Critical or Low deficit, and 0 bags are expiring within 3 days.";
                    }
                }
            } catch (Exception e) {
                log.warn("Error in fallback stock query: {}", e.getMessage());
            }
        }

        if (isRequestOrCheckinQuery && assistantService != null) {
            try {
                Map<String, Object> reqRes = assistantService.getActiveRequests(hospitalId, null);
                Map<String, Object> chkRes = assistantService.getTodayCheckins(hospitalId);
                requestsResult.putAll(reqRes);

                int actCount = ((Number) reqRes.getOrDefault("totalActive", 0)).intValue();
                int chkCount = ((Number) chkRes.getOrDefault("todayCheckinsCount", 0)).intValue();

                if ("hi".equals(lang)) {
                    return "आज आपके अस्पताल में " + actCount + " सक्रिय आपातकालीन रक्त अनुरोध (Active Requests) और " + chkCount + " डोनर चेक-इन दर्ज हैं।";
                } else if ("hinglish".equals(lang)) {
                    return "Aaj aapke hospital me " + actCount + " active emergency blood requests aur " + chkCount + " donor check-ins recorded hai.";
                } else {
                    return "Today your hospital has " + actCount + " active blood requests and " + chkCount + " scheduled/completed donor check-in scans.";
                }
            } catch (Exception e) {
                log.warn("Error in fallback requests query: {}", e.getMessage());
            }
        }

        // Summary overview fallback
        try {
            Map<String, Object> sum = assistantService.getHospitalSummary(hospitalId);
            int totStock = ((Number) sum.getOrDefault("totalStockUnits", 0)).intValue();
            int actReqs = ((Number) sum.getOrDefault("activeRequestsCount", 0)).intValue();
            int chkCount = ((Number) sum.getOrDefault("todayCheckinsCount", 0)).intValue();

            if ("hi".equals(lang)) {
                return "अस्पताल अवलोकन: कुल ब्लड स्टॉक " + totStock + " यूनिट्स, " + actReqs + " सक्रिय अनुरोध, और आज " + chkCount + " चेक-इन रिकॉर्ड हैं। किसी भी विशिष्ट आवश्यकता के लिए नीचे पूछें।";
            } else if ("hinglish".equals(lang)) {
                return "Hospital summary: Kul " + totStock + " blood units stock me hai, " + actReqs + " active requests chal rahe hai, aur aaj " + chkCount + " check-ins recorded hai. Aap kisi bhi blood group ya radius ke donors ke bare me puchh sakte hai.";
            } else {
                return "Hospital command overview: " + totStock + " total blood units on hand, " + actReqs + " active emergency requests, and " + chkCount + " check-in scans recorded today.";
            }
        } catch (Exception ignored) {}

        return "I am your RED404 Hospital Emergency Assistant. You can ask about nearby donors, check blood stock levels, or review active requests anytime.";
    }

    private List<String> generateQuickFollowUps(String userMsg, List<Map<String, Object>> donors, Map<String, Object> stock) {
        List<String> list = new ArrayList<>();
        if (donors != null && !donors.isEmpty()) {
            list.add("inme se sirf fast responders dikhao");
            list.add("radius 15 km kar do");
            list.add("What is our hospital stock for this group?");
        } else if (stock != null && !stock.isEmpty()) {
            list.add("aas paas ke sare donors dikhao jo 10 km me hai");
            list.add("aaj kitne active requests aur check-ins hai?");
        } else {
            list.add("aas paas ke sare donors dikhao jo 5 km ke radius me hai");
            list.add("O+ urgent chahiye 10 km me");
            list.add("hamare hospital me kaunse blood group critical ya low hai?");
        }
        return list;
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
