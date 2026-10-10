"use client";
import { useName } from "./useName";

/** Number of this person's photos waiting for "which session were you in?". */
export function PendingBadge({ pending }: { pending: Record<string, number> }) {
  const [name] = useName();
  const n = name ? pending[name] ?? 0 : 0;
  return n > 0 ? <span className="badge accent" style={{ marginLeft: ".35rem" }}>{n}</span> : null;
}
