/** Schedule as produced by a parser, before it is stored. Times are local to the conference timezone. */
export interface ParsedTalk {
  title: string;
  speakers: string;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface ParsedSession {
  title: string;
  room: string;
  chair?: string;
  date: string; // "YYYY-MM-DD"
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  talks: ParsedTalk[];
}

export interface ParsedSchedule {
  conferenceName?: string;
  timezone?: string;
  sessions: ParsedSession[];
}

/** Stored rows. All *_utc / taken_at values are ISO-8601 UTC strings. */
export interface Conference {
  id: number;
  name: string;
  timezone: string;
  created_at: string;
}

export interface Session {
  id: number;
  conference_id: number;
  title: string;
  room: string;
  chair: string | null;
  start_utc: string;
  end_utc: string;
}

export interface Talk {
  id: number;
  session_id: number;
  conference_id: number;
  title: string;
  speakers: string;
  start_utc: string;
  end_utc: string;
  position: number;
}

export type TimeSource = "exif-offset" | "exif" | "file" | "capture" | "manual" | "none";
export type PhotoStatus = "assigned" | "needs_choice" | "unassigned";

export interface Photo {
  id: number;
  conference_id: number;
  session_id: number | null;
  talk_id: number | null;
  uploader: string;
  original_name: string;
  file: string;
  thumb: string;
  original: string;
  width: number;
  height: number;
  taken_at: string | null;
  time_source: TimeSource;
  status: PhotoStatus;
  candidates: string; // JSON array of session ids
  caption: string | null;
  source_ref: string | null;
  created_at: string;
}

export interface Note {
  id: number;
  conference_id: number;
  talk_id: number;
  author: string;
  text: string;
  created_at: string;
}
