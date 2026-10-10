import { describe, expect, it } from "vitest";
import { MockVlmProvider } from "@/lib/vlm/provider";
import { parseScheduleWithVlm } from "@/lib/schedule/vlmParser";

describe("parseScheduleWithVlm", () => {
  it("sends the programme text and validates the JSON reply", async () => {
    const provider = new MockVlmProvider(
      () => `Here you go:\n\`\`\`json
{"conferenceName":"X","timezone":"Europe/Berlin","sessions":[
 {"title":"S1","room":"Room A","date":"2026-10-12","start":"9:00","end":"10:00",
  "talks":[{"title":"T1","speakers":"A","start":"09:00","end":"09:30"},{"title":"bad","start":"10:00","end":"09:00"}]},
 {"title":"broken","room":"B","date":"12/10/2026","start":"09:00","end":"10:00"}
]}
\`\`\``,
    );
    const s = await parseScheduleWithVlm(provider, ["Programme line 1"]);
    expect(provider.calls[0].prompt).toContain("Programme line 1");
    expect(provider.calls[0].json).toBe(true);
    expect(s).toEqual({
      conferenceName: "X",
      timezone: "Europe/Berlin",
      sessions: [{ title: "S1", room: "Room A", chair: undefined, date: "2026-10-12", start: "09:00", end: "10:00", talks: [{ title: "T1", speakers: "A", start: "09:00", end: "09:30" }] }],
    });
  });
});
