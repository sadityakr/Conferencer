import Link from "next/link";
import { listConferences } from "@/lib/repo";
import { NewConference } from "@/components/NewConference";
import { NameBar } from "@/components/NameBar";

export const dynamic = "force-dynamic";

export default function Home() {
  const confs = listConferences();
  return (
    <>
      <header className="topbar">
        <div className="container row" style={{ paddingBottom: 12 }}>
          <span className="brand">Conferencer</span>
          <span className="spacer" />
          <NameBar />
        </div>
      </header>
      <main className="container stack">
        <section className="stack">
          <h1>Your conferences</h1>
          <p className="muted">
            Upload a conference schedule PDF to get a calendar. Then add your photos, or have the whole group drop theirs in. Each photo is
            matched to the talk it was taken in from its capture time, and everything ends up in a conference book.
          </p>
        </section>
        {confs.length > 0 && (
          <ul className="list card">
            {confs.map((c) => (
              <li key={c.id} className="row">
                <Link href={`/c/${c.id}`}><strong>{c.name}</strong></Link>
                <span className="spacer" />
                <span className="muted small">
                  {c.sessions} sessions · {c.photos} photos
                </span>
              </li>
            ))}
          </ul>
        )}
        <NewConference />
      </main>
    </>
  );
}
