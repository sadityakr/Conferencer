import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { makePhoto, makeSchedulePdf, SAMPLE_PHOTOS } from "../scripts/make-samples";
import { resetDbForTests } from "@/lib/db";
import { parseSchedulePdf } from "@/lib/schedule";
import * as repo from "@/lib/repo";
import { ingestPhotos, resolvePhotos } from "@/lib/photos";
import { buildBook } from "@/lib/book";
import { OneDriveSource, encodeShareUrl } from "@/lib/sources/onedrive";

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "conferencer-"));
  process.env.CONFERENCER_DATA_DIR = dir;
  resetDbForTests();
});
afterAll(() => {
  resetDbForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function samplePhotos(who: string) {
  let hue = 0;
  return Promise.all(
    SAMPLE_PHOTOS.filter((p) => p.who === who).map(async (p) => ({
      name: p.file,
      data: new Uint8Array(await makePhoto(p.title, p.sub, (hue += 40), p.exif, p.offset)),
      lastModified: Date.parse("2026-10-20T10:00:00Z"), // copied to the laptop a week later
    })),
  );
}

describe("toy conference end to end", () => {
  let confId: number;
  const talkTitle = (id: number | null) => (id ? repo.getTalk(id)?.title : null);

  it("parses the toy schedule PDF into a conference", async () => {
    const { schedule } = await parseSchedulePdf(await makeSchedulePdf(), { parser: "text" });
    expect(schedule.timezone).toBe("Europe/Berlin");
    expect(schedule.sessions).toHaveLength(9);
    expect(schedule.sessions.reduce((n, s) => n + s.talks.length, 0)).toBe(19);
    confId = repo.createConference(schedule.conferenceName!, schedule.timezone!, schedule);
    expect(repo.getTalks(confId)).toHaveLength(19);
  });

  it("auto-assigns single-session photos and asks about parallel ones", async () => {
    const res = await ingestPhotos(confId, "Alice", await samplePhotos("Alice"), { kind: "auto" });
    expect(res.map((r) => [r.name, r.status])).toEqual([
      ["alice_01_keynote.jpg", "assigned"],
      ["alice_02_coffee.jpg", "unassigned"],
      ["alice_03_parallel.jpg", "needs_choice"],
      ["alice_04_parallel.jpg", "needs_choice"],
      ["alice_05_parallel.jpg", "needs_choice"],
    ]);
    expect(talkTitle(repo.getPhoto(res[0].photoId!)!.talk_id)).toBe("Why every photo needs a timestamp");
  });

  it("one answer settles the rest of that person's parallel-session photos", async () => {
    const pending = repo.getPhotos(confId, { status: "needs_choice", uploader: "Alice" });
    const roomA = repo.getSessions(confId).find((s) => s.title.startsWith("Session A1"))!;
    const out = resolvePhotos(confId, [pending[0].id], { sessionId: roomA.id });
    expect(out).toEqual({ updated: 1, cascaded: 2 });
    expect(pending.map((p) => talkTitle(repo.getPhoto(p.id)!.talk_id))).toEqual([
      "Topological magnons in thin films",
      "Moiré excitons at room temperature",
      "Spin qubits in silicon: a reality check",
    ]);
  });

  it("keeps other people's answers separate and honours EXIF offsets", async () => {
    const res = await ingestPhotos(confId, "Bob", await samplePhotos("Bob"), { kind: "auto" });
    expect(res.map((r) => r.status)).toEqual(["needs_choice", "needs_choice", "assigned"]);
    const offsetPhoto = repo.getPhoto(res[1].photoId!)!;
    expect(offsetPhoto.time_source).toBe("exif-offset");
    expect(JSON.parse(offsetPhoto.candidates)).toHaveLength(3);
  });

  it("falls back to file time when there is no EXIF", async () => {
    const [r] = await ingestPhotos(confId, "Carol", await samplePhotos("Carol"), { kind: "auto" });
    const p = repo.getPhoto(r.photoId!)!;
    expect([p.time_source, p.status]).toEqual(["file", "unassigned"]);
  });

  it("adds photos straight to a talk in live mode", async () => {
    const talk = repo.getTalks(confId).find((t) => t.title === "Hydrogels that remember")!;
    const [r] = await ingestPhotos(confId, "Dana", await samplePhotos("Carol"), { kind: "talk", talkId: talk.id });
    expect(repo.getPhoto(r.photoId!)).toMatchObject({ talk_id: talk.id, status: "assigned" });
    expect(repo.getPresence(confId, "Dana").has(talk.session_id)).toBe(true);
  });

  it("builds group and personal PDF books", async () => {
    repo.addNote(confId, repo.getTalks(confId)[0].id, "Alice", "Great opening — slides on the Zenodo page.");
    const group = await PDFDocument.load(await buildBook(confId));
    const alice = await PDFDocument.load(await buildBook(confId, { uploader: "Alice" }));
    expect(group.getTitle()).toContain("Toy Conference");
    // cover + contents + 4 Alice talks + Hydrogels + Bob's day-2 keynote + unsorted
    expect(group.getPageCount()).toBe(9);
    // cover + contents + 4 talks + unsorted (coffee)
    expect(alice.getPageCount()).toBe(7);
  });
});

describe("OneDrive source", () => {
  it("lists images in a shared folder via Microsoft Graph", async () => {
    const urls: string[] = [];
    const fakeFetch = (async (url: string) => {
      urls.push(url);
      if (url.includes("/children")) {
        return Response.json({
          value: [
            { id: "1", name: "IMG_1.jpg", file: { mimeType: "image/jpeg" }, createdBy: { user: { displayName: "Alice" } },
              parentReference: { driveId: "d" }, fileSystemInfo: { lastModifiedDateTime: "2026-10-12T08:00:00Z" },
              "@microsoft.graph.downloadUrl": "https://dl/1" },
            { id: "2", name: "notes.docx", file: { mimeType: "application/vnd.openxmlformats" }, "@microsoft.graph.downloadUrl": "https://dl/2" },
            { id: "3", name: "Day 2", folder: {} },
          ],
        });
      }
      return new Response(new Uint8Array([1, 2, 3]));
    }) as typeof fetch;
    const src = new OneDriveSource("https://contoso.sharepoint.com/:f:/s/team/abc", "token", fakeFetch);
    const items = await src.list();
    expect(urls[0]).toContain(`/shares/${encodeShareUrl("https://contoso.sharepoint.com/:f:/s/team/abc")}/driveItem/children`);
    expect(items.map((i) => [i.ref, i.name, i.uploader])).toEqual([["onedrive:d:1", "IMG_1.jpg", "Alice"]]);
    expect(await items[0].download()).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("explains what is missing without a token", async () => {
    await expect(new OneDriveSource("https://1drv.ms/f/x", undefined).list()).rejects.toThrow(/MS_GRAPH_TOKEN/);
  });
});
