"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function NewConference() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [];
    }
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/conferences", { method: "POST", body: new FormData(e.currentTarget) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      router.push(`/c/${body.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>New conference</h2>
      <div className="field">
        <label htmlFor="pdf">Schedule PDF</label>
        <input id="pdf" name="pdf" type="file" accept="application/pdf" required />
        <div className="hint">
          No PDF to hand? Try <a href="/samples/toy-schedule.pdf" download>the toy schedule</a>.
        </div>
      </div>
      <div className="field">
        <label htmlFor="name">Name <span className="muted small">(optional, taken from the PDF)</span></label>
        <input id="name" name="name" type="text" placeholder="e.g. DPG Spring Meeting 2026" />
      </div>
      <div className="field">
        <label htmlFor="timezone">Conference timezone <span className="muted small">(optional if the PDF says)</span></label>
        <input id="timezone" name="timezone" type="text" list="zones" placeholder="e.g. Europe/Berlin" />
        <datalist id="zones">{zones.map((z) => <option key={z} value={z} />)}</datalist>
        <div className="hint">Camera clocks record local time, so this is how photo times line up with the schedule.</div>
      </div>
      {error && <div className="alert error" style={{ marginTop: "1rem" }}>{error}</div>}
      <div className="row" style={{ marginTop: "1rem" }}>
        <button className="primary" disabled={busy}>{busy ? "Reading schedule…" : "Create calendar"}</button>
      </div>
    </form>
  );
}
