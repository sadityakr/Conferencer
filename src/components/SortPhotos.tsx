"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { PhotoView, SessionOption, TalkOption } from "@/lib/views";
import { useName } from "./useName";

interface Props {
  confId: number;
  timezone: string;
  needsChoice: PhotoView[];
  unassigned: PhotoView[];
  sessions: SessionOption[];
  talks: TalkOption[];
}

async function resolve(confId: number, body: object): Promise<{ updated: number; cascaded: number } | { error: string }> {
  const res = await fetch(`/api/conferences/${confId}/resolve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

export function SortPhotos(props: Props) {
  const [name] = useName();
  const [everyone, setEveryone] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const mine = (p: PhotoView) => everyone || p.uploader === name;
  const needs = props.needsChoice.filter(mine);
  const loose = props.unassigned.filter(mine);
  const othersWaiting = props.needsChoice.length + props.unassigned.length - needs.length - loose.length;

  // One question per person per set of parallel sessions: "which of these were you in?"
  const groups = useMemo(() => {
    const m = new Map<string, PhotoView[]>();
    for (const p of needs) {
      const key = `${p.uploader}|${p.candidates.join(",")}`;
      m.set(key, [...(m.get(key) ?? []), p]);
    }
    return [...m.values()];
  }, [needs]);

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ margin: 0 }}>Sort photos</h1>
        <span className="spacer" />
        <label className="row small" style={{ fontWeight: 500, margin: 0 }}>
          <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} /> Show everyone’s
        </label>
      </div>
      {flash && <div className="alert ok">{flash}</div>}
      {!everyone && !name && <div className="alert info">Set your name at the top to see your photos.</div>}

      {groups.length === 0 && loose.length === 0 && (
        <div className="alert ok">
          Nothing to sort{everyone ? "" : " for you"}. 🎉{" "}
          {!everyone && othersWaiting > 0 && `${othersWaiting} of other people’s photos are waiting for them.`}
        </div>
      )}

      {groups.map((g) => (
        <ChoiceGroup key={g[0].id} {...props} photos={g} showUploader={everyone} onDone={setFlash} />
      ))}

      {loose.length > 0 && <Unsorted {...props} photos={loose} showUploader={everyone} onDone={setFlash} />}
    </div>
  );
}

function Thumbs({ photos, selected, toggle, showUploader }: { photos: PhotoView[]; selected: Set<number>; toggle: (id: number) => void; showUploader: boolean }) {
  return (
    <div className="grid">
      {photos.map((p) => (
        <label key={p.id} className="thumb" style={{ margin: 0, fontWeight: 400, cursor: "pointer" }}>
          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/${p.id}/image`} alt="" loading="lazy" />
          <span className="cap">
            {p.timeLabel}
            {showUploader && ` · ${p.uploader}`}
            {p.timeSource === "file" && <span className="badge warn">file date</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

function useSelection(photos: PhotoView[]) {
  const [selected, setSelected] = useState(() => new Set(photos.map((p) => p.id)));
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return { selected: new Set([...selected].filter((id) => photos.some((p) => p.id === id))), toggle };
}

function ChoiceGroup({ confId, photos, sessions, showUploader, onDone }: Props & { photos: PhotoView[]; showUploader: boolean; onDone: (m: string) => void }) {
  const router = useRouter();
  const { selected, toggle } = useSelection(photos);
  const [busy, setBusy] = useState(false);
  const options = sessions.filter((s) => photos[0].candidates.includes(s.id));
  const range = photos.length > 1 ? `${photos[0].timeLabel} – ${photos[photos.length - 1].timeLabel.split(" ")[1]}` : photos[0].timeLabel;

  async function choose(sessionId: number) {
    setBusy(true);
    const r = await resolve(confId, { photoIds: [...selected], sessionId });
    setBusy(false);
    if ("error" in r) onDone(r.error);
    else onDone(`Placed ${r.updated} photo${r.updated === 1 ? "" : "s"}${r.cascaded ? `, and ${r.cascaded} more from the same session automatically` : ""}.`);
    router.refresh();
  }

  return (
    <section className="card stack">
      <div>
        <h2 style={{ marginBottom: ".2rem" }}>Which session {showUploader ? `was ${photos[0].uploader}` : "were you"} in?</h2>
        <div className="muted small">
          {photos.length} photo{photos.length === 1 ? "" : "s"} · {range} · {options.length} sessions running in parallel
        </div>
      </div>
      <Thumbs photos={photos} selected={selected} toggle={toggle} showUploader={showUploader} />
      <div className="choices">
        {options.map((s) => (
          <button key={s.id} className="choice" disabled={busy || selected.size === 0} onClick={() => choose(s.id)}>
            <strong>{s.title}</strong>
            <span className="small muted">{s.label}</span>
          </button>
        ))}
      </div>
      <div className="hint">Untick photos that belong elsewhere first. Your answer is remembered for other photos from the same time.</div>
    </section>
  );
}

function Unsorted({ confId, photos, talks, showUploader, onDone }: Props & { photos: PhotoView[]; showUploader: boolean; onDone: (m: string) => void }) {
  const router = useRouter();
  const { selected, toggle } = useSelection(photos);
  const [talkId, setTalkId] = useState("");
  const [busy, setBusy] = useState(false);

  async function assign() {
    setBusy(true);
    const r = await resolve(confId, { photoIds: [...selected], talkId: Number(talkId) });
    setBusy(false);
    if ("error" in r) onDone(r.error);
    else onDone(`Placed ${r.updated} photo${r.updated === 1 ? "" : "s"}.`);
    setTalkId("");
    router.refresh();
  }

  return (
    <section className="card stack">
      <div>
        <h2 style={{ marginBottom: ".2rem" }}>Unsorted</h2>
        <div className="muted small">Taken during breaks or outside the programme, or with no usable time. They stay in the book’s “Unsorted” chapter unless you place them.</div>
      </div>
      <Thumbs photos={photos} selected={selected} toggle={toggle} showUploader={showUploader} />
      <div className="row">
        <select value={talkId} onChange={(e) => setTalkId(e.target.value)} aria-label="Talk" style={{ flex: "1 1 260px" }}>
          <option value="">Put selected photos in talk…</option>
          {talks.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <button className="primary" disabled={busy || !talkId || selected.size === 0} onClick={assign}>Place {selected.size}</button>
      </div>
    </section>
  );
}
