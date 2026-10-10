import { describe, expect, it } from "vitest";
import { parseDateLine, parseScheduleText } from "@/lib/schedule/textParser";

describe("parseDateLine", () => {
  it.each([
    ["Monday, 12 October 2026", "2026-10-12"],
    ["12 Oct 2026", "2026-10-12"],
    ["Tuesday, October 13, 2026", "2026-10-13"],
    ["Wed 14th October 2026", null],
    ["2026-10-15", "2026-10-15"],
    ["10:30–12:00 | Room A", null],
  ])("%s → %s", (line, expected) => {
    expect(parseDateLine(line)).toBe(expected);
  });
  it("uses the default year when the line has none", () => {
    expect(parseDateLine("Thu 15 Oct", 2026)).toBe("2026-10-15");
  });
});

describe("parseScheduleText", () => {
  it("parses sessions, talks, breaks, keynotes and am/pm times", () => {
    const s = parseScheduleText([
      "Workshop on Things 2026",
      "Time zone: America/New_York",
      "October 12, 2026",
      "8:00 - 8:30 am Registration",
      "9:00 – 10:00 am  Opening keynote — Grace Hopper",
      "10:30 am - 12:00 pm | Seminar Room 2 | Session 1: Lasers",
      "Chair: T. Maiman",
      "10:30-11:15 am | Fast pulses | A. Strickland",
      "11:15 am-12:00 pm  Slow light — L. Hau",
      "1:00–2:30 pm | Main Hall | Poster session",
    ]);
    expect(s.conferenceName).toBe("Workshop on Things 2026");
    expect(s.timezone).toBe("America/New_York");
    expect(s.sessions).toEqual([
      { title: "Opening keynote", room: "Main", date: "2026-10-12", start: "09:00", end: "10:00", talks: [{ title: "Opening keynote", speakers: "Grace Hopper", start: "09:00", end: "10:00" }] },
      {
        title: "Session 1: Lasers", room: "Seminar Room 2", chair: "T. Maiman", date: "2026-10-12", start: "10:30", end: "12:00",
        talks: [
          { title: "Fast pulses", speakers: "A. Strickland", start: "10:30", end: "11:15" },
          { title: "Slow light", speakers: "L. Hau", start: "11:15", end: "12:00" },
        ],
      },
      { title: "Poster session", room: "Main Hall", chair: undefined, date: "2026-10-12", start: "13:00", end: "14:30", talks: [] },
    ]);
  });
});
