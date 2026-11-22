package com.red404.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Part 3: Real LLM Tool-Calling AI Agent.
 */
public class HospitalAssistantChatTest {

    private final HospitalAssistantChatService chatService = new HospitalAssistantChatService();

    @Test
    @DisplayName("Test 1: System prompt conforms strictly to real-time LLM emergency agent")
    void testSystemPromptRequirements() {
        String prompt = HospitalAssistantChatService.SYSTEM_PROMPT;
        assertNotNull(prompt);
        assertTrue(prompt.contains("RED404's real-time Hospital AI Emergency Agent"));
        assertTrue(prompt.contains("live hospital tools"));
        assertTrue(prompt.contains("EXACT SAME LANGUAGE and STYLE"));
        assertTrue(prompt.contains("Hindi in Devanagari, or Hinglish in Roman script"));
        assertTrue(prompt.contains("NEVER hallucinate or invent numbers"));
        assertTrue(prompt.contains("Blood group is OPTIONAL for donor search"));
        assertTrue(prompt.contains("Counts are estimates. A doctor makes the final decision."));
    }

    @Test
    @DisplayName("Test 2: Unconfigured API key returns honest status badge and clear message")
    void testUnconfiguredHonestStatus() {
        HospitalAssistantChatService.ChatResult notCfg = HospitalAssistantChatService.ChatResult.notConfigured();
        assertNotNull(notCfg);
        assertTrue(notCfg.success);
        assertFalse(notCfg.configured, "Configured must be false when no API key is provided");
        assertNotNull(notCfg.reply);
        assertTrue(notCfg.reply.contains("AI Key Not Configured"), "Reply must state AI Key Not Configured");
        assertTrue(notCfg.reply.contains("Counts are estimates. A doctor makes the final decision."));

        if (!chatService.isConfigured()) {
            HospitalAssistantChatService.ChatResult result = chatService.processChat(12, "test@red404.org", "aas paas ke donors dikhao", Collections.emptyList());
            assertNotNull(result);
            assertTrue(result.success);
            assertFalse(result.configured);
            assertNotNull(result.reply);
            assertTrue(result.reply.contains("AI Key Not Configured"));
            assertTrue(result.reply.contains("Counts are estimates. A doctor makes the final decision."));
        }
    }

    @Test
    @DisplayName("Test 3: Mandatory doctor disclaimer constant exists")
    void testMandatoryDisclaimer() {
        assertEquals("Counts are estimates. A doctor makes the final decision.", HospitalAssistantChatService.MANDATORY_DISCLAIMER);
    }

    @Test
    @DisplayName("Test 4: Intent extraction utilities for blood group and radius with optional blood group")
    void testIntentExtraction() {
        assertEquals("O+", HospitalAssistantChatService.extractBloodGroup("blood chahiye O+ 10km"));
        assertEquals("A-", HospitalAssistantChatService.extractBloodGroup("urgent A negative donor required"));
        assertEquals("AB+", HospitalAssistantChatService.extractBloodGroup("compatible donors for AB+"));
        // Blood group is optional!
        assertNull(HospitalAssistantChatService.extractBloodGroup("aas paas ke sare donors dikhao jo 5 km ke radius me hai"));
        
        assertEquals(20.0, HospitalAssistantChatService.extractRadius("donors in 20 km", 10.0));
        assertEquals(5.0, HospitalAssistantChatService.extractRadius("radius 5km", 10.0));
        assertEquals(10.0, HospitalAssistantChatService.extractRadius("aas paas ke donors", 10.0));
    }

    @Test
    @DisplayName("Test 5: Multilingual language detector handles Hindi, Hinglish, and English")
    void testLanguageDetection() {
        assertEquals("hinglish", HospitalAssistantChatService.detectLanguage("aas paas ke sare donors dikhao jo 5 km ke radius me hai"));
        assertEquals("hinglish", HospitalAssistantChatService.detectLanguage("O+ urgent chahiye 10 km me, jaldi accept karne wale dikhao"));
        assertEquals("hinglish", HospitalAssistantChatService.detectLanguage("hamare hospital me kaunse blood group critical ya low hai aur koi bag expire ho raha hai kya?"));
        assertEquals("hinglish", HospitalAssistantChatService.detectLanguage("aaj kitne active requests aur check-ins hai?"));
        assertEquals("hi", HospitalAssistantChatService.detectLanguage("रक्तदाता दिखाओ जो पास में हैं"));
        assertEquals("en", HospitalAssistantChatService.detectLanguage("Show all donors within 10 km"));
    }
}
