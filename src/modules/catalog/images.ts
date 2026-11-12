import sharp from "sharp";
export async function sanitizeImage(bytes: Buffer, declaredType: string) {
  if (!bytes.length || bytes.length > 5_000_000) throw new Error("Máximo 5 MB");
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP";
  const actualType = png
    ? "image/png"
    : jpeg
      ? "image/jpeg"
      : webp
        ? "image/webp"
        : null;
  if (declaredType !== actualType) throw new Error("Tipo de imagen inválido");
  return sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" })
    .rotate()
    .resize({
      width: 3000,
      height: 3000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
}
