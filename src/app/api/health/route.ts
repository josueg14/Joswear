import { db, isDemo } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET() {
  if (isDemo())
    return NextResponse.json(
      { status: "preview", database: "not-checked", commerce: "disabled" },
      { headers: { "Cache-Control": "no-store" } },
    );
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", database: "reachable" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable", database: "unreachable" },
      { status: 503 },
    );
  }
}
