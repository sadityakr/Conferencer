/**
 * Generate public/samples/toy-schedule.pdf and public/samples/photos/*.jpg (with EXIF capture times)
 * so the whole flow can be tried without a real conference.
 *
 *   npm run samples
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
// @ts-expect-error piexifjs has no types
import piexif from "piexifjs";
import { TOY } from "./toyConference";

// piexifjs predates EXIF 2.31; teach it OffsetTimeOriginal.
piexif.TAGS.Exif[0x9011] ??= { name: "OffsetTimeOriginal", type: "Ascii" };

const OUT = path.resolve(process.argv[2] ?? "public/samples");

export async function makeSchedulePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.4, 0.45);
  let page = doc.addPage([595, 842]);
  let y = 800;
  const line = (cols: [number, string][], size: number, font = reg, color = ink) => {
    if (y < 50) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
    for (const [x, t] of cols) page.drawText(t, { x, y, size, font, color });
    y -= size * 1.6;
  };
  line([[40, TOY.name]], 16, bold);
  line([[40, `Programme · All times local · Time zone: ${TOY.timezone}`]], 9, reg, muted);
  y -= 6;
  for (const day of TOY.days) {
    y -= 8;
    line([[40, day.date]], 13, bold);
    for (const it of day.items) {
      if (it.kind === "break") {
        line([[40, it.time], [120, it.title]], 9, reg, muted);
        continue;
      }
      y -= 3;
      line([[40, it.time], [120, it.room], [195, it.title], [440, `Chair: ${it.chair}`]], 10, bold);
      for (const t of it.talks) line([[56, t.time], [195, t.title], [440, t.speakers]], 9);
    }
  }
  return doc.save();
}

function slideSvg(title: string, sub: string, hue: number): Buffer {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <rect width="1200" height="800" fill="hsl(${hue},45%,30%)"/>
    <rect x="80" y="80" width="1040" height="640" rx="16" fill="hsl(${hue},40%,92%)"/>
    <text x="120" y="220" font-family="sans-serif" font-size="54" font-weight="bold" fill="#222">${esc(title)}</text>
    <text x="120" y="300" font-family="sans-serif" font-size="34" fill="#555">${esc(sub)}</text>
  </svg>`);
}

/** EXIF wall-clock time ("2026:10:12 10:40:00"), optionally with an OffsetTimeOriginal tag. */
export async function makePhoto(title: string, sub: string, hue: number, exifTime?: string, offset?: string): Promise<Buffer> {
  const jpeg = await sharp(slideSvg(title, sub, hue)).jpeg({ quality: 80 }).toBuffer();
  if (!exifTime) return jpeg;
  const exif: Record<number, string> = { [piexif.ExifIFD.DateTimeOriginal]: exifTime };
  if (offset) exif[0x9011] = offset; // OffsetTimeOriginal (EXIF 2.31)
  const bytes = piexif.dump({ "0th": { [piexif.ImageIFD.Make]: "ToyCam" }, Exif: exif });
  return Buffer.from(piexif.insert(bytes, jpeg.toString("binary")), "binary");
}

export const SAMPLE_PHOTOS: { file: string; who: string; title: string; sub: string; exif?: string; offset?: string; note: string }[] = [
  { file: "alice_01_keynote.jpg", who: "Alice", title: "Why every photo needs a timestamp", sub: "Opening keynote", exif: "2026:10:12 09:12:00", note: "single session → auto" },
  { file: "alice_02_coffee.jpg", who: "Alice", title: "Coffee break", sub: "Queue at the espresso machine", exif: "2026:10:12 10:15:00", note: "break → unsorted" },
  { file: "alice_03_parallel.jpg", who: "Alice", title: "Topological magnons", sub: "Room A or Room B?", exif: "2026:10:12 10:41:00", note: "parallel → ask" },
  { file: "alice_04_parallel.jpg", who: "Alice", title: "Moiré excitons", sub: "same session as before", exif: "2026:10:12 11:07:00", note: "parallel → follows answer" },
  { file: "alice_05_parallel.jpg", who: "Alice", title: "Spin qubits reality check", sub: "same session", exif: "2026:10:12 11:44:00", note: "parallel → follows answer" },
  { file: "bob_01_parallel.jpg", who: "Bob", title: "Active nematics", sub: "Bob was in Room B", exif: "2026:10:12 11:10:00", note: "parallel → ask Bob" },
  { file: "bob_02_offset.jpg", who: "Bob", title: "Lit-RAG over conference books", sub: "EXIF with +02:00 offset", exif: "2026:10:12 14:05:00", offset: "+02:00", note: "3 parallel → ask" },
  { file: "bob_03_day2.jpg", who: "Bob", title: "From pictures to knowledge", sub: "Closing keynote", exif: "2026:10:13 11:20:00", note: "day 2 plenary → auto" },
  { file: "carol_01_no_exif.jpg", who: "Carol", title: "Screenshot without EXIF", sub: "falls back to file time", note: "no EXIF → file time / manual" },
];

async function main() {
  await fs.mkdir(path.join(OUT, "photos"), { recursive: true });
  await fs.writeFile(path.join(OUT, "toy-schedule.pdf"), await makeSchedulePdf());
  let hue = 10;
  for (const p of SAMPLE_PHOTOS) {
    await fs.writeFile(path.join(OUT, "photos", p.file), await makePhoto(p.title, p.sub, (hue += 37) % 360, p.exif, p.offset));
  }
  console.log(`Wrote ${OUT}/toy-schedule.pdf and ${SAMPLE_PHOTOS.length} photos to ${OUT}/photos`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("make-samples.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
