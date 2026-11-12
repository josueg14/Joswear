import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { sanitizeImage } from "../src/modules/catalog/images";
describe("subida segura de imágenes", () => {
  it("rechaza SVG/HTML y cabeceras JPEG truncadas", async () => {
    await expect(
      sanitizeImage(Buffer.from('<svg onload="alert(1)"/>'), "image/svg+xml"),
    ).rejects.toThrow();
    await expect(
      sanitizeImage(Buffer.from([255, 216, 255, 1]), "image/jpeg"),
    ).rejects.toThrow();
  });
  it("decodifica, elimina metadatos y normaliza a WebP", async () => {
    const image = await sharp({
      create: { width: 20, height: 10, channels: 3, background: "#f4f0e9" },
    })
      .jpeg()
      .withMetadata()
      .toBuffer();
    const safe = await sanitizeImage(image, "image/jpeg");
    const metadata = await sharp(safe).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.width).toBe(20);
    await expect(sanitizeImage(image, "image/png")).rejects.toThrow();
  });
});
