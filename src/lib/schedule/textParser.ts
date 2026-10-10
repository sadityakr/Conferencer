import { DateTime } from "luxon";
import type { ParsedSchedule, ParsedSession, ParsedTalk } from "../types";

/**
 * Heuristic, line-based schedule parser. It works on reasonably clean programmes
 * where every session and talk line carries a time range, e.g.
 *
 *   Monday, 12 October 2026
 *   09:00–10:30 | Room A | Session A1: Quantum Materials | Chair: J. Doe
 *   09:00–09:30 | Topological magnons in thin films | A. Author, B. Author
 *
 * Messy real-world PDFs (multi-column grids, scanned pages) are what the VLM parser is for.
 */

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const WEEKDAY = "(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?,?\\s*";

const TIME = "(\\d{1,2})[:.h](\\d{2})\\s*(am|pm)?";
const TIME_RANGE = new RegExp(`${TIME}\\s*(?:[-–—]|to)\\s*${TIME}`, "i");

const ROOM_WORDS = "room|hall|auditorium|aula|theatre|theater|salon|track|hörsaal|raum|saal|ballroom|stage";
// "Room A", "Hall 2", "Track 3" — or "Main Hall", "Seminar Room 1.04", "Lecture Theatre B".
const ROOM_START = new RegExp(`^(?:${ROOM_WORDS})\\b`, "i");
const ROOM_END = new RegExp(`\\b(?:${ROOM_WORDS})(?:\\s+[\\w.-]{1,5})?$`, "i");
const isRoom = (f: string) => f.length <= 30 && (ROOM_START.test(f) || ROOM_END.test(f));
const SESSION_RE = /\b(session|symposium|plenary|keynote session|workshop|tutorial|poster)\b/i;
const CHAIR_RE = /^(chair|chairs|chaired by|moderator)\s*:?\s*/i;
const BREAK_RE = /^(coffee|lunch|break|registration|dinner|reception|welcome drinks|end of day)\b/i;

function to24(h: string, m: string, ampm?: string): string {
  let hh = parseInt(h, 10);
  if (ampm) {
    const pm = ampm.toLowerCase() === "pm";
    if (pm && hh < 12) hh += 12;
    if (!pm && hh === 12) hh = 0;
  }
  return `${String(hh).padStart(2, "0")}:${m}`;
}

export function parseDateLine(line: string, defaultYear?: number): string | null {
  const s = line.trim();
  if (TIME_RANGE.test(s) || s.length > 60) return null;
  let m = s.match(/^(?:.*?\b)?(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // "Monday, 12 October 2026" / "12 Oct 2026" / "Mon 12 Oct"
  m = s.match(new RegExp(`^(?:${WEEKDAY})?(\\d{1,2})\\.?\\s+(${MONTHS})\\.?,?\\s*(\\d{4})?$`, "i"));
  if (m) return mkDate(m[1], m[2], m[3] ?? defaultYear);
  // "Monday, October 12, 2026" / "October 12"
  m = s.match(new RegExp(`^(?:${WEEKDAY})?(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?$`, "i"));
  if (m) return mkDate(m[2], m[1], m[3] ?? defaultYear);
  return null;
}

function mkDate(day: string, month: string, year?: string | number): string | null {
  if (!year) return null;
  const dt = DateTime.fromFormat(`${day} ${month.slice(0, 3)} ${year}`, "d LLL yyyy", { locale: "en" });
  return dt.isValid ? dt.toISODate() : null;
}

function splitFields(rest: string): string[] {
  return rest
    .split(/\s*\|\s*|\s{2,}|\t/)
    .map((f) => f.trim())
    .filter(Boolean);
}

function splitTitleSpeakers(fields: string[]): { title: string; speakers: string } {
  if (fields.length >= 2) return { title: fields[0], speakers: fields.slice(1).join(", ") };
  const one = fields[0] ?? "";
  const m = one.match(/^(.*?)\s+[—–-]\s+(.*)$/);
  if (m) return { title: m[1].trim(), speakers: m[2].trim() };
  return { title: one, speakers: "" };
}

const toMin = (hhmm: string) => parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3), 10);

export function parseScheduleText(lines: string[], opts: { defaultYear?: number } = {}): ParsedSchedule {
  const out: ParsedSchedule = { sessions: [] };
  let date: string | null = null;
  let current: ParsedSession | null = null;
  let year = opts.defaultYear;

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const tz = line.match(/time\s*zone\s*[:\-]?\s*([A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)/i);
    if (tz) {
      out.timezone = tz[1];
      continue;
    }

    const d = parseDateLine(line, year);
    if (d) {
      date = d;
      year = parseInt(d.slice(0, 4), 10);
      current = null;
      continue;
    }

    const tr = line.match(TIME_RANGE);
    if (!tr) {
      if (!out.conferenceName && out.sessions.length === 0 && !date) out.conferenceName = line;
      else if (current && CHAIR_RE.test(line)) current.chair = line.replace(CHAIR_RE, "");
      continue;
    }
    if (!date) continue;

    const end = to24(tr[4], tr[5], tr[6]);
    // "1:00–2:30 pm": the start inherits the end's am/pm unless that would put it after the end ("11:00–12:30 pm").
    let start = to24(tr[1], tr[2], tr[3] ?? tr[6]);
    if (!tr[3] && toMin(start) > toMin(end)) start = to24(tr[1], tr[2]);
    if (toMin(end) <= toMin(start)) continue;
    const rest = (line.slice(0, tr.index) + " | " + line.slice(tr.index! + tr[0].length)).replace(/^[\s|]+|[\s|]+$/g, "");
    const fields = splitFields(rest);
    if (fields.length === 0) continue;

    const roomIdx = fields.findIndex(isRoom);
    const chairIdx = fields.findIndex((f) => CHAIR_RE.test(f));
    const isSession = roomIdx >= 0 || SESSION_RE.test(fields[0]);

    if (isSession) {
      const room = roomIdx >= 0 ? fields[roomIdx] : "Main";
      const title = fields.filter((_, i) => i !== roomIdx && i !== chairIdx).join(" – ") || room;
      current = {
        title,
        room,
        chair: chairIdx >= 0 ? fields[chairIdx].replace(CHAIR_RE, "") : undefined,
        date,
        start,
        end,
        talks: [],
      };
      out.sessions.push(current);
      continue;
    }

    if (BREAK_RE.test(fields[0])) {
      current = null;
      continue;
    }

    const talk: ParsedTalk = { ...splitTitleSpeakers(fields), start, end };
    const fits = (s: ParsedSession) => s.date === date && toMin(s.start) <= toMin(start) && toMin(end) <= toMin(s.end);
    let owner: ParsedSession | undefined = current && fits(current) ? current : undefined;
    if (!owner) {
      const options = out.sessions.filter(fits);
      if (options.length === 1) owner = options[0];
    }
    if (owner) {
      owner.talks.push(talk);
    } else {
      // A stand-alone item (e.g. a keynote) becomes its own single-talk session.
      current = { title: talk.title, room: "Main", date, start, end, talks: [talk] };
      out.sessions.push(current);
    }
  }
  return out;
}
