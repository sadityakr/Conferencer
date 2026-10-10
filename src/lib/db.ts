import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function dataDir(): string {
  return path.resolve(process.env.CONFERENCER_DATA_DIR ?? path.join(process.cwd(), "data"));
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conferences (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  conference_id INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  room TEXT NOT NULL,
  chair TEXT,
  start_utc TEXT NOT NULL,
  end_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS talks (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  conference_id INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  speakers TEXT NOT NULL DEFAULT '',
  start_utc TEXT NOT NULL,
  end_utc TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY,
  conference_id INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  talk_id INTEGER REFERENCES talks(id) ON DELETE SET NULL,
  uploader TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file TEXT NOT NULL,
  thumb TEXT NOT NULL,
  original TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  taken_at TEXT,
  time_source TEXT NOT NULL,
  status TEXT NOT NULL,
  candidates TEXT NOT NULL DEFAULT '[]',
  caption TEXT,
  source_ref TEXT, -- id in an external photo source (e.g. OneDrive item), for de-duplicating imports
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS photos_conf ON photos(conference_id, status);
CREATE INDEX IF NOT EXISTS photos_talk ON photos(talk_id);
CREATE UNIQUE INDEX IF NOT EXISTS photos_source ON photos(conference_id, source_ref) WHERE source_ref IS NOT NULL;
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  conference_id INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  talk_id INTEGER NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- "Which parallel session is this person in?" — learnt from their answers and live check-ins.
CREATE TABLE IF NOT EXISTS presence (
  conference_id INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  uploader TEXT NOT NULL,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  PRIMARY KEY (conference_id, uploader, session_id)
);
`;

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "conferencer.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

/** For tests: point at a fresh database. */
export function resetDbForTests(): void {
  db?.close();
  db = null;
}
