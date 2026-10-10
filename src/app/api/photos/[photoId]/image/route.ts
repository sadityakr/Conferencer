import fs from "node:fs/promises";
import { getPhoto } from "@/lib/repo";
import { absolutePath } from "@/lib/storage";
import { bad, intParam } from "@/lib/http";

export const runtime = "nodejs";

/** ?size=thumb (default) | full | original */
export async function GET(req: Request, ctx: { params: Promise<{ photoId: string }> }) {
  const id = intParam((await ctx.params).photoId);
  const photo = id ? getPhoto(id) : undefined;
  if (!photo) return bad("Not found", 404);
  const size = new URL(req.url).searchParams.get("size");
  const rel = size === "original" ? photo.original : size === "full" ? photo.file : photo.thumb;
  try {
    const data = await fs.readFile(absolutePath(rel));
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": size === "original" ? "application/octet-stream" : "image/jpeg",
        "cache-control": "private, max-age=31536000, immutable",
        ...(size === "original" ? { "content-disposition": `attachment; filename="${photo.original_name.replace(/"/g, "")}"` } : {}),
      },
    });
  } catch {
    return bad("Image file missing", 404);
  }
}
