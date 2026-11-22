package com.red404.service;

import com.red404.util.BloodCompatibilityUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Hospital Assistant Tools and Read-Only Security Constraints.
 *
 * Requirements tested:
 * 1. Read-only tool whitelist enforcement.
 * 2. Failure if any write tool (send, broadcast, cancel, stock-edit, etc.) is registered.
 * 3. Exact blood compatibility table conformance.
 * 4. prepare_search payload contract (readyToSend=false, no free text).
 * 5. Aggregate contract (strictly zero PII).
 */
public class HospitalAssistantToolTest {

    private final HospitalAssistantService assistantService = new HospitalAssistantService();

    @Test
    @DisplayName("Requirement 5: Fail if any write tool is registered in allowed tools")
    public void testNoWriteToolsRegistered() {
        Set<String> registeredTools = HospitalAssistantService.ALLOWED_READ_ONLY_TOOLS;

        assertNotNull(registeredTools, "Registered tools set must not be null");
        assertFalse(registeredTools.isEmpty(), "Registered tools set must not be empty");

        // Verify only the 4 sanctioned read-only tools exist
        Set<String> expectedTools = Set.of(
                "donor_availability",
                "get_stock",
                "active_requests",
                "prepare_search"
        );
        assertEquals(expectedTools, registeredTools, "Assistant tool registry must contain strictly the 4 read-only tools");

        // Explicitly assert that no write action keyword is present in any registered tool
        for (String tool : registeredTools) {
            String lower = tool.toLowerCase();
            for (String forbidden : HospitalAssistantService.FORBIDDEN_WRITE_KEYWORDS) {
                assertFalse(lower.contains(forbidden),
                        "CRITICAL SECURITY VIOLATION: Tool '" + tool + "' contains forbidden write keyword '" + forbidden + "'");
            }
        }
    }

    @Test
    @DisplayName("Requirement 5: Validator must throw SecurityException when any write tool is attempted")
    public void testWriteToolsRejectedByValidator() {
        String[] writeToolsToTest = {
                "send",
                "send_request",
                "broadcast",
                "broadcast_urgent",
                "cancel",
                "cancel_request",
                "edit",
                "stock_edit",
                "edit_stock",
                "update_stock",
                "delete_donor",
                "insert_record",
                "create_request",
                "notify_all"
        };

        for (String writeTool : writeToolsToTest) {
            assertFalse(assistantService.isToolAllowed(writeTool), "Write tool must NOT be allowed: " + writeTool);
            SecurityException ex = assertThrows(SecurityException.class, () -> {
                assistantService.validateReadOnlyTool(writeTool);
            }, "Expected SecurityException for write tool attempt: " + writeTool);
            assertTrue(ex.getMessage().contains("strictly read-only"), "Exception message should cite strictly read-only restriction");
        }
    }

    @Test
    @DisplayName("Allowed read-only tools pass validation successfully")
    public void testAllowedToolsPassValidation() {
        for (String tool : HospitalAssistantService.ALLOWED_READ_ONLY_TOOLS) {
            assertTrue(assistantService.isToolAllowed(tool), "Tool should be allowed: " + tool);
            assertDoesNotThrow(() -> assistantService.validateReadOnlyTool(tool), "Tool should not throw: " + tool);
        }
    }

    @Test
    @DisplayName("Requirement 1: Shared blood compatibility matrix matches exact canonical table")
    public void testBloodCompatibilityMatrix() {
        // O-: O-
        assertEquals(List.of("O-"), BloodCompatibilityUtil.getCompatibleDonorGroups("O-"));

        // O+: O+, O-
        assertEquals(List.of("O+", "O-"), BloodCompatibilityUtil.getCompatibleDonorGroups("O+"));

        // A-: A-, O-
        assertEquals(List.of("A-", "O-"), BloodCompatibilityUtil.getCompatibleDonorGroups("A-"));

        // A+: A+, A-, O+, O-
        assertEquals(List.of("A+", "A-", "O+", "O-"), BloodCompatibilityUtil.getCompatibleDonorGroups("A+"));

        // B-: B-, O-
        assertEquals(List.of("B-", "O-"), BloodCompatibilityUtil.getCompatibleDonorGroups("B-"));

        // B+: B+, B-, O+, O-
        assertEquals(List.of("B+", "B-", "O+", "O-"), BloodCompatibilityUtil.getCompatibleDonorGroups("B+"));

        // AB-: AB-, A-, B-, O-
        assertEquals(List.of("AB-", "A-", "B-", "O-"), BloodCompatibilityUtil.getCompatibleDonorGroups("AB-"));

        // AB+: all 8 (exact first)
        List<String> abPlus = BloodCompatibilityUtil.getCompatibleDonorGroups("AB+");
        assertEquals(8, abPlus.size(), "AB+ should receive from all 8 groups");
        assertEquals("AB+", abPlus.get(0), "Exact group AB+ must be first in the list");
        assertTrue(abPlus.containsAll(List.of("AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-")));
    }

    @Test
    @DisplayName("Requirement 4: prepare_search returns prefill payload with readyToSend=false")
    public void testPrepareSearchPayload() {
        Map<String, Object> result = assistantService.prepareSearch("A+", 15, true, 3, "CRITICAL", 30);

        assertNotNull(result);
        assertEquals("PREPARE_ONLY", result.get("action"));
        assertEquals(Boolean.FALSE, result.get("readyToSend"), "prepare_search must NEVER set readyToSend to true");

        @SuppressWarnings("unchecked")
        Map<String, Object> prefill = (Map<String, Object>) result.get("prefill");
        assertNotNull(prefill);
        assertEquals("A+", prefill.get("bloodGroup"));
        assertEquals(15, prefill.get("radiusKm"));
        assertEquals(Boolean.TRUE, prefill.get("includeCompatible"));
        assertEquals(3, prefill.get("unitsNeeded"));
        assertEquals("CRITICAL", prefill.get("urgency"));
        assertEquals(30, prefill.get("neededWithinMinutes"));

        // Ensure no free text or patient notes leaked
        assertFalse(prefill.containsKey("ward"));
        assertFalse(prefill.containsKey("notes"));
        assertFalse(prefill.containsKey("patientReference"));
    }

    public static void main(String[] args) {
        System.out.println("Running HospitalAssistantToolTest via main runner...");
        HospitalAssistantToolTest test = new HospitalAssistantToolTest();
        test.testNoWriteToolsRegistered();
        System.out.println("PASS: testNoWriteToolsRegistered");
        test.testWriteToolsRejectedByValidator();
        System.out.println("PASS: testWriteToolsRejectedByValidator");
        test.testAllowedToolsPassValidation();
        System.out.println("PASS: testAllowedToolsPassValidation");
        test.testBloodCompatibilityMatrix();
        System.out.println("PASS: testBloodCompatibilityMatrix");
        test.testPrepareSearchPayload();
        System.out.println("PASS: testPrepareSearchPayload");
        System.out.println("ALL 5 TESTS PASSED SUCCESSFULLY!");
    }
}
