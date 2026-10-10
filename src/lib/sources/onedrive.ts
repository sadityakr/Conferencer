import type { PhotoSource, RemotePhoto } from "./index";

/**
 * OneDrive / SharePoint / Teams shared folder via Microsoft Graph "shares" API:
 *   GET /shares/u!{base64url(link)}/driveItem/children
 * This needs a Graph access token with Files.Read.All (delegated). For now the token comes
 * from MS_GRAPH_TOKEN. A proper "Sign in with Microsoft" flow (MSAL + an Entra app
 * registration, possibly approved by the university IT) comes later.
 */
const GRAPH = "https://graph.microsoft.com/v1.0";
const IMAGE_EXT = /\.(jpe?g|png|webp|tiff?|heic|heif)$/i;

export function isMicrosoftShareLink(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "1drv.ms" || h.endsWith("onedrive.live.com") || h.endsWith(".sharepoint.com");
  } catch {
    return false;
  }
}

export function encodeShareUrl(url: string): string {
  return "u!" + Buffer.from(url, "utf8").toString("base64").replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
}

interface DriveItem {
  id: string;
  name: string;
  file?: { mimeType?: string };
  folder?: unknown;
  parentReference?: { driveId?: string };
  createdBy?: { user?: { displayName?: string } };
  fileSystemInfo?: { lastModifiedDateTime?: string };
  "@microsoft.graph.downloadUrl"?: string;
}

export class OneDriveSource implements PhotoSource {
  readonly kind = "onedrive";
  constructor(
    private shareUrl: string,
    private token: string | undefined = process.env.MS_GRAPH_TOKEN,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async get<T>(url: string): Promise<T> {
    if (!this.token) {
      throw new Error("OneDrive/Teams import is not connected yet: set MS_GRAPH_TOKEN (Microsoft Graph token with Files.Read.All).");
    }
    const res = await this.fetchImpl(url, { headers: { authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error(`Microsoft Graph ${res.status}: ${await res.text().catch(() => "")}`);
    return (await res.json()) as T;
  }

  async list(): Promise<RemotePhoto[]> {
    const out: RemotePhoto[] = [];
    let url: string | undefined = `${GRAPH}/shares/${encodeShareUrl(this.shareUrl)}/driveItem/children?$top=200`;
    while (url) {
      const page: { value: DriveItem[]; "@odata.nextLink"?: string } = await this.get(url);
      for (const it of page.value) {
        const isImage = it.file && (it.file.mimeType?.startsWith("image/") || IMAGE_EXT.test(it.name));
        const dl = it["@microsoft.graph.downloadUrl"];
        if (!isImage || !dl) continue;
        const modified = it.fileSystemInfo?.lastModifiedDateTime;
        out.push({
          ref: `onedrive:${it.parentReference?.driveId ?? ""}:${it.id}`,
          name: it.name,
          uploader: it.createdBy?.user?.displayName ?? null,
          lastModified: modified ? Date.parse(modified) : null,
          download: async () => {
            const r = await this.fetchImpl(dl);
            if (!r.ok) throw new Error(`Download of ${it.name} failed: ${r.status}`);
            return new Uint8Array(await r.arrayBuffer());
          },
        });
      }
      url = page["@odata.nextLink"];
    }
    return out;
  }
}
