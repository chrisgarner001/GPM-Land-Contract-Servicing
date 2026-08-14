import { createHmac } from "crypto";
import { describe, expect, it, beforeAll } from "vitest";
import { verifyHelcimWebhookSignature } from "./helcim";

const VERIFIER_TOKEN = Buffer.from("test-verifier-token-bytes").toString("base64");

beforeAll(() => {
  process.env.HELCIM_WEBHOOK_VERIFIER_TOKEN = VERIFIER_TOKEN;
});

function sign(id: string, timestamp: string, rawBody: string): string {
  const key = Buffer.from(VERIFIER_TOKEN, "base64");
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  return createHmac("sha256", key).update(signedContent).digest("base64");
}

describe("verifyHelcimWebhookSignature", () => {
  const id = "msg_123";
  const timestamp = "1700000000";
  const rawBody = JSON.stringify({ id: "25764674", type: "cardTransaction" });

  it("accepts a correctly signed v1 signature", () => {
    const signatureHeader = `v1,${sign(id, timestamp, rawBody)}`;
    expect(verifyHelcimWebhookSignature({ id, timestamp, signatureHeader, rawBody })).toBe(true);
  });

  it("accepts a valid signature among multiple space-delimited entries", () => {
    const signatureHeader = `v0,bogus v1,${sign(id, timestamp, rawBody)}`;
    expect(verifyHelcimWebhookSignature({ id, timestamp, signatureHeader, rawBody })).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signatureHeader = `v1,${sign(id, timestamp, rawBody)}`;
    const tamperedBody = JSON.stringify({ id: "25764674", type: "cardTransaction", amount: 999999 });
    expect(verifyHelcimWebhookSignature({ id, timestamp, signatureHeader, rawBody: tamperedBody })).toBe(false);
  });

  it("rejects a signature with no v1 entry", () => {
    const signatureHeader = `v2,${sign(id, timestamp, rawBody)}`;
    expect(verifyHelcimWebhookSignature({ id, timestamp, signatureHeader, rawBody })).toBe(false);
  });

  it("rejects a signature computed with the wrong verifier token", () => {
    const key = Buffer.from(Buffer.from("a-different-token").toString("base64"), "base64");
    const wrongSignature = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
    const signatureHeader = `v1,${wrongSignature}`;
    expect(verifyHelcimWebhookSignature({ id, timestamp, signatureHeader, rawBody })).toBe(false);
  });
});
