import { ConfHeader } from "@/components/ConfHeader";
import { AddPhotos } from "@/components/AddPhotos";
import { sessionOptions } from "@/lib/views";
import { loadConference } from "../data";

export const dynamic = "force-dynamic";

export default async function AddPage({ params }: { params: Promise<{ id: string }> }) {
  const { conf, pending } = await loadConference(params);
  return (
    <>
      <ConfHeader conf={conf} active="add" pending={pending} />
      <main className="container">
        <AddPhotos confId={conf.id} timezone={conf.timezone} sessions={sessionOptions(conf)} />
      </main>
    </>
  );
}
