import { NextResponse } from "next/server";
import { parseSchedulePdf } from "@/lib/schedule";
import { createConference } from "@/lib/repo";
import { isValidTimezone } from "@/lib/time";
import { bad } from "@/lib/http";

export const runtime = "nodejs";

/** Create a conference from a schedule PDF. Form fields: pdf, name?, timezone? */
export async function POST(req: Request) {
  const form = await req.formData();
  const pdf = form.get("pdf");
  if (!(pdf instanceof File) || pdf.size === 0) return bad("Please attach the schedule PDF.");
  if (pdf.size > 30 * 1024 * 1024) return bad("PDF is larger than 30 MB.");

  let result;
  try {
    result = await parseSchedulePdf(new Uint8Array(await pdf.arrayBuffer()));
  } catch (e) {
    return bad(`Could not read the PDF: ${(e as Error).message}`, 422);
  }
  const { schedule } = result;
  if (schedule.sessions.length === 0) {
    return bad("No sessions found in this PDF. The built-in parser needs time ranges like “10:30–12:00” on each line; try SCHEDULE_PARSER=vlm for complex layouts.", 422);
  }

  const name = String(form.get("name") ?? "").trim() || schedule.conferenceName || pdf.name.replace(/\.pdf$/i, "");
  const tz = String(form.get("timezone") ?? "").trim() || schedule.timezone || "UTC";
  if (!isValidTimezone(tz)) return bad(`Unknown timezone "${tz}".`);

  const id = createConference(name.slice(0, 200), tz, schedule);
  return NextResponse.json({
    id,
    sessions: schedule.sessions.length,
    talks: schedule.sessions.reduce((n, s) => n + s.talks.length, 0),
    parser: result.parser,
  });
}
