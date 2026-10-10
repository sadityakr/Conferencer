import { NextResponse } from "next/server";
import { deletePhotoRow, getPhoto } from "@/lib/repo";
import { removeImage } from "@/lib/storage";
import { bad, cleanName, intParam } from "@/lib/http";

export const runtime = "nodejs";

/** Delete a photo. Only its uploader may (honour system until there is real login). */
export async function DELETE(req: Request, ctx: { params: Promise<{ photoId: string }> }) {
  const id = intParam((await ctx.params).photoId);
  const photo = id ? getPhoto(id) : undefined;
  if (!photo) return bad("Not found", 404);
  const who = cleanName(new URL(req.url).searchParams.get("uploader"));
  if (who !== photo.uploader) return bad("Only the person who uploaded a photo can delete it.", 403);
  deletePhotoRow(photo.id);
  await removeImage(photo);
  return NextResponse.json({ ok: true });
}
