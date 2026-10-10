import { buildBook } from "@/lib/book";
import { getConference } from "@/lib/repo";
import { bad, cleanName, intParam } from "@/lib/http";

export const runtime = "nodejs";

/** GET ?uploader=Alice for a personal book, &empty=1 to include talks without photos. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const confId = intParam((await ctx.params).id);
  const conf = confId ? getConference(confId) : undefined;
  if (!conf) return bad("Conference not found", 404);
  const url = new URL(req.url);
  const uploader = cleanName(url.searchParams.get("uploader")) ?? undefined;
  const pdf = await buildBook(conf.id, { uploader, includeEmptyTalks: url.searchParams.get("empty") === "1" });
  const fname = `${conf.name}${uploader ? ` - ${uploader}` : ""} - conference book.pdf`.replace(/[^\w .()-]+/g, "_");
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${fname}"`,
      "cache-control": "no-store",
    },
  });
}
