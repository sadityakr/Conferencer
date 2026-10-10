import type { ParsedSchedule, ParsedSession, ParsedTalk } from "../types";
import type { PdfRow } from "./pdfText";
import { BREAK_RE, guessYear, isRoom, parseDateLine, TIME_RANGE, to24, toMin } from "./textParser";

/**
 * Layout-aware parser for programmes printed as a table, one talk per row:
 *
 *   09:00-10:00, Lecture Hall N1 | AI4Sci: Chemistry | AI4Sci16 | Title that      | First Author*; Second
 *                                |                   |          | wraps onto more | Author (Affiliation)
 *
 * Columns are inferred from where cells of time-stamped rows start. Wrapped lines (rows
 * just below, without a time) are appended to the matching column. Consecutive talks
 * sharing room and session name become one session.
 */

const ID_RE = /^[A-Z][A-Za-z0-9]{0,10}\d{1,4}$/; // paper codes like DS123, AI4Sci16

interface Rec {
  date: string;
  start: string;
  end: string;
  first: string; // text after the time in the first column (room, or event name)
  cols: string[][]; // text per column (index 0 = first column)
  id: string | null;
}

function columnStarts(anchors: PdfRow[]): number[] {
  const xs: number[] = [];
  for (const r of anchors) for (const c of r.cells) if (!ID_RE.test(c.text)) xs.push(c.x);
  xs.sort((a, b) => a - b);
  // Cluster starts within 4pt and keep clusters used by at least a quarter of the rows.
  const clusters: { x: number; n: number }[] = [];
  for (const x of xs) {
    const last = clusters[clusters.length - 1];
    if (last && x - last.x <= 4) last.n++;
    else clusters.push({ x, n: 1 });
  }
  return clusters.filter((c) => c.n >= Math.max(2, anchors.length * 0.25)).map((c) => c.x);
}

const colOf = (starts: number[], x: number) => {
  let i = 0;
  while (i + 1 < starts.length && starts[i + 1] <= x + 2) i++;
  return i;
};

/** Put a cell into its column. Paper codes ("DS004", or "DS004 First title line") are pulled out. */
function place(rec: Rec, starts: number[], c: { text: string; x: number }) {
  if (ID_RE.test(c.text)) {
    rec.id ??= c.text;
    return;
  }
  const m = c.text.match(/^([A-Z][A-Za-z0-9]{0,10}\d{2,4})\s+(.+)$/);
  if (m) {
    // Codes are often right-aligned in front of the title column, so use the nearest column start.
    rec.id ??= m[1];
    const nearest = starts.reduce((best, x, i) => (Math.abs(x - c.x) < Math.abs(starts[best] - c.x) ? i : best), 0);
    rec.cols[Math.max(nearest, colOf(starts, c.x))].push(m[2]);
    return;
  }
  rec.cols[colOf(starts, c.x)].push(c.text);
}

const join = (parts: string[]) => parts.join(" ").replace(/(\w)- (\w)/g, "$1-$2").replace(/\s+/g, " ").trim();

export function parseScheduleTable(rows: PdfRow[], opts: { defaultYear?: number } = {}): ParsedSchedule {
  const year = opts.defaultYear ?? guessYear(rows.map((r) => r.cells.map((c) => c.text).join(" ")));
  const startsWithTime = (r: PdfRow) => !!r.cells[0] && TIME_RANGE.test(r.cells[0].text) && r.cells[0].text.search(TIME_RANGE) === 0;
  const anchors = rows.filter(startsWithTime);
  const starts = columnStarts(anchors);
  if (anchors.length < 3 || starts.length < 3) return { sessions: [] };

  const recs: Rec[] = [];
  let date: string | null = null;
  let cur: Rec | null = null;
  let prev: PdfRow | null = null;

  for (const row of rows) {
    const text = row.cells.map((c) => c.text).join(" ");
    const d = row.cells.length <= 2 ? parseDateLine(text, year) : null;
    const isContinuation = cur && prev && prev.page === row.page && prev.y - row.y <= row.h * 1.6 && !startsWithTime(row) && !d;
    if (isContinuation) {
      for (const c of row.cells) place(cur!, starts, c);
      prev = row;
      continue;
    }
    prev = row;
    cur = null;
    if (d) {
      date = d;
      continue;
    }
    if (!date || !startsWithTime(row)) continue;

    const tr = row.cells[0].text.match(TIME_RANGE)!;
    const end = to24(tr[4], tr[5], tr[6]);
    let start = to24(tr[1], tr[2], tr[3] ?? tr[6]);
    if (!tr[3] && toMin(start) > toMin(end)) start = to24(tr[1], tr[2]);
    if (toMin(end) <= toMin(start)) continue;
    const rec: Rec = { date, start, end, first: "", cols: starts.map(() => []), id: null };
    rec.first = row.cells[0].text.slice(tr[0].length).replace(/^[\s,|;–-]+/, "");
    for (const c of row.cells.slice(1)) place(rec, starts, c);
    if (BREAK_RE.test(rec.first)) continue;
    recs.push(rec);
    cur = rec;
  }

  // Column roles: first = time/room, last = speakers, second = session (when there are 4+), rest = title.
  const n = starts.length;
  const sessions: ParsedSession[] = [];
  for (const r of recs) {
    const extra = join(r.cols[0]); // wrapped room text, rare
    let room = join([r.first, extra]);
    const cells = r.cols.slice(1).map(join);
    let sessionName = n >= 4 ? cells[0] : "";
    let title = join(n >= 4 ? cells.slice(1, -1) : cells.slice(0, -1));
    let speakers = cells[cells.length - 1] ?? "";
    if (!isRoom(room) && !(room && room.length <= 25 && (sessionName || title))) {
      // An event without a room ("19:00-23:00 | Welcome Reception in …"): the text is the title.
      title = join([room, sessionName, title]);
      sessionName = "";
      room = "Other";
    }
    room ||= "Main";
    if (!title) {
      title = speakers || sessionName || "Untitled";
      speakers = title === speakers ? "" : speakers;
    }
    if (r.id) title = `${title} (${r.id})`;
    const talk: ParsedTalk = { title, speakers, start: r.start, end: r.end };

    const last = sessions[sessions.length - 1];
    const sameSession =
      last &&
      last.date === r.date &&
      last.room === room &&
      sessionName &&
      last.title === sessionName &&
      toMin(r.start) >= toMin(last.end) - 1 &&
      toMin(r.start) - toMin(last.end) <= 15;
    // Parallel tracks are listed one after the other, so also look further back.
    const open = sameSession
      ? last
      : sessions.findLast(
          (s) => s.date === r.date && s.room === room && sessionName && s.title === sessionName && toMin(r.start) >= toMin(s.end) - 1 && toMin(r.start) - toMin(s.end) <= 15,
        );
    if (open) {
      open.talks.push(talk);
      open.end = r.end;
    } else {
      sessions.push({ title: sessionName || title, room, date: r.date, start: r.start, end: r.end, talks: [talk] });
    }
  }
  return { sessions };
}
