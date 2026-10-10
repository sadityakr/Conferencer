import { notFound } from "next/navigation";
import { getConference } from "@/lib/repo";
import { pendingByUploader } from "@/lib/views";

export async function loadConference(params: Promise<{ id: string }>) {
  const { id } = await params;
  const conf = /^\d+$/.test(id) ? getConference(parseInt(id, 10)) : undefined;
  if (!conf) notFound();
  return { conf, pending: pendingByUploader(conf.id) };
}
