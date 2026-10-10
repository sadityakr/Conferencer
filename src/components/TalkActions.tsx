"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { RequireName } from "./NameBar";
import { uploadPhotos, summarize } from "./upload";

/** "I'm in this talk": add photos or a note straight to it. */
export function TalkActions({ confId, talkId }: { confId: number; talkId: number }) {
  const router = useRouter();
  const pick = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [note, setNote] = useState("");

  return (
    <RequireName>
      {(name) => {
        async function send(files: FileList | null) {
          if (!files?.length) return;
          setBusy(true);
          setMsg(null);
          const s = summarize(await uploadPhotos(confId, Array.from(files), { uploader: name, mode: "talk", talkId }));
          setBusy(false);
          setMsg(s.errors.length ? { kind: "error", text: s.errors.join(" ") } : { kind: "ok", text: `Added ${s.assigned} photo${s.assigned === 1 ? "" : "s"}.` });
          router.refresh();
        }
        async function addNote(e: React.FormEvent) {
          e.preventDefault();
          if (!note.trim()) return;
          setBusy(true);
          const res = await fetch(`/api/conferences/${confId}/notes`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ talkId, author: name, text: note }),
          });
          setBusy(false);
          if (res.ok) {
            setNote("");
            router.refresh();
          } else setMsg({ kind: "error", text: (await res.json().catch(() => ({}))).error ?? "Could not save note" });
        }
        return (
          <div className="card stack">
            <div className="row">
              <input ref={cam} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => send(e.target.files)} />
              <input ref={pick} type="file" accept="image/*" multiple hidden onChange={(e) => send(e.target.files)} />
              <button className="primary" disabled={busy} onClick={() => cam.current?.click()}>📷 Take photo for this talk</button>
              <button disabled={busy} onClick={() => pick.current?.click()}>Add photos from gallery</button>
            </div>
            <form className="stack" onSubmit={addNote}>
              <textarea placeholder="Add a note: key takeaway, paper link, question to ask…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
              <div className="row">
                <button disabled={busy || !note.trim()}>Save note</button>
              </div>
            </form>
            {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}
          </div>
        );
      }}
    </RequireName>
  );
}
