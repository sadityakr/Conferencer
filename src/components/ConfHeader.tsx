import Link from "next/link";
import type { Conference } from "@/lib/types";
import { NameBar } from "./NameBar";
import { PendingBadge } from "./PendingBadge";

type Tab = "schedule" | "add" | "sort" | "book";

export function ConfHeader({ conf, active, pending }: { conf: Conference; active?: Tab; pending: Record<string, number> }) {
  const base = `/c/${conf.id}`;
  const tabs: [Tab, string, string][] = [
    ["schedule", "Schedule", base],
    ["add", "Add photos", `${base}/add`],
    ["sort", "Sort", `${base}/sort`],
    ["book", "Book", `${base}/book`],
  ];
  return (
    <header className="topbar">
      <div className="container">
        <div className="row">
          <Link href="/" className="brand">Conferencer</Link>
          <span className="spacer" />
          <NameBar />
        </div>
        <h1 style={{ marginTop: ".6rem" }}>{conf.name}</h1>
        <div className="muted small">Times in {conf.timezone.replace(/_/g, " ")}</div>
        <nav className="tabs">
          {tabs.map(([key, label, href]) => (
            <Link key={key} href={href} className={active === key ? "active" : ""}>
              {label}
              {key === "sort" && <PendingBadge pending={pending} />}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
