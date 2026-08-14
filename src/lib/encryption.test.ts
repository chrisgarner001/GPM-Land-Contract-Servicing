import { describe, expect, it, beforeAll } from "vitest";
import { encryptPII, decryptPII } from "./encryption";

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEY = "0".repeat(64);
});

describe("encryptPII / decryptPII", () => {
  it("round-trips a value", () => {
    const encrypted = encryptPII("123-45-6789");
    expect(encrypted).not.toBe("123-45-6789");
    expect(decryptPII(encrypted)).toBe("123-45-6789");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptPII("123-45-6789");
    const b = encryptPII("123-45-6789");
    expect(a).not.toBe(b);
  });

  it("throws on a tampered ciphertext", () => {
    const encrypted = encryptPII("123-45-6789");
    const [iv, authTag, data] = encrypted.split(":");
    const tampered = `${iv}:${authTag}:${data.slice(0, -2)}00`;
    expect(() => decryptPII(tampered)).toThrow();
  });
});
