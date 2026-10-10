import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp, { type OutputInfo } from "sharp";
import { dataDir } from "./db";

export interface StoredImage {
  file: string; // display JPEG, relative to data dir
  thumb: string;
  original: string;
  width: number;
  height: number;
}

const DISPLAY_PX = 1600;
const THUMB_PX = 480;

export class UnsupportedImageError extends Error {}

/** Keep the original, plus an upright display JPEG and a thumbnail. */
export async function storeImage(confId: number, name: string, data: Uint8Array): Promise<StoredImage> {
  const rel = path.join("photos", String(confId));
  const dir = path.join(dataDir(), rel);
  await fs.mkdir(dir, { recursive: true });
  const id = crypto.randomUUID();
  const ext = (path.extname(name).toLowerCase().match(/^\.[a-z0-9]{1,5}$/)?.[0]) ?? ".bin";

  let display: { data: Buffer; info: OutputInfo };
  let thumb: Buffer;
  try {
    const img = sharp(data, { failOn: "none" }).rotate();
    display = await img
      .clone()
      .resize({ width: DISPLAY_PX, height: DISPLAY_PX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    thumb = await img.clone().resize({ width: THUMB_PX, height: THUMB_PX, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
  } catch (e) {
    const heic = /\.(heic|heif)$/i.test(name);
    throw new UnsupportedImageError(
      heic
        ? `${name}: HEIC photos are not supported yet. Export them as JPEG (on iPhone: Settings → Camera → Formats → Most Compatible).`
        : `${name}: not a readable image (${(e as Error).message})`,
    );
  }

  const out = {
    file: path.join(rel, `${id}.jpg`),
    thumb: path.join(rel, `${id}_thumb.jpg`),
    original: path.join(rel, `${id}_orig${ext}`),
    width: display.info.width,
    height: display.info.height,
  };
  await Promise.all([
    fs.writeFile(path.join(dataDir(), out.file), display.data),
    fs.writeFile(path.join(dataDir(), out.thumb), thumb),
    fs.writeFile(path.join(dataDir(), out.original), data),
  ]);
  return out;
}

export function absolutePath(rel: string): string {
  const abs = path.resolve(dataDir(), rel);
  if (!abs.startsWith(dataDir() + path.sep)) throw new Error("Path escapes data dir");
  return abs;
}

export async function removeImage(img: Pick<StoredImage, "file" | "thumb" | "original">): Promise<void> {
  await Promise.all([img.file, img.thumb, img.original].map((f) => fs.rm(absolutePath(f), { force: true })));
}
