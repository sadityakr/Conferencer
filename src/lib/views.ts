import { DateTime } from "luxon";
import { getDb } from "./db";
import * as repo from "./repo";
import { fmtDay, fmtTime, localDate } from "./time";
import type { Conference, Photo } from "./types";

/** Serializable shapes handed from server pages to client components. */
export interface TalkOption {
  id: number;
  sessionId: number;
  label: string; // "Mon 10:30 · Room A · Title"
}

export interface SessionOption {
  id: number;
  title: string;
  room: string;
  start_utc: string;
  end_utc: string;
  label: string;
}

export interface PhotoView {
  id: number;
  uploader: string;
  takenAt: string | null;
  timeLabel: string;
  timeSource: Photo["time_source"];
  status: Photo["status"];
  candidates: number[];
  talkId: number | null;
  sessionId: number | null;
  name: string;
}

export function pendingByUploader(confId: number): Record<string, number> {
  const rows = getDb()
    .prepare("SELECT uploader, COUNT(*) AS n FROM photos WHERE conference_id = ? AND status = 'needs_choice' GROUP BY uploader")
    .all(confId) as { uploader: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.uploader, r.n]));
}

export function photoView(p: Photo, tz: string): PhotoView {
  const timeLabel = p.taken_at
    ? DateTime.fromISO(p.taken_at, { zone: "utc" }).setZone(tz).toFormat("ccc HH:mm")
    : "no time";
  return {
    id: p.id,
    uploader: p.uploader,
    takenAt: p.taken_at,
    timeLabel,
    timeSource: p.time_source,
    status: p.status,
    candidates: JSON.parse(p.candidates) as number[],
    talkId: p.talk_id,
    sessionId: p.session_id,
    name: p.original_name,
  };
}

export function talkOptions(conf: Conference): TalkOption[] {
  const sessions = new Map(repo.getSessions(conf.id).map((s) => [s.id, s]));
  return repo.getTalks(conf.id).map((t) => {
    const s = sessions.get(t.session_id)!;
    const day = DateTime.fromISO(t.start_utc, { zone: "utc" }).setZone(conf.timezone).toFormat("ccc HH:mm");
    return { id: t.id, sessionId: s.id, label: `${day} · ${s.room} · ${t.title}` };
  });
}

export function sessionOptions(conf: Conference): SessionOption[] {
  return repo.getSessions(conf.id).map((s) => ({
    id: s.id,
    title: s.title,
    room: s.room,
    start_utc: s.start_utc,
    end_utc: s.end_utc,
    label: `${fmtTime(s.start_utc, conf.timezone)}–${fmtTime(s.end_utc, conf.timezone)} · ${s.room}`,
  }));
}

export interface CalendarDay {
  date: string;
  label: string;
  rooms: string[];
  startMin: number;
  endMin: number;
  sessions: {
    id: number;
    title: string;
    room: string;
    chair: string | null;
    startMin: number;
    endMin: number;
    start_utc: string;
    end_utc: string;
    time: string;
    talks: { id: number; title: string; speakers: string; time: string; photos: number; notes: number }[];
    loosePhotos: number;
  }[];
}

export function calendar(conf: Conference): CalendarDay[] {
  const tz = conf.timezone;
  const talks = repo.getTalks(conf.id);
  const counts = new Map<number, number>();
  const loose = new Map<number, number>();
  for (const r of getDb()
    .prepare("SELECT talk_id, session_id, COUNT(*) AS n FROM photos WHERE conference_id = ? AND status = 'assigned' GROUP BY talk_id, session_id")
    .all(conf.id) as { talk_id: number | null; session_id: number; n: number }[]) {
    if (r.talk_id) counts.set(r.talk_id, r.n);
    else loose.set(r.session_id, r.n);
  }
  const noteCounts = new Map(
    (getDb().prepare("SELECT talk_id, COUNT(*) AS n FROM notes WHERE conference_id = ? GROUP BY talk_id").all(conf.id) as { talk_id: number; n: number }[]).map(
      (r) => [r.talk_id, r.n],
    ),
  );
  const minOfDay = (iso: string) => {
    const d = DateTime.fromISO(iso, { zone: "utc" }).setZone(tz);
    return d.hour * 60 + d.minute;
  };

  const days = new Map<string, CalendarDay>();
  for (const s of repo.getSessions(conf.id)) {
    const date = localDate(s.start_utc, tz);
    if (!days.has(date)) days.set(date, { date, label: fmtDay(s.start_utc, tz), rooms: [], startMin: 24 * 60, endMin: 0, sessions: [] });
    const day = days.get(date)!;
    const startMin = minOfDay(s.start_utc);
    // Sessions running past midnight are clipped to the end of the day.
    const endMin = localDate(s.end_utc, tz) === date ? minOfDay(s.end_utc) : 24 * 60;
    day.startMin = Math.min(day.startMin, startMin);
    day.endMin = Math.max(day.endMin, endMin);
    if (!day.rooms.includes(s.room)) day.rooms.push(s.room);
    day.sessions.push({
      id: s.id,
      title: s.title,
      room: s.room,
      chair: s.chair,
      startMin,
      endMin,
      start_utc: s.start_utc,
      end_utc: s.end_utc,
      time: `${fmtTime(s.start_utc, tz)}–${fmtTime(s.end_utc, tz)}`,
      loosePhotos: loose.get(s.id) ?? 0,
      talks: talks
        .filter((t) => t.session_id === s.id)
        .map((t) => ({
          id: t.id,
          title: t.title,
          speakers: t.speakers,
          time: `${fmtTime(t.start_utc, tz)}–${fmtTime(t.end_utc, tz)}`,
          photos: counts.get(t.id) ?? 0,
          notes: noteCounts.get(t.id) ?? 0,
        })),
    });
  }
  for (const d of days.values()) {
    d.rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    d.startMin = Math.floor(d.startMin / 30) * 30;
    d.endMin = Math.ceil(d.endMin / 30) * 30;
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
