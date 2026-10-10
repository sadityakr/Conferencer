/**
 * Pure photo → session/talk matching. No I/O, so it is easy to test.
 *
 * A photo's capture time is compared with the schedule:
 *  - exactly one session running            → assigned automatically
 *  - several parallel sessions running      → if the uploader already told us which one they
 *                                             are in (presence), use it; otherwise ask them
 *  - nothing running (break, wrong day, no time) → unassigned, the user places it by hand
 */
export interface SessionSlot {
  id: number;
  start_utc: string;
  end_utc: string;
}

export interface TalkSlot {
  id: number;
  session_id: number;
  start_utc: string;
  end_utc: string;
}

export type Decision =
  | { status: "assigned"; sessionId: number; talkId: number | null; via: "single" | "presence" }
  | { status: "needs_choice"; candidates: number[] }
  | { status: "unassigned"; reason: "no_time" | "no_session" };

/** Minutes before a session starts / after it ends that still count as "in" it. */
export const DEFAULT_GRACE_MIN = 10;

const ms = (iso: string) => Date.parse(iso);

export function candidateSessions<S extends SessionSlot>(sessions: S[], takenAt: string, graceMin = DEFAULT_GRACE_MIN): S[] {
  const t = ms(takenAt);
  const strict = sessions.filter((s) => ms(s.start_utc) <= t && t < ms(s.end_utc));
  if (strict.length) return strict;
  const g = graceMin * 60_000;
  return sessions.filter((s) => ms(s.start_utc) - g <= t && t < ms(s.end_utc) + g);
}

export function pickTalk(talks: TalkSlot[], sessionId: number, takenAt: string, graceMin = DEFAULT_GRACE_MIN): number | null {
  const t = ms(takenAt);
  const own = talks.filter((k) => k.session_id === sessionId);
  const containing = own.find((k) => ms(k.start_utc) <= t && t < ms(k.end_utc));
  if (containing) return containing.id;
  // Slightly before the first talk or after the last one (questions, overruns): nearest talk within grace.
  let best: { id: number; dist: number } | null = null;
  for (const k of own) {
    const dist = t < ms(k.start_utc) ? ms(k.start_utc) - t : t - ms(k.end_utc);
    if (dist <= graceMin * 60_000 && (!best || dist < best.dist)) best = { id: k.id, dist };
  }
  return best?.id ?? null;
}

export function decide(
  takenAt: string | null,
  sessions: SessionSlot[],
  talks: TalkSlot[],
  presence: ReadonlySet<number> = new Set(),
  graceMin = DEFAULT_GRACE_MIN,
): Decision {
  if (!takenAt) return { status: "unassigned", reason: "no_time" };
  const cands = candidateSessions(sessions, takenAt, graceMin);
  if (cands.length === 0) return { status: "unassigned", reason: "no_session" };
  if (cands.length === 1) {
    return { status: "assigned", sessionId: cands[0].id, talkId: pickTalk(talks, cands[0].id, takenAt, graceMin), via: "single" };
  }
  const present = cands.filter((s) => presence.has(s.id));
  if (present.length === 1) {
    return { status: "assigned", sessionId: present[0].id, talkId: pickTalk(talks, present[0].id, takenAt, graceMin), via: "presence" };
  }
  return { status: "needs_choice", candidates: cands.map((s) => s.id).sort((a, b) => a - b) };
}
