"use client";
import { useState } from "react";
import { useName } from "./useName";

export function NameBar() {
  const [name, setName, ready] = useName();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (!ready) return null;
  if (!name || editing) {
    return (
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            setName(draft);
            setEditing(false);
          }
        }}
      >
        <input type="text" placeholder="Your name" aria-label="Your name" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: 160 }} autoFocus={editing} />
        <button className="primary" type="submit">Save</button>
      </form>
    );
  }
  return (
    <div className="row small">
      <span className="muted">You are</span> <strong>{name}</strong>
      <button className="ghost small" style={{ minHeight: 30, padding: ".2rem .5rem" }} onClick={() => { setDraft(name); setEditing(true); }}>
        change
      </button>
    </div>
  );
}

/** Blocks children until the person has given a name, since photos and notes are credited to it. */
export function RequireName({ children }: { children: (name: string) => React.ReactNode }) {
  const [name, , ready] = useName();
  if (!ready) return null;
  if (!name) {
    return (
      <div className="card stack">
        <h2>Who are you?</h2>
        <p className="muted">Your photos and notes are credited to this name in the group book.</p>
        <NameBar />
      </div>
    );
  }
  return <>{children(name)}</>;
}
