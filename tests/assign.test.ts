import { describe, expect, it } from "vitest";
import { decide } from "@/lib/assign";

const S = (id: number, start: string, end: string) => ({ id, start_utc: `2026-10-12T${start}:00.000Z`, end_utc: `2026-10-12T${end}:00.000Z` });
const T = (id: number, session_id: number, start: string, end: string) => ({ ...S(id, start, end), session_id });
const at = (hhmm: string) => `2026-10-12T${hhmm}:00.000Z`;

const sessions = [S(1, "07:00", "08:00"), S(2, "08:30", "10:00"), S(3, "08:30", "10:00")];
const talks = [T(10, 1, "07:00", "08:00"), T(20, 2, "08:30", "09:00"), T(21, 2, "09:00", "09:30"), T(22, 2, "09:30", "10:00"), T(30, 3, "08:30", "10:00")];

describe("decide", () => {
  it("auto-assigns when exactly one session runs", () => {
    expect(decide(at("07:20"), sessions, talks)).toEqual({ status: "assigned", sessionId: 1, talkId: 10, via: "single" });
  });
  it("asks when parallel sessions run", () => {
    expect(decide(at("09:10"), sessions, talks)).toEqual({ status: "needs_choice", candidates: [2, 3] });
  });
  it("uses presence to settle parallel sessions and picks the talk by time", () => {
    expect(decide(at("09:10"), sessions, talks, new Set([2]))).toEqual({ status: "assigned", sessionId: 2, talkId: 21, via: "presence" });
  });
  it("counts a few minutes after the end as still in the session", () => {
    expect(decide(at("08:05"), sessions, talks)).toMatchObject({ status: "assigned", sessionId: 1, talkId: 10 });
  });
  it("leaves breaks and unknown times unassigned", () => {
    expect(decide(at("08:15"), sessions, talks)).toEqual({ status: "unassigned", reason: "no_session" });
    expect(decide(null, sessions, talks)).toEqual({ status: "unassigned", reason: "no_time" });
  });
  it("prefers a running session over one merely within grace", () => {
    const back2back = [S(1, "07:00", "08:00"), S(2, "08:00", "09:00")];
    expect(decide(at("08:03"), back2back, [])).toMatchObject({ status: "assigned", sessionId: 2, talkId: null });
  });
});
