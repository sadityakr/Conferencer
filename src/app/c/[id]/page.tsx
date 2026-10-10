import Link from "next/link";
import { DateTime } from "luxon";
import { ConfHeader } from "@/components/ConfHeader";
import { calendar, type CalendarDay } from "@/lib/views";
import { getPhotos } from "@/lib/repo";
import { loadConference } from "./data";

export const dynamic = "force-dynamic";

const SLOT = 5; // minutes per grid row

export default async function SchedulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const { conf, pending } = await loadConference(params);
  const days = calendar(conf);
  const today = DateTime.now().setZone(conf.timezone).toISODate();
  const { day: dayParam } = await searchParams;
  const day = days.find((d) => d.date === dayParam) ?? days.find((d) => d.date === today) ?? days[0];
  const unsorted = getPhotos(conf.id, { status: "unassigned" }).length;
  const nowIso = new Date().toISOString();

  return (
    <>
      <ConfHeader conf={conf} active="schedule" pending={pending} />
      <main className="container stack">
        <div className="row">
          <div className="day-tabs">
            {days.map((d) => (
              <Link key={d.date} href={`/c/${conf.id}?day=${d.date}`} className={`btn ${d.date === day?.date ? "primary" : ""}`}>
                {DateTime.fromISO(d.date).toFormat("ccc d LLL")}
              </Link>
            ))}
          </div>
          <span className="spacer" />
          {unsorted > 0 && (
            <Link href={`/c/${conf.id}/sort`} className="badge warn" style={{ padding: ".3rem .6rem" }}>
              {unsorted} unsorted photo{unsorted === 1 ? "" : "s"}
            </Link>
          )}
          <Link href={`/c/${conf.id}/add`} className="btn primary">+ Add photos</Link>
        </div>
        {day ? <DayGrid confId={conf.id} day={day} nowIso={nowIso} /> : <p className="muted">No sessions in this schedule.</p>}
        <p className="muted small">Tap a talk to see its photos, add notes, or add photos straight to it.</p>
      </main>
    </>
  );
}

function DayGrid({ confId, day, nowIso }: { confId: number; day: CalendarDay; nowIso: string }) {
  const row = (min: number) => 2 + Math.round((min - day.startMin) / SLOT);
  const ticks: number[] = [];
  for (let m = day.startMin; m < day.endMin; m += 30) ticks.push(m);
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  return (
    <div className="cal-scroll">
      <h2 className="visually-hidden">{day.label}</h2>
      <div className="cal" style={{ gridTemplateColumns: `3.4rem repeat(${day.rooms.length}, minmax(220px, 1fr))` }}>
        <div className="room-head" style={{ gridColumn: 1, gridRow: 1 }} />
        {day.rooms.map((r, i) => (
          <div key={r} className="room-head" style={{ gridColumn: i + 2, gridRow: 1 }}>{r}</div>
        ))}
        {ticks.map((m) => (
          <div key={m} className="tick" style={{ gridColumn: `1 / span ${day.rooms.length + 1}`, gridRow: `${row(m)} / span ${30 / SLOT}` }}>
            {hhmm(m)}
          </div>
        ))}
        {day.sessions.map((s) => {
          const now = s.start_utc <= nowIso && nowIso < s.end_utc;
          return (
            <section
              key={s.id}
              className={`session${now ? " now" : ""}`}
              style={{ gridColumn: day.rooms.indexOf(s.room) + 2, gridRow: `${row(s.startMin)} / ${row(s.endMin)}` }}
            >
              <div>
                <div className="session-title">{s.title}</div>
                <div className="session-meta">
                  {s.time}
                  {s.chair ? ` · Chair: ${s.chair}` : ""}
                  {now ? " · now" : ""}
                </div>
              </div>
              {s.talks.map((t) => (
                <Link key={t.id} href={`/c/${confId}/talk/${t.id}`} className="talk-link">
                  <span className="t">{t.title}</span>
                  <span className="s">
                    {t.time}
                    {t.speakers ? ` · ${t.speakers}` : ""}
                  </span>
                  {(t.photos > 0 || t.notes > 0) && (
                    <span className="row" style={{ gap: ".3rem", marginTop: ".2rem" }}>
                      {t.photos > 0 && <span className="badge ok">📷 {t.photos}</span>}
                      {t.notes > 0 && <span className="badge">✎ {t.notes}</span>}
                    </span>
                  )}
                </Link>
              ))}
              {s.loosePhotos > 0 && <span className="badge ok">📷 {s.loosePhotos} in session</span>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
