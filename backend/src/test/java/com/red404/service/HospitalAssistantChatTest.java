package com.red404.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Part 3: AI Assistant Chat.
 */
public class HospitalAssistantChatTest {

    private final HospitalAssistantChatService chatService = new HospitalAssistantChatService();

    @Test
    @DisplayName("Test 1: System prompt conforms strictly to requirement 3")
    void testSystemPromptRequirements() {
        String prompt = HospitalAssistantChatService.SYSTEM_PROMPT;
        assertNotNull(prompt);
        assertTrue(prompt.contains("emergency blood assistant for hospital staff"));
        assertTrue(prompt.contains("Answer urgent availability and compatibility questions"));
        assertTrue(prompt.contains("Hindi and Hinglish supported"));
        assertTrue(prompt.contains("Always use tools for donor counts and stock; never guess or make up numbers"));
        assertTrue(prompt.contains("You cannot send requests, notify donors, broadcast, edit stock, or perform any action"));
        assertTrue(prompt.contains("Counts are estimates. A doctor makes the final decision."));
    }

    @Test
    @DisplayName("Test 2: Unconfigured API key returns fallback without crash or 500")
    void testUnconfiguredFallback() {
        // When ANTHROPIC_API_KEY is not set or empty
        HospitalAssistantChatService.ChatResult result = chatService.processChat(12, "test@red404.org", "blood chahiye O+", Collections.emptyList());
        assertNotNull(result);
        assertTrue(result.success);
        assertFalse(result.configured);
        assertTrue(result.reply.contains("AI chat is not configured"));
        assertTrue(result.reply.contains("Quick Check panel"));
    }

    @Test
    @DisplayName("Test 3: Mandatory doctor disclaimer constant exists")
    void testMandatoryDisclaimer() {
        assertEquals("Counts are estimates. A doctor makes the final decision.", HospitalAssistantChatService.MANDATORY_DISCLAIMER);
    }
}
