import exifr from "exifr";
import { decide, pickTalk } from "./assign";
import * as repo from "./repo";
import { resolveCaptureTime } from "./time";
import { storeImage, UnsupportedImageError } from "./storage";
import type { Photo } from "./types";

export interface IncomingPhoto {
  name: string;
  data: Uint8Array;
  lastModified?: number | null;
  /** Overrides the batch uploader, e.g. the OneDrive user who added the file. */
  uploader?: string;
  /** Stable id in an external source; photos already imported are skipped. */
  sourceRef?: string;
}

/**
 * How photos arrive:
 *  - auto:    batch upload; match each photo by its capture time
 *  - capture: free capture in the app; like auto, but "now" is a fallback capture time. If the
 *             user said which of the parallel sessions they are in, that is remembered first.
 *  - talk:    the user opened a talk and added photos to it directly
 */
export type UploadMode =
  | { kind: "auto" }
  | { kind: "capture"; capturedAt: number; sessionId?: number; forceTime?: boolean }
  | { kind: "talk"; talkId: number };

export interface IngestResult {
  name: string;
  photoId?: number;
  status?: Photo["status"];
  skipped?: boolean;
  error?: string;
}

export async function readExifTime(data: Uint8Array): Promise<{ dateTime: string | null; offset: string | null }> {
  try {
    const tags = (await exifr.parse(Buffer.from(data), {
      tiff: true,
      exif: true,
      gps: false,
      interop: false,
      ifd1: false,
      reviveValues: false,
      translateValues: false,
    })) as Record<string, unknown> | undefined;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
      dateTime: str(tags?.DateTimeOriginal) ?? str(tags?.CreateDate) ?? str(tags?.DateTime),
      offset: str(tags?.OffsetTimeOriginal) ?? str(tags?.OffsetTime),
    };
  } catch {
    return { dateTime: null, offset: null };
  }
}

export async function ingestPhotos(confId: number, uploader: string, files: IncomingPhoto[], mode: UploadMode): Promise<IngestResult[]> {
  const conf = repo.getConference(confId);
  if (!conf) throw new Error("Conference not found");
  const sessions = repo.getSessions(confId);
  const talks = repo.getTalks(confId);

  let fixedTalk: { talkId: number; sessionId: number } | null = null;
  if (mode.kind === "talk") {
    const t = repo.getTalk(mode.talkId);
    if (!t || t.conference_id !== confId) throw new Error("Talk not found");
    fixedTalk = { talkId: t.id, sessionId: t.session_id };
    repo.setPresence(confId, uploader, t.session_id);
  }
  if (mode.kind === "capture" && mode.sessionId) {
    const s = repo.getSession(mode.sessionId);
    if (!s || s.conference_id !== confId) throw new Error("Session not found");
    repo.setPresence(confId, uploader, s.id);
  }
  const presenceCache = new Map<string, Set<number>>();
  const presenceOf = (u: string) => {
    if (!presenceCache.has(u)) presenceCache.set(u, repo.getPresence(confId, u));
    return presenceCache.get(u)!;
  };

  const results: IngestResult[] = [];
  for (const f of files) {
    const who = f.uploader?.trim() || uploader;
    if (f.sourceRef && repo.hasSourceRef(confId, f.sourceRef)) {
      results.push({ name: f.name, skipped: true });
      continue;
    }
    try {
      const exif = await readExifTime(f.data);
      const time =
        mode.kind === "capture" && mode.forceTime
          ? { takenAt: new Date(mode.capturedAt).toISOString(), source: "manual" as const }
          : resolveCaptureTime(
        {
          exifDateTime: exif.dateTime,
          exifOffset: exif.offset,
          capturedAt: mode.kind === "capture" ? mode.capturedAt : null,
          fileLastModified: f.lastModified,
        },
        conf.timezone,
      );
      const img = await storeImage(confId, f.name, f.data);

      let assignment: Pick<Photo, "session_id" | "talk_id" | "status"> & { candidates: number[] };
      if (fixedTalk) {
        assignment = { session_id: fixedTalk.sessionId, talk_id: fixedTalk.talkId, status: "assigned", candidates: [] };
      } else {
        const d = decide(time.takenAt, sessions, talks, presenceOf(who));
        assignment =
          d.status === "assigned"
            ? { session_id: d.sessionId, talk_id: d.talkId, status: "assigned", candidates: [] }
            : d.status === "needs_choice"
              ? { session_id: null, talk_id: null, status: "needs_choice", candidates: d.candidates }
              : { session_id: null, talk_id: null, status: "unassigned", candidates: [] };
      }

      const photoId = repo.insertPhoto({
        conference_id: confId,
        uploader: who,
        original_name: f.name,
        ...img,
        taken_at: time.takenAt,
        time_source: time.source,
        session_id: assignment.session_id,
        talk_id: assignment.talk_id,
        status: assignment.status,
        candidates: JSON.stringify(assignment.candidates),
        caption: null,
        source_ref: f.sourceRef ?? null,
      });
      results.push({ name: f.name, photoId, status: assignment.status });
    } catch (e) {
      results.push({ name: f.name, error: e instanceof UnsupportedImageError ? e.message : `${f.name}: ${(e as Error).message}` });
    }
  }
  return results;
}

export type ResolveTarget = { sessionId: number } | { talkId: number };

/**
 * The user told us where some photos belong. Assign them, remember the choice as the
 * uploader's presence, and re-run matching for their other undecided photos — one answer
 * usually settles a whole batch.
 */
export function resolvePhotos(confId: number, photoIds: number[], target: ResolveTarget): { updated: number; cascaded: number } {
  const talks = repo.getTalks(confId);
  let sessionId: number;
  let talkId: number | null = null;
  if ("talkId" in target) {
    const t = repo.getTalk(target.talkId);
    if (!t || t.conference_id !== confId) throw new Error("Talk not found");
    sessionId = t.session_id;
    talkId = t.id;
  } else {
    const s = repo.getSession(target.sessionId);
    if (!s || s.conference_id !== confId) throw new Error("Session not found");
    sessionId = s.id;
  }

  const uploaders = new Set<string>();
  let updated = 0;
  for (const id of photoIds) {
    const p = repo.getPhoto(id);
    if (!p || p.conference_id !== confId) continue;
    const tId = talkId ?? (p.taken_at ? pickTalk(talks, sessionId, p.taken_at) : null);
    repo.updatePhotoAssignment(id, { session_id: sessionId, talk_id: tId, status: "assigned" });
    // Only a choice between parallel sessions tells us where the person was.
    if (p.status === "needs_choice") uploaders.add(p.uploader);
    updated++;
  }

  let cascaded = 0;
  for (const u of uploaders) {
    repo.setPresence(confId, u, sessionId);
    cascaded += rematch(confId, u);
  }
  return { updated, cascaded };
}

/** Re-run matching for an uploader's undecided photos using what we now know about them. */
export function rematch(confId: number, uploader: string): number {
  const sessions = repo.getSessions(confId);
  const talks = repo.getTalks(confId);
  const presence = repo.getPresence(confId, uploader);
  let n = 0;
  for (const p of repo.getPhotos(confId, { status: "needs_choice", uploader })) {
    const d = decide(p.taken_at, sessions, talks, presence);
    if (d.status === "assigned") {
      repo.updatePhotoAssignment(p.id, { session_id: d.sessionId, talk_id: d.talkId, status: "assigned" });
      n++;
    }
  }
  return n;
}

export function unassignPhoto(confId: number, photoId: number): void {
  const p = repo.getPhoto(photoId);
  if (!p || p.conference_id !== confId) throw new Error("Photo not found");
  repo.updatePhotoAssignment(photoId, { session_id: null, talk_id: null, status: "unassigned" });
}
