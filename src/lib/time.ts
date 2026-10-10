import { DateTime } from "luxon";
import type { TimeSource } from "./types";

/** Convert a local conference date + "HH:mm" to a UTC ISO string. */
export function localToUtc(date: string, hhmm: string, tz: string): string {
  const dt = DateTime.fromISO(`${date}T${hhmm}`, { zone: tz });
  if (!dt.isValid) throw new Error(`Invalid local time ${date} ${hhmm} (${tz}): ${dt.invalidExplanation}`);
  return dt.toUTC().toISO()!;
}

export function isValidTimezone(tz: string): boolean {
  return DateTime.local().setZone(tz).isValid;
}

export interface CaptureTimeInput {
  /** Raw EXIF DateTimeOriginal, e.g. "2026:10:12 09:15:00". */
  exifDateTime?: string | null;
  /** Raw EXIF OffsetTimeOriginal, e.g. "+02:00". */
  exifOffset?: string | null;
  /** Browser File.lastModified (ms since epoch). */
  fileLastModified?: number | null;
  /** Moment the photo was captured in the app (ms since epoch). */
  capturedAt?: number | null;
}

export interface CaptureTime {
  takenAt: string | null;
  source: TimeSource;
}

const EXIF_FORMATS = ["yyyy:MM:dd HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy:MM:dd HH:mm"];

function parseExif(raw: string, zone: string): DateTime | null {
  const s = raw.trim().replace(/\0/g, "");
  for (const f of EXIF_FORMATS) {
    const dt = DateTime.fromFormat(s, f, { zone });
    if (dt.isValid) return dt;
  }
  const iso = DateTime.fromISO(s, { zone });
  return iso.isValid ? iso : null;
}

/**
 * Work out when a photo was taken, in order of trust:
 *  1. EXIF time with its own UTC offset
 *  2. EXIF time interpreted in the conference timezone (cameras store local wall-clock time)
 *  3. in-app capture moment
 *  4. file modification time (unreliable: copying can change it)
 */
export function resolveCaptureTime(input: CaptureTimeInput, conferenceTz: string): CaptureTime {
  if (input.exifDateTime) {
    const offset = input.exifOffset?.trim();
    if (offset && /^[+-]\d{2}:\d{2}$/.test(offset)) {
      const dt = parseExif(input.exifDateTime, `UTC${offset}`);
      if (dt) return { takenAt: dt.toUTC().toISO(), source: "exif-offset" };
    }
    const dt = parseExif(input.exifDateTime, conferenceTz);
    if (dt) return { takenAt: dt.toUTC().toISO(), source: "exif" };
  }
  if (input.capturedAt) {
    return { takenAt: DateTime.fromMillis(input.capturedAt).toUTC().toISO(), source: "capture" };
  }
  if (input.fileLastModified) {
    return { takenAt: DateTime.fromMillis(input.fileLastModified).toUTC().toISO(), source: "file" };
  }
  return { takenAt: null, source: "none" };
}

export function fmtTime(utcIso: string, tz: string): string {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz).toFormat("HH:mm");
}

export function fmtDay(utcIso: string, tz: string): string {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz).toFormat("cccc, d LLLL yyyy");
}

export function localDate(utcIso: string, tz: string): string {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz).toISODate()!;
}
