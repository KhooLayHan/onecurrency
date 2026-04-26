import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const SEPARATOR = ":";
const EXPECTED_PARTS_COUNT = 3;

function getMasterKey(): string {
  const key = env.MASTER_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("MASTER_ENCRYPTION_KEY is not configured");
  }
  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM with the MASTER_ENCRYPTION_KEY.
 * Returns a colon-separated hex string: "IV:AuthTag:Ciphertext".
 */
export function encrypt(plaintext: string): string {
  const key = Buffer.from(
    getMasterKey().replace("0x", ""),
    "hex"
  );
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(SEPARATOR);
}

/**
 * Decrypts an AES-256-GCM encrypted string produced by `encrypt()`.
 * Expects format: "IV:AuthTag:Ciphertext" (all hex-encoded).
 * Throws if the format is invalid or if authentication fails (tampered data).
 */
export function decrypt(encryptedData: string): string {
  const key = Buffer.from(
    getMasterKey().replace("0x", ""),
    "hex"
  );
  const parts = encryptedData.split(SEPARATOR);
  if (parts.length !== EXPECTED_PARTS_COUNT) {
    throw new Error(
      `Invalid encrypted data format: expected ${EXPECTED_PARTS_COUNT} parts, got ${parts.length}`
    );
  }
  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
