import fs from "node:fs/promises";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import * as repo from "./repo";
import { absolutePath } from "./storage";
import { fmtDay, fmtTime, localDate } from "./time";
import type { Note, Photo, Session, Talk } from "./types";

export interface BookOptions {
  /** Only this person's photos and notes (personal book). Omit for the group book. */
  uploader?: string;
  /** Include talks that have no photos or notes. */
  includeEmptyTalks?: boolean;
}

const W = 595.28; // A4
const H = 841.89;
const M = 48;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.44, 0.5);
const ACCENT = rgb(0.31, 0.33, 0.78);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Standard PDF fonts only cover WinAnsi; replace anything else so generation never fails. */
function makeSafe(font: PDFFont) {
  const cache = new Map<string, string>();
  const encodable = (ch: string) => {
    try {
      font.encodeText(ch);
      return true;
    } catch {
      return false;
    }
  };
  return (text: string) =>
    Array.from(text.normalize("NFC"))
      .map((ch) => {
        if (!cache.has(ch)) {
          const base = ch.normalize("NFD")[0]; // e.g. "ő" → "o"
          cache.set(ch, encodable(ch) ? ch : base && encodable(base) ? base : "?");
        }
        return cache.get(ch)!;
      })
      .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

class Writer {
  page!: PDFPage;
  y = 0;
  readonly safe: (s: string) => string;
  constructor(
    readonly doc: PDFDocument,
    readonly f: Fonts,
    private header: () => string,
  ) {
    this.safe = makeSafe(f.regular);
  }
  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.y = H - M;
    const h = this.header();
    if (h) {
      this.page.drawText(this.safe(h), { x: M, y: H - 28, size: 8, font: this.f.regular, color: MUTED });
    }
  }
  ensure(space: number) {
    if (this.y - space < M) this.newPage();
  }
  text(s: string, size: number, opts: { bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const font = opts.bold ? this.f.bold : this.f.regular;
    for (const line of wrap(this.safe(s), font, size, W - 2 * M)) {
      this.ensure(size * 1.35);
      this.page.drawText(line, { x: M, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= size * 1.35;
    }
    this.y -= opts.gap ?? 0;
  }
}

interface TalkEntry {
  talk: Talk | null; // null = photos assigned to the session but not a specific talk
  session: Session;
  photos: Photo[];
  notes: Note[];
}

export async function buildBook(confId: number, opts: BookOptions = {}): Promise<Uint8Array> {
  const conf = repo.getConference(confId);
  if (!conf) throw new Error("Conference not found");
  const tz = conf.timezone;
  const sessions = repo.getSessions(confId);
  const talks = repo.getTalks(confId);
  const photos = repo.getPhotos(confId, { uploader: opts.uploader });
  const notes = repo.getConferenceNotes(confId).filter((n) => !opts.uploader || n.author === opts.uploader);

  // Group by talk, in schedule order.
  const entries: TalkEntry[] = [];
  for (const s of sessions) {
    const sTalks = talks.filter((t) => t.session_id === s.id);
    const loose = photos.filter((p) => p.status === "assigned" && p.session_id === s.id && p.talk_id === null);
    if (loose.length) entries.push({ talk: null, session: s, photos: loose, notes: [] });
    for (const t of sTalks) {
      const e = { talk: t, session: s, photos: photos.filter((p) => p.talk_id === t.id), notes: notes.filter((n) => n.talk_id === t.id) };
      if (opts.includeEmptyTalks || e.photos.length || e.notes.length) entries.push(e);
    }
  }
  entries.sort((a, b) => (a.talk?.start_utc ?? a.session.start_utc).localeCompare(b.talk?.start_utc ?? b.session.start_utc) || a.session.room.localeCompare(b.session.room));
  const unsorted = photos.filter((p) => p.status !== "assigned");

  const doc = await PDFDocument.create();
  doc.setTitle(`${conf.name} — conference book`);
  doc.setCreator("Conferencer");
  const fonts: Fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  let header = "";
  const w = new Writer(doc, fonts, () => header);

  // Cover
  w.newPage();
  w.y = H * 0.62;
  w.text(conf.name, 30, { bold: true, gap: 10 });
  if (sessions.length) {
    const first = fmtDay(sessions[0].start_utc, tz);
    const last = fmtDay(sessions[sessions.length - 1].end_utc, tz);
    w.text(first === last ? first : `${first} – ${last}`, 13, { color: MUTED, gap: 18 });
  }
  const people = [...new Set(photos.map((p) => p.uploader))].sort();
  w.text(opts.uploader ? `Personal conference book of ${opts.uploader}` : "Group conference book", 14, { bold: true, color: ACCENT, gap: 4 });
  w.text(`${photos.length} photo${photos.length === 1 ? "" : "s"} · ${entries.filter((e) => e.talk).length} talks`, 11, { color: MUTED, gap: 4 });
  if (!opts.uploader && people.length) w.text(`Contributors: ${people.join(", ")}`, 11, { color: MUTED });

  // Body; contents pages are inserted afterwards once page numbers are known.
  const toc: { day: string; label: string; page: number }[] = [];
  let day = "";
  for (const e of entries) {
    const start = e.talk?.start_utc ?? e.session.start_utc;
    const end = e.talk?.end_utc ?? e.session.end_utc;
    const thisDay = localDate(start, tz);
    header = `${conf.name} · ${fmtDay(start, tz)}`;
    w.newPage();
    if (thisDay !== day) {
      day = thisDay;
      w.text(fmtDay(start, tz).toUpperCase(), 9, { bold: true, color: ACCENT, gap: 6 });
    }
    w.text(`${fmtTime(start, tz)}–${fmtTime(end, tz)} · ${e.session.room} · ${e.session.title}`, 9.5, { color: MUTED, gap: 4 });
    w.text(e.talk ? e.talk.title : "Session photos", 17, { bold: true, gap: 2 });
    if (e.talk?.speakers) w.text(e.talk.speakers, 11, { color: ACCENT, gap: 2 });
    if (!e.talk && e.session.chair) w.text(`Chair: ${e.session.chair}`, 11, { color: ACCENT, gap: 2 });
    toc.push({ day: fmtDay(start, tz), label: `${fmtTime(start, tz)}  ${e.talk?.title ?? `${e.session.title} (session photos)`}`, page: doc.getPageCount() });
    w.y -= 8;
    for (const n of e.notes) w.text(`“${n.text}” — ${n.author}`, 10.5, { gap: 4 });
    await drawPhotos(w, e.photos, tz, !opts.uploader);
  }

  if (unsorted.length) {
    header = `${conf.name} · Unsorted`;
    w.newPage();
    w.text("Unsorted photos", 17, { bold: true, gap: 2 });
    w.text("Taken outside any session or not yet placed.", 10.5, { color: MUTED, gap: 8 });
    toc.push({ day: "", label: "Unsorted photos", page: doc.getPageCount() });
    await drawPhotos(w, unsorted, tz, !opts.uploader);
  }

  await insertContents(doc, fonts, w.safe, toc);
  return doc.save();
}

async function drawPhotos(w: Writer, photos: Photo[], tz: string, showUploader: boolean) {
  const gap = 14;
  const colW = (W - 2 * M - gap) / 2;
  const maxH = 220;
  for (let i = 0; i < photos.length; i += 2) {
    const row = photos.slice(i, i + 2);
    const imgs = await Promise.all(row.map(async (p) => w.doc.embedJpg(await fs.readFile(absolutePath(p.file)))));
    const heights = imgs.map((img) => Math.min(maxH, (img.height / img.width) * colW));
    const rowH = Math.max(...heights) + 16;
    w.ensure(rowH);
    imgs.forEach((img, j) => {
      const h = heights[j];
      const iw = (img.width / img.height) * h;
      const x = M + j * (colW + gap);
      w.page.drawImage(img, { x, y: w.y - h, width: iw, height: h });
      const p = row[j];
      const when = p.taken_at ? fmtTime(p.taken_at, tz) : "time unknown";
      const cap = [when, showUploader ? p.uploader : "", p.caption ?? ""].filter(Boolean).join(" · ");
      w.page.drawText(w.safe(cap).slice(0, 80), { x, y: w.y - h - 11, size: 8, font: w.f.regular, color: MUTED });
    });
    w.y -= rowH + 6;
  }
}

async function insertContents(
  doc: PDFDocument,
  f: Fonts,
  safe: (s: string) => string,
  toc: { day: string; label: string; page: number }[],
) {
  // Rows: one per entry plus a heading per day.
  const rows: { text: string; page?: number; heading?: boolean }[] = [];
  let day: string | null = null;
  for (const t of toc) {
    if (t.day !== day) {
      day = t.day;
      if (t.day) rows.push({ text: t.day, heading: true });
    }
    rows.push({ text: t.label, page: t.page });
  }
  const perPage = Math.floor((H - 2 * M - 40) / 16);
  const nPages = Math.max(1, Math.ceil(rows.length / perPage));
  for (let p = 0; p < nPages; p++) {
    const page = doc.insertPage(1 + p, [W, H]);
    let y = H - M;
    if (p === 0) {
      page.drawText("Contents", { x: M, y: y - 20, size: 20, font: f.bold, color: INK });
      y -= 40;
    }
    for (const r of rows.slice(p * perPage, (p + 1) * perPage)) {
      if (r.heading) {
        page.drawText(safe(r.text.toUpperCase()), { x: M, y: y - 14, size: 9, font: f.bold, color: ACCENT });
      } else {
        const num = String((r.page ?? 0) + nPages);
        let label = safe(r.text);
        while (label.length > 4 && f.regular.widthOfTextAtSize(label, 10) > W - 2 * M - 40) label = label.slice(0, -2);
        if (label !== safe(r.text)) label = label.trimEnd() + "…";
        page.drawText(label, { x: M + 8, y: y - 14, size: 10, font: f.regular, color: INK });
        page.drawText(num, { x: W - M - f.regular.widthOfTextAtSize(num, 10), y: y - 14, size: 10, font: f.regular, color: MUTED });
      }
      y -= 16;
    }
  }
}
