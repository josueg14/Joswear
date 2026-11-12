import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SandboxProvider,
  validSignature,
} from "../src/modules/payments/provider";
afterEach(() => vi.unstubAllEnvs());
describe("webhooks de sandbox", () => {
  const raw = JSON.stringify({
    eventId: "event",
    paymentId: "payment",
    amount: 1000,
    currency: "CRC",
    status: "CONFIRMED",
  });
  it("rechaza firma ausente, truncada y contenido alterado", () => {
    const signature = createHmac("sha256", "secret").update(raw).digest("hex");
    expect(validSignature(raw, signature, "secret")).toBe(true);
    expect(validSignature(raw + " ", signature, "secret")).toBe(false);
    expect(validSignature(raw, "", "secret")).toBe(false);
    expect(validSignature(raw, "aa", "secret")).toBe(false);
  });
  it("requiere secreto y valida moneda exacta", () => {
    const provider = new SandboxProvider();
    vi.stubEnv("SANDBOX_WEBHOOK_SECRET", "secret");
    const invalid = raw.replace("CRC", "USD");
    expect(() =>
      provider.verifyWebhook(
        invalid,
        createHmac("sha256", "secret").update(invalid).digest("hex"),
      ),
    ).toThrow();
    expect(
      provider.verifyWebhook(
        raw,
        createHmac("sha256", "secret").update(raw).digest("hex"),
      ).amount,
    ).toBe(1000);
  });
  it("no genera intenciones sandbox en producción", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      new SandboxProvider().createIntent({
        paymentId: "p",
        amount: 100,
        returnUrl: "https://example.test",
      }),
    ).rejects.toThrow();
  });
});
