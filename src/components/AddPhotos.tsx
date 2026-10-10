"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import type { SessionOption } from "@/lib/views";
import { RequireName } from "./NameBar";
import { summarize, uploadPhotos, type UploadResult } from "./upload";

type Mode = "upload" | "capture" | "folder";

export function AddPhotos(props: { confId: number; timezone: string; sessions: SessionOption[] }) {
  const [mode, setMode] = useState<Mode>("upload");
  return (
    <RequireName>
      {(name) => (
        <div className="stack">
          <div className="row" role="tablist">
            {(
              [
                ["upload", "Upload photos"],
                ["capture", "Capture now"],
                ["folder", "Shared folder"],
              ] as const
            ).map(([m, label]) => (
              <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "primary" : ""} onClick={() => setMode(m)}>
                {label}
              </button>
            ))}
          </div>
          {mode === "upload" && <UploadMode {...props} name={name} />}
          {mode === "capture" && <CaptureMode {...props} name={name} />}
          {mode === "folder" && <FolderMode {...props} name={name} />}
        </div>
      )}
    </RequireName>
  );
}

function Results({ confId, results }: { confId: number; results: UploadResult[] }) {
  const s = summarize(results);
  return (
    <div className="stack">
      <div className="alert ok">
        {s.assigned} photo{s.assigned === 1 ? "" : "s"} placed in talks automatically.
        {s.skipped > 0 && ` ${s.skipped} were already imported.`}
      </div>
      {s.needsChoice > 0 && (
        <div className="alert info row">
          <span>{s.needsChoice} were taken while parallel sessions were running. Which one were you in?</span>
          <span className="spacer" />
          <Link className="btn primary" href={`/c/${confId}/sort`}>Choose sessions</Link>
        </div>
      )}
      {s.unassigned > 0 && (
        <div className="alert warn row">
          <span>{s.unassigned} were taken outside any session or have no time. Place them by hand, or leave them in “Unsorted”.</span>
          <span className="spacer" />
          <Link className="btn" href={`/c/${confId}/sort`}>Sort</Link>
        </div>
      )}
      {s.errors.map((e) => (
        <div key={e} className="alert error">{e}</div>
      ))}
    </div>
  );
}

function UploadMode({ confId, name }: { confId: number; name: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [results, setResults] = useState<UploadResult[] | null>(null);

  async function send(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp|tiff?)$/i.test(f.name));
    if (!files.length) return;
    setResults(null);
    setProgress([0, files.length]);
    const r = await uploadPhotos(confId, files, { uploader: name, mode: "auto" }, (d, t) => setProgress([d, t]));
    setProgress(null);
    setResults(r);
    router.refresh();
  }

  return (
    <div className="stack">
      <div
        className={`dropzone${over ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          send(e.dataTransfer.files);
        }}
      >
        <p><strong>Drop your conference photos here</strong></p>
        <p className="muted small">Each photo is placed in the talk that was running when it was taken, using the time stored in the photo.</p>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && send(e.target.files)} />
        <button className="primary" disabled={!!progress} onClick={() => input.current?.click()}>
          {progress ? `Uploading ${progress[0]}/${progress[1]}…` : "Choose photos"}
        </button>
      </div>
      <p className="muted small">
        Want to try it? Download the <a href="/samples/photos/alice_01_keynote.jpg" download>toy sample photos</a> (alice_*, bob_*, carol_* in{" "}
        <code>public/samples/photos</code>) and upload them under different names.
      </p>
      {results && <Results confId={confId} results={results} />}
    </div>
  );
}

function CaptureMode({ confId, timezone, sessions, name }: { confId: number; timezone: string; sessions: SessionOption[]; name: string }) {
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null);
  const [pretend, setPretend] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);

  // "Now", or a pretend time for trying the toy conference before it happens.
  const now = useMemo(() => {
    if (!pretend) return Date.now();
    const t = DateTime.fromISO(pretend, { zone: timezone }); // conference wall-clock time
    return t.isValid ? t.toMillis() : Date.now();
  }, [pretend, timezone]);
  const running = sessions.filter((s) => Date.parse(s.start_utc) - 10 * 60_000 <= now && now < Date.parse(s.end_utc) + 10 * 60_000);
  const sessionId = running.length === 1 ? running[0].id : chosen;
  const fmt = (ms: number) => DateTime.fromMillis(ms).setZone(timezone).toFormat("ccc d LLL, HH:mm");

  async function send(files: FileList) {
    setBusy(true);
    const r = await uploadPhotos(confId, Array.from(files), {
      uploader: name,
      mode: "capture",
      capturedAt: now,
      sessionId: sessionId ?? undefined,
      forceTime: !!pretend,
    });
    setBusy(false);
    setResults(r);
    router.refresh();
  }

  return (
    <div className="stack">
      <div className="card stack">
        <div className="muted small">Conference time now: {fmt(now)}</div>
        {running.length === 0 && <div className="alert warn">No session is running right now. Photos will go to “Unsorted”, where you can place them later.</div>}
        {running.length === 1 && (
          <div className="alert info">
            You are in <strong>{running[0].title}</strong> ({running[0].label})
          </div>
        )}
        {running.length > 1 && (
          <div className="stack">
            <h2>Which session are you in?</h2>
            <p className="muted small">{running.length} sessions are running in parallel. We will remember your answer for photos taken during it.</p>
            <div className="choices">
              {running.map((s) => (
                <button key={s.id} className={`choice${chosen === s.id ? " primary" : ""}`} onClick={() => setChosen(s.id)}>
                  <strong>{s.title}</strong>
                  <span className="small">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <input ref={camera} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => e.target.files && send(e.target.files)} />
        <div className="row">
          <button className="primary" disabled={busy || (running.length > 1 && !chosen)} onClick={() => camera.current?.click()}>
            {busy ? "Saving…" : "📷 Take photo"}
          </button>
        </div>
      </div>
      <details className="small">
        <summary className="muted">Pretend it is another time (to try the toy conference)</summary>
        <div className="field" style={{ marginTop: ".5rem" }}>
          <input type="datetime-local" value={pretend} onChange={(e) => { setPretend(e.target.value); setChosen(null); }} />
          <div className="hint">Conference time ({timezone}). Photos taken now are then filed at this time instead of their own.</div>
        </div>
      </details>
      {results && <Results confId={confId} results={results} />}
    </div>
  );
}

function FolderMode({ confId, name }: { confId: number; name: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[] | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResults(null);
    const res = await fetch(`/api/conferences/${confId}/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, uploader: name }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(body.error ?? "Import failed");
    else {
      setResults(body.results);
      router.refresh();
    }
  }

  return (
    <form className="card stack" onSubmit={run}>
      <h2>Import from a shared OneDrive / Teams folder</h2>
      <p className="muted small">
        Everyone drops their photos into one shared folder, and this pulls them in, credited to whoever added each file. Run it again any time;
        photos imported before are skipped.
      </p>
      <input type="url" required placeholder="https://…sharepoint.com/:f:/… or https://1drv.ms/f/…" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="row">
        <button className="primary" disabled={busy}>{busy ? "Importing…" : "Import photos"}</button>
      </div>
      <div className="hint">Needs a Microsoft sign-in, which isn’t built yet. For now the server reads a token from MS_GRAPH_TOKEN (see README).</div>
      {error && <div className="alert error">{error}</div>}
      {results && <Results confId={confId} results={results} />}
    </form>
  );
}
