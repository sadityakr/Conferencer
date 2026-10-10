import { describe, expect, it } from "vitest";
import { localToUtc, resolveCaptureTime } from "@/lib/time";

describe("localToUtc", () => {
  it("converts conference-local time to UTC (CEST = UTC+2 in October)", () => {
    expect(localToUtc("2026-10-12", "09:00", "Europe/Berlin")).toBe("2026-10-12T07:00:00.000Z");
  });
  it("handles the DST switch (CET = UTC+1 in November)", () => {
    expect(localToUtc("2026-11-02", "09:00", "Europe/Berlin")).toBe("2026-11-02T08:00:00.000Z");
  });
});

describe("resolveCaptureTime", () => {
  const tz = "Europe/Berlin";
  it("prefers EXIF with its own offset", () => {
    expect(resolveCaptureTime({ exifDateTime: "2026:10:12 09:15:00", exifOffset: "-04:00" }, tz)).toEqual({
      takenAt: "2026-10-12T13:15:00.000Z",
      source: "exif-offset",
    });
  });
  it("reads offset-less EXIF as conference wall-clock time", () => {
    expect(resolveCaptureTime({ exifDateTime: "2026:10:12 09:15:00", fileLastModified: 0 }, tz)).toEqual({
      takenAt: "2026-10-12T07:15:00.000Z",
      source: "exif",
    });
  });
  it("falls back to capture time, then file time, then nothing", () => {
    const ms = Date.UTC(2026, 9, 12, 8, 0);
    expect(resolveCaptureTime({ capturedAt: ms, fileLastModified: 1 }, tz).source).toBe("capture");
    expect(resolveCaptureTime({ exifDateTime: "garbage", fileLastModified: ms }, tz)).toEqual({ takenAt: "2026-10-12T08:00:00.000Z", source: "file" });
    expect(resolveCaptureTime({}, tz)).toEqual({ takenAt: null, source: "none" });
  });
});
