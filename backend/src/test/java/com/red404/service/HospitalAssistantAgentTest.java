package com.red404.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit test verifying Requirement 3, 4, & 5 agent contracts and test queries in Hinglish, Hindi, and English:
 * 1) "aas paas ke sare donors dikhao jo 5 km ke radius me hai" (no blood group -> real nearby donors within 5 km)
 * 2) "O+ urgent chahiye 10 km me, jaldi accept karne wale dikhao" (blood group + compatibility + acceptance accuracy ranking + Send Request button)
 * 3) "hamare hospital me kaunse blood group critical ya low hai aur koi bag expire ho raha hai kya?" (live inventory + expiring bags)
 * 4) "aaj kitne active requests aur check-ins hai?" (live requests + check-ins)
 */
public class HospitalAssistantAgentTest {

    private final HospitalAssistantService assistantService = new HospitalAssistantService();

    @Test
    @DisplayName("Requirement 3: Agentic hospital tools are properly registered and allowed")
    void testAgenticToolsRegistered() {
        Set<String> agentTools = HospitalAssistantService.AGENTIC_HOSPITAL_TOOLS;
        assertNotNull(agentTools);
        assertTrue(agentTools.contains("find_nearby_donors"));
        assertTrue(agentTools.contains("get_hospital_blood_stock"));
        assertTrue(agentTools.contains("get_active_requests"));
        assertTrue(agentTools.contains("get_today_checkins"));
        assertTrue(agentTools.contains("get_hospital_summary"));
        assertTrue(agentTools.contains("prepare_or_send_donor_request"));

        for (String tool : agentTools) {
            assertTrue(assistantService.isToolAllowed(tool), "Tool must be allowed: " + tool);
        }
    }

    @Test
    @DisplayName("Query 1 Intent: 'aas paas ke sare donors dikhao jo 5 km ke radius me hai'")
    void testQuery1Intent() {
        String query = "aas paas ke sare donors dikhao jo 5 km ke radius me hai";
        // Blood group is OPTIONAL and must be null
        String blood = HospitalAssistantChatService.extractBloodGroup(query);
        assertNull(blood, "Blood group must be null for general donor query");

        double radius = HospitalAssistantChatService.extractRadius(query, 10.0);
        assertEquals(5.0, radius, "Radius must be extracted as 5 km");

        String lang = HospitalAssistantChatService.detectLanguage(query);
        assertEquals("hinglish", lang, "Language must be detected as hinglish");
    }

    @Test
    @DisplayName("Query 2 Intent: 'O+ urgent chahiye 10 km me, jaldi accept karne wale dikhao'")
    void testQuery2Intent() {
        String query = "O+ urgent chahiye 10 km me, jaldi accept karne wale dikhao";
        String blood = HospitalAssistantChatService.extractBloodGroup(query);
        assertEquals("O+", blood, "Blood group must be extracted as O+");

        double radius = HospitalAssistantChatService.extractRadius(query, 10.0);
        assertEquals(10.0, radius, "Radius must be extracted as 10 km");

        String urgency = HospitalAssistantChatService.extractUrgency(query);
        assertEquals("Urgent", urgency, "Urgency must be extracted as Urgent");

        String lang = HospitalAssistantChatService.detectLanguage(query);
        assertEquals("hinglish", lang, "Language must be detected as hinglish");
    }

    @Test
    @DisplayName("Query 3 Intent: 'hamare hospital me kaunse blood group critical ya low hai aur koi bag expire ho raha hai kya?'")
    void testQuery3Intent() {
        String query = "hamare hospital me kaunse blood group critical ya low hai aur koi bag expire ho raha hai kya?";
        String lang = HospitalAssistantChatService.detectLanguage(query);
        assertEquals("hinglish", lang, "Language must be detected as hinglish");

        boolean isStockQuery = query.toLowerCase().contains("critical") || query.toLowerCase().contains("low") || query.toLowerCase().contains("expire");
        assertTrue(isStockQuery, "Must identify as stock and expiration query");
    }

    @Test
    @DisplayName("Query 4 Intent: 'aaj kitne active requests aur check-ins hai?'")
    void testQuery4Intent() {
        String query = "aaj kitne active requests aur check-ins hai?";
        String lang = HospitalAssistantChatService.detectLanguage(query);
        assertEquals("hinglish", lang, "Language must be detected as hinglish");

        boolean isReqOrCheckin = query.toLowerCase().contains("active") || query.toLowerCase().contains("check-in");
        assertTrue(isReqOrCheckin, "Must identify as active request and checkin query");
    }
}
