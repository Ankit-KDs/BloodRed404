package com.red404.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * DocumentStorageService
 *
 * Part 2 & 7: Secure Institutional Document Storage.
 * - Stores hospital registration documents outside the public web root
 * - Validates MIME type via content magic bytes (PDF, JPG, PNG)
 * - Enforces 5 MB size limit
 * - Assigns cryptographically secure UUID tokens for internal reference
 */
@Service
public class DocumentStorageService {

    private static final Logger log = LoggerFactory.getLogger(DocumentStorageService.class);
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

    private final File storageDir;

    public DocumentStorageService() {
        this.storageDir = new File("backend/data/secure_docs");
        if (!this.storageDir.exists()) {
            this.storageDir.mkdirs();
        }
    }

    public Map<String, Object> storeDocument(MultipartFile file, String docType) throws Exception {
        Map<String, Object> result = new LinkedHashMap<>();

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded document file is empty.");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds 5 MB limit.");
        }

        byte[] header = new byte[8];
        try (InputStream is = file.getInputStream()) {
            int read = is.read(header);
            if (read < 4) {
                throw new IllegalArgumentException("Corrupt or invalid document file header.");
            }
        }

        String detectedMime = detectMimeType(header);
        if (detectedMime == null) {
            throw new IllegalArgumentException("Invalid file format. Only PDF, JPG, and PNG documents are accepted.");
        }

        String docId = UUID.randomUUID().toString();
        String extension = getExtensionForMime(detectedMime);
        String safeFileName = docId + extension;
        File targetFile = new File(storageDir, safeFileName);

        try (InputStream in = file.getInputStream();
             FileOutputStream out = new FileOutputStream(targetFile)) {
            byte[] buffer = new byte[8192];
            int len;
            while ((len = in.read(buffer)) > 0) {
                out.write(buffer, 0, len);
            }
        }

        result.put("docId", docId);
        result.put("docType", docType != null ? docType : "GENERAL");
        result.put("mimeType", detectedMime);
        result.put("sizeBytes", file.getSize());
        result.put("originalName", file.getOriginalFilename());
        result.put("storagePath", targetFile.getAbsolutePath());
        result.put("uploadedAt", System.currentTimeMillis());

        log.info("Secure document stored: ID={}, Type={}, Size={} KB", docId, docType, file.getSize() / 1024);
        return result;
    }

    public File getDocumentFile(String docId) {
        if (docId == null || docId.isBlank()) return null;
        File[] files = storageDir.listFiles((dir, name) -> name.startsWith(docId));
        if (files != null && files.length > 0) {
            return files[0];
        }
        return null;
    }

    public boolean deleteDocument(String docId) {
        if (docId == null || docId.isBlank()) return false;
        File[] files = storageDir.listFiles((dir, name) -> name.startsWith(docId));
        boolean anyDeleted = false;
        if (files != null) {
            for (File f : files) {
                if (f.delete()) {
                    anyDeleted = true;
                    log.info("Deleted secure document file: {}", f.getName());
                }
            }
        }
        return anyDeleted;
    }

    public void deleteHospitalDocuments(String documentsJson) {
        if (documentsJson == null || documentsJson.isBlank()) return;
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = com.red404.util.JsonUtil.mapper();
            com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(documentsJson);
            if (node.isObject()) {
                node.fields().forEachRemaining(entry -> {
                    com.fasterxml.jackson.databind.JsonNode docNode = entry.getValue();
                    if (docNode.has("docId")) {
                        deleteDocument(docNode.get("docId").asText());
                    }
                });
            } else if (node.isArray()) {
                for (com.fasterxml.jackson.databind.JsonNode item : node) {
                    if (item.has("docId")) {
                        deleteDocument(item.get("docId").asText());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Notice deleting hospital documents: {}", e.getMessage());
        }
    }

    private String detectMimeType(byte[] bytes) {
        // PDF: %PDF- (25 50 44 46)
        if (bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46) {
            return "application/pdf";
        }
        // PNG: 89 50 4E 47
        if ((bytes[0] & 0xFF) == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) {
            return "image/png";
        }
        // JPEG: FF D8 FF
        if ((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        return null;
    }

    private String getExtensionForMime(String mime) {
        return switch (mime) {
            case "application/pdf" -> ".pdf";
            case "image/png" -> ".png";
            case "image/jpeg" -> ".jpg";
            default -> ".bin";
        };
    }
}
