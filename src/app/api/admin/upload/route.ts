import { NextRequest } from "next/server";
import { adminSession } from "@/lib/security";
import { fail, HttpError, ok, readLimited } from "@/lib/http";
import { sanitizeImage } from "@/modules/catalog/images";
export async function POST(req: NextRequest) {
  try {
    if (
      req.headers.get("origin") !==
      new URL(process.env.APP_URL || req.url).origin
    )
      throw new HttpError(403, "Origen inválido");
    await adminSession("products", "write");
    if (
      !process.env.STORAGE_UPLOAD_URL ||
      !process.env.STORAGE_UPLOAD_TOKEN ||
      !process.env.STORAGE_PUBLIC_ORIGIN
    )
      throw new HttpError(
        503,
        "Configurá el adaptador de almacenamiento externo",
      );
    if (Number(req.headers.get("content-length") || 0) > 5_300_000)
      throw new HttpError(413, "Máximo 5 MB");
    const body = await readLimited(req, 5_300_000);
    const file = (
      await new Response(new Uint8Array(body), {
        headers: { "content-type": req.headers.get("content-type") || "" },
      }).formData()
    ).get("file");
    if (!(file instanceof File) || file.size > 5_000_000 || !file.size)
      throw new HttpError(400, "Archivo inválido");
    let bytes: Buffer;
    try {
      bytes = await sanitizeImage(
        Buffer.from(await file.arrayBuffer()),
        file.type,
      );
    } catch {
      throw new HttpError(
        400,
        "Imagen inválida. Usá PNG, JPEG o WebP de hasta 5 MB y 40 megapíxeles.",
      );
    }
    const target = new URL(process.env.STORAGE_UPLOAD_URL);
    if (target.protocol !== "https:")
      throw new HttpError(503, "El almacenamiento requiere HTTPS");
    const response = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STORAGE_UPLOAD_TOKEN}`,
        "content-type": "image/webp",
      },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    });
    if (!response.ok)
      throw new HttpError(502, "El almacenamiento rechazó la imagen");
    const result = await response.json();
    if (
      typeof result.url !== "string" ||
      new URL(result.url).origin !==
        new URL(process.env.STORAGE_PUBLIC_ORIGIN).origin ||
      !result.url.startsWith("https://")
    )
      throw new HttpError(502, "URL de almacenamiento inválida");
    return ok({ url: result.url });
  } catch (error) {
    return fail(error);
  }
}
