import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfHeader } from "@/components/ConfHeader";
import { TalkActions } from "@/components/TalkActions";
import { PhotoGrid } from "@/components/PhotoGrid";
import { getNotes, getSession, getTalk, getTalkPhotos, getTalks } from "@/lib/repo";
import { fmtDay, fmtTime, localDate } from "@/lib/time";
import { photoView, talkOptions } from "@/lib/views";
import { loadConference } from "../../data";

export const dynamic = "force-dynamic";

export default async function TalkPage({ params }: { params: Promise<{ id: string; talkId: string }> }) {
  const { conf, pending } = await loadConference(params);
  const { talkId } = await params;
  const talk = /^\d+$/.test(talkId) ? getTalk(parseInt(talkId, 10)) : undefined;
  if (!talk || talk.conference_id !== conf.id) notFound();
  const session = getSession(talk.session_id)!;
  const tz = conf.timezone;
  const photos = getTalkPhotos(talk.id).map((p) => photoView(p, tz));
  const notes = getNotes(talk.id);
  const siblings = getTalks(conf.id).filter((t) => t.session_id === session.id);
  const idx = siblings.findIndex((t) => t.id === talk.id);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];

  return (
    <>
      <ConfHeader conf={conf} pending={pending} />
      <main className="container stack">
        <div className="card stack">
          <div className="muted small">
            {fmtDay(talk.start_utc, tz)} · {fmtTime(talk.start_utc, tz)}–{fmtTime(talk.end_utc, tz)} · {session.room}
          </div>
          <div className="small">
            <Link href={`/c/${conf.id}?day=${localDate(talk.start_utc, tz)}`}>{session.title}</Link>
            {session.chair ? <span className="muted"> · Chair: {session.chair}</span> : null}
          </div>
          <h1>{talk.title}</h1>
          {talk.speakers && <div style={{ color: "var(--accent)", fontWeight: 600 }}>{talk.speakers}</div>}
          <div className="row small">
            {prev && <Link href={`/c/${conf.id}/talk/${prev.id}`}>← {prev.title}</Link>}
            <span className="spacer" />
            {next && <Link href={`/c/${conf.id}/talk/${next.id}`}>{next.title} →</Link>}
          </div>
        </div>

        <TalkActions confId={conf.id} talkId={talk.id} />

        <section className="stack">
          <h2>Notes</h2>
          {notes.length === 0 ? (
            <p className="muted small">No notes yet.</p>
          ) : (
            <ul className="list card tight">
              {notes.map((n) => (
                <li key={n.id}>
                  <div style={{ whiteSpace: "pre-wrap" }}>{n.text}</div>
                  <div className="muted small">— {n.author}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="stack">
          <h2>Photos <span className="badge">{photos.length}</span></h2>
          {photos.length === 0 ? (
            <p className="muted small">No photos yet. Add some above, or upload your camera roll and they will land here automatically.</p>
          ) : (
            <PhotoGrid confId={conf.id} photos={photos} talks={talkOptions(conf)} currentTalkId={talk.id} />
          )}
        </section>
      </main>
    </>
  );
}
