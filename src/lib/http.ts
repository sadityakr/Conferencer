import { NextResponse } from "next/server";

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function intParam(v: string | null | undefined): number | null {
  if (!v || !/^\d+$/.test(v)) return null;
  return parseInt(v, 10);
}

/** Display names are free text; keep them short and printable. */
export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60);
  return s || null;
}
