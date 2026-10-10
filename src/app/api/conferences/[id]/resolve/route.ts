import { NextResponse } from "next/server";
import { resolvePhotos, unassignPhoto } from "@/lib/photos";
import { bad, intParam } from "@/lib/http";

export const runtime = "nodejs";

/** Place photos: { photoIds: number[], sessionId?: number, talkId?: number, unassign?: true } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const confId = intParam((await ctx.params).id);
  if (!confId) return bad("Conference not found", 404);
  const body = (await req.json().catch(() => null)) as { photoIds?: unknown; sessionId?: unknown; talkId?: unknown; unassign?: unknown } | null;
  const ids = Array.isArray(body?.photoIds) ? body.photoIds.filter((n): n is number => Number.isInteger(n)) : [];
  if (ids.length === 0) return bad("photoIds missing");
  try {
    if (body?.unassign === true) {
      ids.forEach((id) => unassignPhoto(confId, id));
      return NextResponse.json({ updated: ids.length, cascaded: 0 });
    }
    if (Number.isInteger(body?.talkId)) return NextResponse.json(resolvePhotos(confId, ids, { talkId: body!.talkId as number }));
    if (Number.isInteger(body?.sessionId)) return NextResponse.json(resolvePhotos(confId, ids, { sessionId: body!.sessionId as number }));
    return bad("Give a sessionId or talkId");
  } catch (e) {
    return bad((e as Error).message);
  }
}
