import { NextRequest, NextResponse } from "next/server";
import { hasCredential, setCredential } from "@/lib/credentials-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/credentials?names=A,B -> presence for each (names + booleans only). */
export async function GET(req: NextRequest) {
  const names = (req.nextUrl.searchParams.get("names") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return NextResponse.json(names.map((name) => ({ name, present: hasCredential(name) })));
}

/**
 * POST /api/credentials { name, value } -> stores a credential in the runtime
 * store (server-side). The value comes straight from a masked field to the local
 * server; it NEVER passes through the chat or the LLM.
 */
export async function POST(req: NextRequest) {
  let name = "";
  let value = "";
  try {
    const body = await req.json();
    name = String(body?.name ?? "").trim();
    value = String(body?.value ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!name || !value) {
    return NextResponse.json({ error: "name and value are required." }, { status: 400 });
  }
  setCredential(name, value);
  return NextResponse.json({ ok: true, name, present: true });
}
