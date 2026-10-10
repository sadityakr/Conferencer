import type { ParsedSchedule, ParsedSession, ParsedTalk } from "../types";

const HHMM = /^(\d{1,2}):(\d{2})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function hhmm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(HHMM);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v.trim() : fallback);

/** Validate untrusted schedule JSON (from a VLM or an upload) and drop anything malformed. */
export function normalizeSchedule(input: unknown): ParsedSchedule {
  const obj = (input ?? {}) as Record<string, unknown>;
  const sessions: ParsedSession[] = [];
  for (const s of Array.isArray(obj.sessions) ? obj.sessions : []) {
    const r = s as Record<string, unknown>;
    const start = hhmm(r.start);
    const end = hhmm(r.end);
    const date = str(r.date);
    if (!start || !end || !DATE.test(date) || end <= start) continue;
    const talks: ParsedTalk[] = [];
    for (const t of Array.isArray(r.talks) ? r.talks : []) {
      const k = t as Record<string, unknown>;
      const ts = hhmm(k.start);
      const te = hhmm(k.end);
      const title = str(k.title);
      if (!ts || !te || te <= ts || !title) continue;
      talks.push({ title, speakers: str(k.speakers), start: ts, end: te });
    }
    sessions.push({
      title: str(r.title) || "Untitled session",
      room: str(r.room) || "Main",
      chair: str(r.chair) || undefined,
      date,
      start,
      end,
      talks,
    });
  }
  return {
    conferenceName: str(obj.conferenceName) || undefined,
    timezone: str(obj.timezone) || undefined,
    sessions,
  };
}
