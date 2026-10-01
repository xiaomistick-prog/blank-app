import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { SCREENER_CACHE_TAG } from "@/lib/data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || expected.length < 32) return NextResponse.json({ error: "Revalidación no configurada" }, { status: 503 });
  const header = request.headers.get("authorization");
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  revalidateTag(SCREENER_CACHE_TAG, "max");
  revalidatePath("/", "layout");
  return NextResponse.json({ revalidated: true, mode: "stale-while-revalidate" }, { headers: { "Cache-Control": "no-store" } });
}
