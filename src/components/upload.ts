"use client";

export interface UploadResult {
  name: string;
  photoId?: number;
  status?: "assigned" | "needs_choice" | "unassigned";
  skipped?: boolean;
  error?: string;
}

export interface UploadOptions {
  uploader: string;
  mode: "auto" | "capture" | "talk";
  talkId?: number;
  sessionId?: number;
  capturedAt?: number;
  /** Use capturedAt instead of the photo's own time. */
  forceTime?: boolean;
}

/** Upload in small batches so big camera rolls show progress and don't hit request limits. */
export async function uploadPhotos(
  confId: number,
  files: File[],
  opts: UploadOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  const BATCH = 4;
  for (let i = 0; i < files.length; i += BATCH) {
    const fd = new FormData();
    fd.set("uploader", opts.uploader);
    fd.set("mode", opts.mode);
    if (opts.talkId) fd.set("talkId", String(opts.talkId));
    if (opts.sessionId) fd.set("sessionId", String(opts.sessionId));
    if (opts.capturedAt) fd.set("capturedAt", String(opts.capturedAt));
    if (opts.forceTime) fd.set("forceTime", "1");
    for (const f of files.slice(i, i + BATCH)) {
      fd.append("files", f, f.name);
      fd.append("lastModified", String(f.lastModified));
    }
    const res = await fetch(`/api/conferences/${confId}/photos`, { method: "POST", body: fd });
    const body = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
    if (!res.ok) results.push(...files.slice(i, i + BATCH).map((f) => ({ name: f.name, error: body.error ?? "Upload failed" })));
    else results.push(...(body.results as UploadResult[]));
    onProgress?.(Math.min(i + BATCH, files.length), files.length);
  }
  return results;
}

export function summarize(results: UploadResult[]) {
  return {
    assigned: results.filter((r) => r.status === "assigned").length,
    needsChoice: results.filter((r) => r.status === "needs_choice").length,
    unassigned: results.filter((r) => r.status === "unassigned").length,
    skipped: results.filter((r) => r.skipped).length,
    errors: results.filter((r) => r.error).map((r) => r.error!),
  };
}
