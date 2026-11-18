package com.red404.service;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;

import com.red404.controller.AdminController;

public class Round11Verification {

    public static void main(String[] args) throws Exception {
        System.out.println("=================================================");
        System.out.println("RED404 TASK ROUND 11 - PARTS 2, 3, 4 VERIFICATION");
        System.out.println("=================================================");

        // Test 1: Masking functions (Email & Phone)
        System.out.println("\n[Test 1] Testing privacy masking functions...");
        AdminController adminCtrl = new AdminController();
        Method maskEmailMethod = AdminController.class.getDeclaredMethod("maskEmail", String.class);
        maskEmailMethod.setAccessible(true);

        Method maskPhoneMethod = AdminController.class.getDeclaredMethod("maskPhone", String.class);
        maskPhoneMethod.setAccessible(true);

        String maskedEmail1 = (String) maskEmailMethod.invoke(adminCtrl, "ankit.kumar@gmail.com");
        String maskedEmail2 = (String) maskEmailMethod.invoke(adminCtrl, "ab@test.com");
        String maskedEmail3 = (String) maskEmailMethod.invoke(adminCtrl, "a@b.com");

        System.out.println(" Masked ankit.kumar@gmail.com -> " + maskedEmail1);
        System.out.println(" Masked ab@test.com -> " + maskedEmail2);
        System.out.println(" Masked a@b.com -> " + maskedEmail3);

        assertCondition(maskedEmail1.startsWith("a***") && maskedEmail1.endsWith("@gmail.com"), "Masked email 1 format");
        assertCondition(maskedEmail2.startsWith("a***") && maskedEmail2.endsWith("@test.com"), "Masked email 2 format");

        String maskedPhone1 = (String) maskPhoneMethod.invoke(adminCtrl, "9876543210");
        String maskedPhone2 = (String) maskPhoneMethod.invoke(adminCtrl, "+919876543210");
        System.out.println(" Masked 9876543210 -> " + maskedPhone1);
        System.out.println(" Masked +919876543210 -> " + maskedPhone2);

        assertCondition(maskedPhone1.equals("98******10"), "Masked 10-digit phone should be 98******10");
        assertCondition(maskedPhone2.equals("+91 98******10"), "Masked prefixed phone should be +91 98******10");

        // Test 2: Age computation from DOB
        System.out.println("\n[Test 2] Testing age computation...");
        Method computeAgeMethod = AdminController.class.getDeclaredMethod("computeAge", String.class);
        computeAgeMethod.setAccessible(true);

        Integer age1 = (Integer) computeAgeMethod.invoke(adminCtrl, "1995-05-15");
        Integer age2 = (Integer) computeAgeMethod.invoke(adminCtrl, "2000-01-01");
        Integer age3 = (Integer) computeAgeMethod.invoke(adminCtrl, (String) null);

        System.out.println(" Age for 1995-05-15: " + age1);
        System.out.println(" Age for 2000-01-01: " + age2);
        System.out.println(" Age for null: " + age3);

        assertCondition(age1 != null && age1 >= 28 && age1 <= 32, "Age 1995 computed correctly");
        assertCondition(age2 != null && age2 >= 23 && age2 <= 27, "Age 2000 computed correctly");
        assertCondition(age3 == null, "Age null should return null");

        // Test 3: Generic Document Labeling verification (zero original file names)
        System.out.println("\n[Test 3] Testing Document label normalization (No original file names)...");
        Method getGenericDocLabelMethod = AdminController.class.getDeclaredMethod("getGenericDocLabel", String.class);
        getGenericDocLabelMethod.setAccessible(true);

        String lbl1 = (String) getGenericDocLabelMethod.invoke(adminCtrl, "registrationCertificate");
        String lbl2 = (String) getGenericDocLabelMethod.invoke(adminCtrl, "bloodBankLicense");
        String lbl3 = (String) getGenericDocLabelMethod.invoke(adminCtrl, "authorisationLetter");
        String lbl4 = (String) getGenericDocLabelMethod.invoke(adminCtrl, "custom_doc");

        System.out.println(" registrationCertificate -> " + lbl1);
        System.out.println(" bloodBankLicense -> " + lbl2);
        System.out.println(" authorisationLetter -> " + lbl3);
        System.out.println(" custom_doc -> " + lbl4);

        assertCondition(lbl1.equals("Hospital Registration Certificate"), "Generic label for registrationCertificate");
        assertCondition(lbl2.equals("Blood Bank Licence"), "Generic label for bloodBankLicense");
        assertCondition(lbl3.equals("Medical Director Authorisation Letter"), "Generic label for authorisationLetter");
        assertCondition(!lbl1.contains(".pdf") && !lbl2.contains(".jpg"), "Labels must not contain raw file extensions");

        System.out.println("\n=================================================");
        System.out.println(" [PASS] ALL ROUND 11 TESTS PASSED SUCCESSFULLY!");
        System.out.println("=================================================");
    }

    private static void assertCondition(boolean condition, String description) {
        if (!condition) {
            throw new AssertionError("FAILED: " + description);
        }
        System.out.println(" [PASS] " + description);
    }
}
