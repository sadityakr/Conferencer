import type { VlmProvider } from "../vlm/provider";
import type { ParsedSchedule } from "../types";
import { normalizeSchedule } from "./normalize";

const SYSTEM = `You convert conference programmes into structured JSON. Reply with JSON only.`;

const INSTRUCTIONS = `Extract every session and talk from the conference programme below.
Return a JSON object of this exact shape:
{
  "conferenceName": string,
  "timezone": string | null,          // IANA name, e.g. "Europe/Berlin", only if stated
  "sessions": [{
    "title": string, "room": string, "chair": string | null,
    "date": "YYYY-MM-DD", "start": "HH:mm", "end": "HH:mm",   // 24h local time
    "talks": [{ "title": string, "speakers": string, "start": "HH:mm", "end": "HH:mm" }]
  }]
}
Rules: parallel sessions are separate entries with their own room. Skip coffee/lunch breaks.
A keynote or plenary without a session wrapper is a session with a single talk.`;

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("VLM reply did not contain a JSON object");
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Ask a VLM to structure the schedule. We send the extracted text (cheap, works with any
 * model) and, when given, rendered page images so layout-heavy PDFs can be read visually.
 */
export async function parseScheduleWithVlm(
  provider: VlmProvider,
  lines: string[],
  pageImages: { mime: string; data: Uint8Array }[] = [],
): Promise<ParsedSchedule> {
  const reply = await provider.complete({
    system: SYSTEM,
    prompt: `${INSTRUCTIONS}\n\n--- PROGRAMME TEXT ---\n${lines.join("\n")}`,
    images: pageImages,
    json: true,
  });
  return normalizeSchedule(extractJson(reply));
}
