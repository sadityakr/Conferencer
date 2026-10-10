import { NextResponse } from "next/server";
import { ingestPhotos } from "@/lib/photos";
import { getConference } from "@/lib/repo";
import { OneDriveSource, isMicrosoftShareLink } from "@/lib/sources";
import { bad, cleanName, intParam } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Pull every photo from a shared OneDrive / Teams folder into the conference.
 * Each photo is credited to the person who added it to the folder; photos imported
 * before are skipped, so this can be re-run as the folder fills up.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const confId = intParam((await ctx.params).id);
  if (!confId || !getConference(confId)) return bad("Conference not found", 404);
  const body = (await req.json().catch(() => null)) as { url?: string; uploader?: string } | null;
  const url = body?.url?.trim() ?? "";
  const fallback = cleanName(body?.uploader) ?? "Shared folder";
  if (!isMicrosoftShareLink(url)) return bad("Paste a OneDrive, SharePoint or Teams folder link (1drv.ms, onedrive.live.com or *.sharepoint.com).");

  try {
    const remote = await new OneDriveSource(url).list();
    const results = [];
    for (const r of remote) {
      const data = await r.download();
      const [res] = await ingestPhotos(confId, fallback, [{ name: r.name, data, lastModified: r.lastModified, uploader: r.uploader ?? undefined, sourceRef: r.ref }], { kind: "auto" });
      results.push(res);
    }
    return NextResponse.json({ found: remote.length, results });
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}
