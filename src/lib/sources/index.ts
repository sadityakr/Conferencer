/**
 * External places a group can pool its photos, e.g. one shared OneDrive / Teams (SharePoint)
 * folder per conference. Direct upload in the app needs no source.
 */
export interface RemotePhoto {
  ref: string; // stable id, used to skip photos imported before
  name: string;
  uploader: string | null;
  lastModified: number | null;
  download(): Promise<Uint8Array>;
}

export interface PhotoSource {
  readonly kind: string;
  list(): Promise<RemotePhoto[]>;
}

export { OneDriveSource, isMicrosoftShareLink } from "./onedrive";
