package com.red404.util;

import com.red404.config.EnvConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Base64;

/**
 * AesGcmEncryptionUtil
 *
 * Implements Part 9 Item 13:
 * Application-level encryption at rest for sensitive data (health questionnaires)
 * using AES-256-GCM with a 12-byte random IV and 128-bit authentication tag.
 * Key is derived from HEALTH_DATA_ENCRYPTION_KEY or server secret.
 */
public class AesGcmEncryptionUtil {

    private static final Logger log = LoggerFactory.getLogger(AesGcmEncryptionUtil.class);
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int IV_LENGTH_BYTES = 12;
    private static final String PREFIX = "enc:v1:";

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final SecretKey SECRET_KEY = initSecretKey();

    private static SecretKey initSecretKey() {
        try {
            String keyEnv = EnvConfig.get("HEALTH_DATA_ENCRYPTION_KEY");
            if (keyEnv != null && !keyEnv.isBlank()) {
                byte[] raw = keyEnv.trim().getBytes(StandardCharsets.UTF_8);
                if (raw.length == 32) {
                    return new SecretKeySpec(raw, "AES");
                }
                // Try Base64 decode
                try {
                    byte[] decoded = Base64.getDecoder().decode(keyEnv.trim());
                    if (decoded.length == 32) {
                        return new SecretKeySpec(decoded, "AES");
                    }
                } catch (Exception ignored) {}
            }

            // Derive 256-bit key from server admin secret or fallback salt using PBKDF2
            String secretSource = EnvConfig.get("RED404_ADMIN_SECRET");
            if (secretSource == null || secretSource.isBlank()) {
                secretSource = "RED404_MASTER_KEY_PROTECTION_2026";
            }
            byte[] salt = "RED404_HEALTH_SALT_2026_SECURE".getBytes(StandardCharsets.UTF_8);
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            KeySpec spec = new PBEKeySpec(secretSource.toCharArray(), salt, 65536, 256);
            byte[] derived = factory.generateSecret(spec).getEncoded();
            return new SecretKeySpec(derived, "AES");
        } catch (Exception e) {
            log.error("Failed to initialize AES-256 encryption key, generating runtime key: {}", e.getMessage());
            byte[] fallback = new byte[32];
            SECURE_RANDOM.nextBytes(fallback);
            return new SecretKeySpec(fallback, "AES");
        }
    }

    /**
     * Encrypts plaintext string using AES-256-GCM.
     * Returns "enc:v1:<base64-iv>:<base64-ciphertext>".
     */
    public static String encrypt(String plainText) {
        if (plainText == null || plainText.isBlank()) {
            return plainText;
        }
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            SECURE_RANDOM.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv);
            cipher.init(Cipher.ENCRYPT_MODE, SECRET_KEY, parameterSpec);

            byte[] cipherText = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            String b64Iv = Base64.getEncoder().encodeToString(iv);
            String b64Cipher = Base64.getEncoder().encodeToString(cipherText);

            return PREFIX + b64Iv + ":" + b64Cipher;
        } catch (Exception e) {
            log.error("Encryption error: {}", e.getMessage());
            return plainText; // Fail safe
        }
    }

    /**
     * Decrypts ciphertext formatted as "enc:v1:<base64-iv>:<base64-ciphertext>".
     * If not prefixed, returns plainText as-is for backward compatibility.
     */
    public static String decrypt(String cipherText) {
        if (cipherText == null || !cipherText.startsWith(PREFIX)) {
            return cipherText;
        }
        try {
            String payload = cipherText.substring(PREFIX.length());
            int sep = payload.indexOf(':');
            if (sep <= 0) {
                return cipherText;
            }
            String b64Iv = payload.substring(0, sep);
            String b64Data = payload.substring(sep + 1);

            byte[] iv = Base64.getDecoder().decode(b64Iv);
            byte[] data = Base64.getDecoder().decode(b64Data);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv);
            cipher.init(Cipher.DECRYPT_MODE, SECRET_KEY, parameterSpec);

            byte[] decrypted = cipher.doFinal(data);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Decryption error: {}", e.getMessage());
            return cipherText;
        }
    }

    public static boolean isEncrypted(String text) {
        return text != null && text.startsWith(PREFIX);
    }
}
