import { ConfHeader } from "@/components/ConfHeader";
import { SortPhotos } from "@/components/SortPhotos";
import { getPhotos } from "@/lib/repo";
import { photoView, sessionOptions, talkOptions } from "@/lib/views";
import { loadConference } from "../data";

export const dynamic = "force-dynamic";

export default async function SortPage({ params }: { params: Promise<{ id: string }> }) {
  const { conf, pending } = await loadConference(params);
  const tz = conf.timezone;
  return (
    <>
      <ConfHeader conf={conf} active="sort" pending={pending} />
      <main className="container">
        <SortPhotos
          confId={conf.id}
          timezone={tz}
          needsChoice={getPhotos(conf.id, { status: "needs_choice" }).map((p) => photoView(p, tz))}
          unassigned={getPhotos(conf.id, { status: "unassigned" }).map((p) => photoView(p, tz))}
          sessions={sessionOptions(conf)}
          talks={talkOptions(conf)}
        />
      </main>
    </>
  );
}
