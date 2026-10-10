"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PhotoView, TalkOption } from "@/lib/views";
import { useName } from "./useName";

const SOURCE_LABEL: Record<PhotoView["timeSource"], string> = {
  "exif-offset": "",
  exif: "",
  capture: "captured in app",
  manual: "time set by hand",
  file: "time from file date – check",
  none: "no time",
};

export function PhotoGrid({ confId, photos, talks, currentTalkId }: { confId: number; photos: PhotoView[]; talks: TalkOption[]; currentTalkId?: number }) {
  const router = useRouter();
  const [name] = useName();
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(body: object) {
    const res = await fetch(`/api/conferences/${confId}/resolve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Failed");
    router.refresh();
  }
  async function remove(id: number) {
    if (!confirm("Delete this photo?")) return;
    const res = await fetch(`/api/photos/${id}?uploader=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Failed");
    router.refresh();
  }

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div className="grid">
        {photos.map((p) => (
          <figure key={p.id} className="thumb" style={{ margin: 0 }}>
            <a href={`/api/photos/${p.id}/image?size=full`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${p.id}/image`} alt={`Photo by ${p.uploader}`} loading="lazy" />
            </a>
            <figcaption className="cap">
              <span>{p.timeLabel}</span>·<span>{p.uploader}</span>
              {SOURCE_LABEL[p.timeSource] && <span className="badge warn">{SOURCE_LABEL[p.timeSource]}</span>}
              <span className="spacer" />
              <button className="ghost small" style={{ minHeight: 26, padding: "0 .4rem" }} onClick={() => setOpen(open === p.id ? null : p.id)} aria-label="Photo options">
                ⋯
              </button>
            </figcaption>
            {open === p.id && (
              <div className="stack" style={{ padding: ".45rem" }}>
                <select
                  aria-label="Move to talk"
                  defaultValue=""
                  onChange={(e) => e.target.value && post({ photoIds: [p.id], talkId: Number(e.target.value) })}
                >
                  <option value="">Move to talk…</option>
                  {talks.filter((t) => t.id !== currentTalkId).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <div className="row">
                  <button className="small" onClick={() => post({ photoIds: [p.id], unassign: true })}>Unsort</button>
                  {p.uploader === name && <button className="small danger" onClick={() => remove(p.id)}>Delete</button>}
                </div>
              </div>
            )}
          </figure>
        ))}
      </div>
    </>
  );
}
