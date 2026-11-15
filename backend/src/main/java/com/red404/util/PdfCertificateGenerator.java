package com.red404.util;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure-Java zero-dependency PDF 1.4 Certificate Generator.
 * Outputs a valid, compliant landscape PDF document for verified blood donations.
 */
public class PdfCertificateGenerator {

    public static byte[] generateCertificate(String donorName, String donorId, String bloodType,
                                             String volume, String date, String recordId, String hospital) {
        if (donorName == null || donorName.isBlank()) donorName = "Verified Blood Donor";
        if (donorId == null || donorId.isBlank()) donorId = "DNR-0811";
        if (bloodType == null || bloodType.isBlank()) bloodType = "O+";
        if (volume == null || volume.isBlank()) volume = "450 mL (1 Unit)";
        if (date == null || date.isBlank()) date = java.time.LocalDate.now().toString();
        if (recordId == null || recordId.isBlank()) recordId = "RED-" + (System.currentTimeMillis() % 100000);
        if (hospital == null || hospital.isBlank()) hospital = "Verified District Hospital";

        StringBuilder stream = new StringBuilder();

        // 1. Decorative border
        // Dark outer box
        stream.append("0.08 0.09 0.11 rg 0 0 792 612 re f\n");
        // Inner white/cream certificate background
        stream.append("0.98 0.98 0.98 rg 28 28 736 556 re f\n");
        // Crimson border
        stream.append("0.898 0.165 0.231 RG 3 w 36 36 720 540 re S\n");
        // Thin inner decorative border
        stream.append("0.75 0.75 0.75 RG 1 w 42 42 708 528 re S\n");

        // Top accent banner
        stream.append("0.898 0.165 0.231 rg 42 538 708 32 re f\n");
        stream.append("BT /F1 13 Tf 1.0 1.0 1.0 rg ");
        stream.append(centerText("RED404  *  OFFICIAL CLINICAL BLOOD RESCUE NETWORK", 13, 550));
        stream.append(" Tj ET\n");

        // Certificate Title
        stream.append("BT /F1 22 Tf 0.12 0.13 0.15 rg ");
        stream.append(centerText("CERTIFICATE OF VERIFIED BLOOD DONATION", 22, 498));
        stream.append(" Tj ET\n");

        // Subtitle
        stream.append("BT /F2 11 Tf 0.45 0.45 0.45 rg ");
        stream.append(centerText("THIS CLINICAL RECOGNITION IS PROUDLY CONFERRED UPON", 11, 468));
        stream.append(" Tj ET\n");

        // Donor Name (Large Bold)
        stream.append("BT /F1 26 Tf 0.898 0.165 0.231 rg ");
        stream.append(centerText(donorName.toUpperCase(), 26, 426));
        stream.append(" Tj ET\n");

        // Name Underline
        int nameWidth = (int) (donorName.length() * 26 * 0.55);
        int lineStartX = Math.max(100, 396 - (nameWidth / 2));
        int lineEndX = Math.min(692, 396 + (nameWidth / 2));
        stream.append("0.898 0.165 0.231 RG 1.5 w ").append(lineStartX).append(" 416 m ").append(lineEndX).append(" 416 l S\n");

        // Body appreciation paragraph
        stream.append("BT /F2 11 Tf 0.25 0.25 0.25 rg ");
        stream.append(centerText("In sincere appreciation of your selfless, voluntary blood donation.", 11, 388));
        stream.append(" Tj ET\n");

        stream.append("BT /F2 10.5 Tf 0.35 0.35 0.35 rg ");
        stream.append(centerText("Your contribution directly replenished verified hospital reserves and saved human lives.", 10.5, 370));
        stream.append(" Tj ET\n");

        // Metadata box (Grey rounded-style background)
        stream.append("0.93 0.94 0.96 rg 70 240 652 96 re f\n");
        stream.append("0.82 0.84 0.88 RG 1 w 70 240 652 96 re S\n");

        // Column 1: Blood Group
        stream.append("BT /F2 9.5 Tf 0.45 0.48 0.52 rg 100 308 Td (BLOOD GROUP) Tj ET\n");
        stream.append("BT /F1 18 Tf 0.898 0.165 0.231 rg 100 274 Td (").append(escapePdf(bloodType)).append(") Tj ET\n");

        // Column 2: Volume
        stream.append("BT /F2 9.5 Tf 0.45 0.48 0.52 rg 255 308 Td (VOLUME RESTOCKED) Tj ET\n");
        stream.append("BT /F1 15 Tf 0.12 0.13 0.15 rg 255 276 Td (").append(escapePdf(volume)).append(") Tj ET\n");

        // Column 3: Date
        stream.append("BT /F2 9.5 Tf 0.45 0.48 0.52 rg 430 308 Td (DONATION DATE) Tj ET\n");
        stream.append("BT /F1 15 Tf 0.12 0.13 0.15 rg 430 276 Td (").append(escapePdf(date)).append(") Tj ET\n");

        // Column 4: Record ID
        stream.append("BT /F2 9.5 Tf 0.45 0.48 0.52 rg 585 308 Td (RECORD ID) Tj ET\n");
        stream.append("BT /F1 13.5 Tf 0.12 0.13 0.15 rg 585 276 Td (").append(escapePdf(recordId)).append(") Tj ET\n");

        // Lower signatures section
        // Left signature: Hospital
        stream.append("0.35 0.35 0.35 RG 1 w 90 120 m 280 120 l S\n");
        stream.append("BT /F1 11 Tf 0.15 0.15 0.15 rg 90 102 Td (").append(escapePdf(hospital)).append(") Tj ET\n");
        stream.append("BT /F2 9.5 Tf 0.5 0.5 0.5 rg 90 88 Td (Verified Hospital Medical Authority) Tj ET\n");

        // Right signature: Registry
        stream.append("0.35 0.35 0.35 RG 1 w 512 120 m 702 120 l S\n");
        stream.append("BT /F1 11 Tf 0.15 0.15 0.15 rg 512 102 Td (RED404 Central Registry) Tj ET\n");
        stream.append("BT /F2 9.5 Tf 0.5 0.5 0.5 rg 512 88 Td (Smart Donor ID: ").append(escapePdf(donorId)).append(") Tj ET\n");

        // Security stamp footer
        stream.append("BT /F2 8.5 Tf 0.55 0.55 0.55 rg ");
        stream.append(centerText("OFFICIAL DOCUMENT - VERIFIED VIA RED404 DISTRICT HOSPITAL CLINICAL CHECK-IN", 8.5, 52));
        stream.append(" Tj ET\n");

        byte[] streamBytes = stream.toString().getBytes(StandardCharsets.ISO_8859_1);

        // Build PDF objects
        List<String> objects = new ArrayList<>();
        // 1: Catalog
        objects.add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
        // 2: Pages
        objects.add("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
        // 3: Page (792 x 612 pt landscape)
        objects.add("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] " +
                "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n");
        // 4: Font F1 (Helvetica-Bold)
        objects.add("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n");
        // 5: Font F2 (Helvetica)
        objects.add("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n");
        // 6: Stream Contents
        objects.add("6 0 obj\n<< /Length " + streamBytes.length + " >>\nstream\n" +
                stream.toString() + "\nendstream\nendobj\n");

        // Assemble full PDF with xref table
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try {
            baos.write("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n".getBytes(StandardCharsets.ISO_8859_1));

            List<Long> offsets = new ArrayList<>();
            offsets.add(0L); // 0th object

            for (int i = 0; i < objects.size(); i++) {
                offsets.add((long) baos.size());
                baos.write(objects.get(i).getBytes(StandardCharsets.ISO_8859_1));
            }

            long xrefOffset = baos.size();
            baos.write(String.format("xref\n0 %d\n0000000000 65535 f \n", objects.size() + 1).getBytes(StandardCharsets.ISO_8859_1));
            for (int i = 1; i <= objects.size(); i++) {
                baos.write(String.format("%010d 00000 n \n", offsets.get(i)).getBytes(StandardCharsets.ISO_8859_1));
            }

            baos.write(("trailer\n<< /Size " + (objects.size() + 1) + " /Root 1 0 R >>\nstartxref\n" +
                    xrefOffset + "\n%%EOF\n").getBytes(StandardCharsets.ISO_8859_1));

        } catch (IOException e) {
            throw new RuntimeException("Error generating PDF certificate", e);
        }

        return baos.toByteArray();
    }

    private static String centerText(String text, double fontSize, double y) {
        double approxWidth = text.length() * fontSize * 0.52;
        double x = Math.max(45, 396 - (approxWidth / 2.0));
        return String.format(java.util.Locale.US, "%.1f %.1f Td (%s)", x, y, escapePdf(text));
    }

    private static String escapePdf(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("(", "\\(")
                  .replace(")", "\\)");
    }
}
