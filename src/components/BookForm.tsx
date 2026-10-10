"use client";
import { useState } from "react";
import { useName } from "./useName";

export function BookForm({ confId, people, photoCount }: { confId: number; people: string[]; photoCount: number }) {
  const [name] = useName();
  const [who, setWho] = useState<"group" | "me" | string>("group");
  const [empty, setEmpty] = useState(false);
  const uploader = who === "group" ? null : who === "me" ? name : who;
  const href = `/api/conferences/${confId}/book?${new URLSearchParams({ ...(uploader ? { uploader } : {}), ...(empty ? { empty: "1" } : {}) })}`;

  return (
    <div className="card stack">
      <div className="field">
        <label htmlFor="who">Whose book?</label>
        <select id="who" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="group">Group book: everyone’s photos ({photoCount})</option>
          {name && <option value="me">My personal book ({name})</option>}
          {people.filter((p) => p !== name).map((p) => (
            <option key={p} value={p}>{p}’s book</option>
          ))}
        </select>
      </div>
      <label className="row" style={{ fontWeight: 500 }}>
        <input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} /> Include talks without photos or notes (full programme)
      </label>
      <div className="row">
        <a className="btn primary" href={href} target="_blank" rel="noreferrer">Open PDF book</a>
        <a className="btn" href={href} download>Download</a>
      </div>
    </div>
  );
}
