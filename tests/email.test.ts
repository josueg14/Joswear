import { describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/db", () => ({ db: {} }));
import { renderEmail } from "../src/modules/email/service";
describe("plantillas de correo", () => {
  it("escapa contenido y no inserta enlaces de otro origen", () => {
    const email = renderEmail("order", {
      reference: "<script>alert(1)</script>",
      url: "https://evil.test/steal",
    });
    expect(email.htmlContent).not.toContain("<script>");
    expect(email.htmlContent).toContain("&lt;script&gt;");
    expect(email.htmlContent).not.toContain("evil.test");
  });
  it("incluye enlace seguro de verificación bajo el origen propio", () => {
    vi.stubEnv("APP_URL", "https://example.test");
    expect(
      renderEmail("verification", {
        url: "https://example.test/cuenta/verificar?token=test",
      }).htmlContent,
    ).toContain('href="https://example.test/');
    vi.unstubAllEnvs();
  });
});
