import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / heavy Node packages must not be bundled into server chunks.
  serverExternalPackages: ["better-sqlite3", "sharp", "pdfjs-dist"],
};

export default nextConfig;
