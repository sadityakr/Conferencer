import { ConfHeader } from "@/components/ConfHeader";
import { BookForm } from "@/components/BookForm";
import { getPhotos, getUploaders } from "@/lib/repo";
import { loadConference } from "../data";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { conf, pending } = await loadConference(params);
  const photos = getPhotos(conf.id);
  const waiting = photos.filter((p) => p.status === "needs_choice").length;
  return (
    <>
      <ConfHeader conf={conf} active="book" pending={pending} />
      <main className="container stack">
        <h1>Conference book</h1>
        <p className="muted">
          A PDF with a chapter per talk: title, speakers, session, room and time, everyone’s notes, then the photos. Photos still waiting for a
          session choice ({waiting}) go into “Unsorted” at the end.
        </p>
        <BookForm confId={conf.id} people={getUploaders(conf.id)} photoCount={photos.length} />
      </main>
    </>
  );
}
