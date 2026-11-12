import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  hashToken,
  newToken,
} from "../src/lib/cryptography";
afterEach(() => vi.unstubAllEnvs());
describe("protección de secretos MFA y sesiones", () => {
  it("cifra con IV distinto, autentica y rechaza alteraciones", () => {
    vi.stubEnv("MFA_ENCRYPTION_KEY", "c3".repeat(32));
    const value = "TESTSECRET";
    const first = encryptSecret(value);
    expect(first).not.toBe(encryptSecret(value));
    expect(decryptSecret(first)).toBe(value);
    const [iv, tag, content] = first.split(".");
    expect(() =>
      decryptSecret(
        `${iv}.${tag}.${content.slice(0, -2)}${(parseInt(content.slice(-2), 16) ^ 1).toString(16).padStart(2, "0")}`,
      ),
    ).toThrow();
  });
  it("no admite una clave MFA ausente", () => {
    vi.stubEnv("MFA_ENCRYPTION_KEY", "");
    expect(() => encryptSecret("x")).toThrow();
  });
  it("genera tokens aleatorios y almacena su digest", () => {
    const first = newToken();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(newToken());
    expect(hashToken(first)).not.toBe(first);
  });
});
