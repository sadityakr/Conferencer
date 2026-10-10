import { NextResponse } from "next/server";
import { ingestPhotos, type IncomingPhoto, type UploadMode } from "@/lib/photos";
import { getConference } from "@/lib/repo";
import { bad, cleanName, intParam } from "@/lib/http";

export const runtime = "nodejs";

const MAX_FILE = 40 * 1024 * 1024;

/**
 * Upload photos. Form fields:
 *   uploader, mode = auto | capture | talk, talkId (talk mode),
 *   sessionId + capturedAt + forceTime=1 (capture mode; forceTime uses capturedAt instead of EXIF),
 *   files (repeated), lastModified (repeated, same order as files; from File.lastModified)
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const confId = intParam((await ctx.params).id);
  if (!confId || !getConference(confId)) return bad("Conference not found", 404);
  const form = await req.formData();
  const uploader = cleanName(form.get("uploader"));
  if (!uploader) return bad("Tell us your name first.");

  let mode: UploadMode;
  const kind = String(form.get("mode") ?? "auto");
  if (kind === "talk") {
    const talkId = intParam(String(form.get("talkId") ?? ""));
    if (!talkId) return bad("talkId missing");
    mode = { kind: "talk", talkId };
  } else if (kind === "capture") {
    const capturedAt = Number(form.get("capturedAt")) || Date.now();
    mode = {
      kind: "capture",
      capturedAt,
      sessionId: intParam(String(form.get("sessionId") ?? "")) ?? undefined,
      forceTime: form.get("forceTime") === "1",
    };
  } else {
    mode = { kind: "auto" };
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return bad("No photos attached.");
  const lastModified = form.getAll("lastModified").map((v) => Number(v) || null);

  const incoming: IncomingPhoto[] = [];
  const tooBig: string[] = [];
  for (const [i, f] of files.entries()) {
    if (f.size > MAX_FILE) tooBig.push(f.name);
    else incoming.push({ name: f.name, data: new Uint8Array(await f.arrayBuffer()), lastModified: lastModified[i] ?? f.lastModified ?? null });
  }
  try {
    const results = await ingestPhotos(confId, uploader, incoming, mode);
    return NextResponse.json({ results: [...results, ...tooBig.map((name) => ({ name, error: `${name}: larger than 40 MB` }))] });
  } catch (e) {
    return bad((e as Error).message);
  }
}
