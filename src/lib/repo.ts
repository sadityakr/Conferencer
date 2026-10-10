import { getDb } from "./db";
import { localToUtc } from "./time";
import type { Conference, Note, ParsedSchedule, Photo, Session, Talk } from "./types";

export function createConference(name: string, timezone: string, schedule: ParsedSchedule): number {
  const db = getDb();
  return db.transaction(() => {
    const confId = Number(db.prepare("INSERT INTO conferences (name, timezone) VALUES (?, ?)").run(name, timezone).lastInsertRowid);
    replaceScheduleRows(confId, timezone, schedule);
    return confId;
  })();
}

function replaceScheduleRows(confId: number, tz: string, schedule: ParsedSchedule) {
  const db = getDb();
  const insS = db.prepare("INSERT INTO sessions (conference_id, title, room, chair, start_utc, end_utc) VALUES (?, ?, ?, ?, ?, ?)");
  const insT = db.prepare(
    "INSERT INTO talks (session_id, conference_id, title, speakers, start_utc, end_utc, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const s of schedule.sessions) {
    const sid = Number(
      insS.run(confId, s.title, s.room, s.chair ?? null, localToUtc(s.date, s.start, tz), localToUtc(s.date, s.end, tz)).lastInsertRowid,
    );
    s.talks.forEach((t, i) => insT.run(sid, confId, t.title, t.speakers, localToUtc(s.date, t.start, tz), localToUtc(s.date, t.end, tz), i));
  }
}

export function listConferences(): (Conference & { sessions: number; photos: number })[] {
  return getDb()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM sessions s WHERE s.conference_id = c.id) AS sessions,
              (SELECT COUNT(*) FROM photos p WHERE p.conference_id = c.id) AS photos
       FROM conferences c ORDER BY c.id DESC`,
    )
    .all() as (Conference & { sessions: number; photos: number })[];
}

export function getConference(id: number): Conference | undefined {
  return getDb().prepare("SELECT * FROM conferences WHERE id = ?").get(id) as Conference | undefined;
}

export function getSessions(confId: number): Session[] {
  return getDb().prepare("SELECT * FROM sessions WHERE conference_id = ? ORDER BY start_utc, room").all(confId) as Session[];
}

export function getTalks(confId: number): Talk[] {
  return getDb().prepare("SELECT * FROM talks WHERE conference_id = ? ORDER BY start_utc, position").all(confId) as Talk[];
}

export function getTalk(id: number): Talk | undefined {
  return getDb().prepare("SELECT * FROM talks WHERE id = ?").get(id) as Talk | undefined;
}

export function getSession(id: number): Session | undefined {
  return getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Session | undefined;
}

export function getPhotos(confId: number, filter: { status?: string; uploader?: string } = {}): Photo[] {
  let sql = "SELECT * FROM photos WHERE conference_id = ?";
  const args: unknown[] = [confId];
  if (filter.status) {
    sql += " AND status = ?";
    args.push(filter.status);
  }
  if (filter.uploader) {
    sql += " AND uploader = ?";
    args.push(filter.uploader);
  }
  return getDb().prepare(sql + " ORDER BY taken_at IS NULL, taken_at, id").all(...args) as Photo[];
}

export function getPhoto(id: number): Photo | undefined {
  return getDb().prepare("SELECT * FROM photos WHERE id = ?").get(id) as Photo | undefined;
}

export function getTalkPhotos(talkId: number): Photo[] {
  return getDb().prepare("SELECT * FROM photos WHERE talk_id = ? ORDER BY taken_at IS NULL, taken_at, id").all(talkId) as Photo[];
}

export function insertPhoto(p: Omit<Photo, "id" | "created_at" | "source_ref"> & { source_ref?: string | null }): number {
  return Number(
    getDb()
      .prepare(
        `INSERT INTO photos (conference_id, session_id, talk_id, uploader, original_name, file, thumb, original, width, height,
                             taken_at, time_source, status, candidates, caption, source_ref)
         VALUES (@conference_id, @session_id, @talk_id, @uploader, @original_name, @file, @thumb, @original, @width, @height,
                 @taken_at, @time_source, @status, @candidates, @caption, @source_ref)`,
      )
      .run({ source_ref: null, ...p }).lastInsertRowid,
  );
}

export function updatePhotoAssignment(
  id: number,
  a: { session_id: number | null; talk_id: number | null; status: Photo["status"]; candidates?: number[] },
): void {
  getDb()
    .prepare("UPDATE photos SET session_id = ?, talk_id = ?, status = ?, candidates = ? WHERE id = ?")
    .run(a.session_id, a.talk_id, a.status, JSON.stringify(a.candidates ?? []), id);
}

export function deletePhotoRow(id: number): void {
  getDb().prepare("DELETE FROM photos WHERE id = ?").run(id);
}

export function getPresence(confId: number, uploader: string): Set<number> {
  const rows = getDb().prepare("SELECT session_id FROM presence WHERE conference_id = ? AND uploader = ?").all(confId, uploader) as {
    session_id: number;
  }[];
  return new Set(rows.map((r) => r.session_id));
}

/**
 * Record that `uploader` attended `sessionId`. Any other session overlapping it in time is
 * forgotten, since nobody sits in two parallel sessions at once.
 */
export function setPresence(confId: number, uploader: string, sessionId: number): void {
  const db = getDb();
  const s = getSession(sessionId);
  if (!s) return;
  db.transaction(() => {
    db.prepare(
      `DELETE FROM presence WHERE conference_id = ? AND uploader = ? AND session_id IN (
         SELECT id FROM sessions WHERE conference_id = ? AND id != ? AND start_utc < ? AND end_utc > ?)`,
    ).run(confId, uploader, confId, sessionId, s.end_utc, s.start_utc);
    db.prepare("INSERT OR IGNORE INTO presence (conference_id, uploader, session_id) VALUES (?, ?, ?)").run(confId, uploader, sessionId);
  })();
}

export function getNotes(talkId: number): Note[] {
  return getDb().prepare("SELECT * FROM notes WHERE talk_id = ? ORDER BY created_at").all(talkId) as Note[];
}

export function getConferenceNotes(confId: number): Note[] {
  return getDb().prepare("SELECT * FROM notes WHERE conference_id = ? ORDER BY created_at").all(confId) as Note[];
}

export function addNote(confId: number, talkId: number, author: string, text: string): number {
  return Number(
    getDb().prepare("INSERT INTO notes (conference_id, talk_id, author, text) VALUES (?, ?, ?, ?)").run(confId, talkId, author, text)
      .lastInsertRowid,
  );
}

export function getUploaders(confId: number): string[] {
  return (
    getDb()
      .prepare("SELECT DISTINCT uploader FROM photos WHERE conference_id = ? UNION SELECT DISTINCT author FROM notes WHERE conference_id = ?")
      .all(confId, confId) as { uploader: string }[]
  )
    .map((r) => r.uploader)
    .sort();
}

export function hasSourceRef(confId: number, ref: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM photos WHERE conference_id = ? AND source_ref = ?").get(confId, ref);
}
