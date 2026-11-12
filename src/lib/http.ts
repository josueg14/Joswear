import { NextRequest, NextResponse } from "next/server.js";
import { z } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected = new URL(process.env.APP_URL || req.url).origin;
  if (!origin || origin !== expected)
    throw new HttpError(403, "Origen de solicitud inválido");
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Se requiere JSON");
}
export async function jsonBody(req: NextRequest) {
  if (Number(req.headers.get("content-length") || 0) > 100_000)
    throw new HttpError(413, "Solicitud demasiado grande");
  const raw = (await readLimited(req, 100_000)).toString("utf8");
  if (Buffer.byteLength(raw) > 100_000)
    throw new HttpError(413, "Solicitud demasiado grande");
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "JSON inválido");
  }
}
export async function readLimited(
  req: NextRequest,
  limit: number,
): Promise<Buffer> {
  if (!req.body) return Buffer.alloc(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new HttpError(413, "Solicitud demasiado grande");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export function fail(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: error.issues.map((x) => x.message).join(". ") },
      { status: 400 },
    );
  if (typeof error === "object" && error && "code" in error) {
    if (error.code === "P2002")
      return NextResponse.json(
        { error: "Ya existe un registro con esa clave, usuario o SKU." },
        { status: 409 },
      );
    if (error.code === "P2003")
      return NextResponse.json(
        {
          error:
            "Este registro está relacionado con otros datos y no se puede eliminar.",
        },
        { status: 409 },
      );
    if (error.code === "P2025")
      return NextResponse.json(
        { error: "El registro ya no está disponible." },
        { status: 404 },
      );
    if (error.code === "P2034")
      return NextResponse.json(
        { error: "Los datos cambiaron durante la operación. Reintentá." },
        { status: 409 },
      );
  }
  // Never return database errors, tokens, SQL, or credentials to the client.
  return NextResponse.json(
    {
      error:
        "No se pudo completar la operación. Revisá la configuración o intentá de nuevo.",
    },
    { status: 503 },
  );
}
export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
