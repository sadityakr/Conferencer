import { NextResponse } from "next/server";
import { addNote, getTalk } from "@/lib/repo";
import { bad, cleanName, intParam } from "@/lib/http";

export const runtime = "nodejs";

/** Add a text entry to a talk: { talkId, author, text } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const confId = intParam((await ctx.params).id);
  const body = (await req.json().catch(() => null)) as { talkId?: number; author?: string; text?: string } | null;
  const author = cleanName(body?.author);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 4000) : "";
  const talk = Number.isInteger(body?.talkId) ? getTalk(body!.talkId!) : undefined;
  if (!confId || !talk || talk.conference_id !== confId) return bad("Talk not found", 404);
  if (!author) return bad("Tell us your name first.");
  if (!text) return bad("Note is empty.");
  return NextResponse.json({ id: addNote(confId, talk.id, author, text) });
}
