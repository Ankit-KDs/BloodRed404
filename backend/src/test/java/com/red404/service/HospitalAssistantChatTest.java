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
    @DisplayName("Test 2: Unconfigured API key returns fast deterministic fallback without crash or 500")
    void testUnconfiguredFallback() {
        // When external LLM API key is not set, deterministic emergency engine responds immediately
        HospitalAssistantChatService.ChatResult result = chatService.processChat(12, "test@red404.org", "blood chahiye O+", Collections.emptyList());
        assertNotNull(result);
        assertTrue(result.success);
        assertTrue(result.configured);
        assertNotNull(result.reply);
        assertTrue(result.reply.contains("Counts are estimates. A doctor makes the final decision."));
    }

    @Test
    @DisplayName("Test 3: Mandatory doctor disclaimer constant exists")
    void testMandatoryDisclaimer() {
        assertEquals("Counts are estimates. A doctor makes the final decision.", HospitalAssistantChatService.MANDATORY_DISCLAIMER);
    }

    @Test
    @DisplayName("Test 4: Intent extraction utilities for blood group and radius")
    void testIntentExtraction() {
        assertEquals("O+", HospitalAssistantChatService.extractBloodGroup("blood chahiye O+ 10km"));
        assertEquals("A-", HospitalAssistantChatService.extractBloodGroup("urgent A negative donor required"));
        assertEquals("AB+", HospitalAssistantChatService.extractBloodGroup("compatible donors for AB+"));
        assertEquals(20.0, HospitalAssistantChatService.extractRadius("donors in 20 km", 10.0));
        assertEquals(5.0, HospitalAssistantChatService.extractRadius("radius 5km", 10.0));
    }
}
