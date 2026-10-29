// Single source for release facts shown on the landing page and /downloads.
// Values mirror docs/RELEASE_MANIFEST.md and are checked against it by
// tests/unit/release-data.test.ts. A download control becomes a link only when a
// real https URL is configured; no binary URL is ever fabricated here.
export type Release = {
  key: "windows" | "android";
  name: string;
  version: string;
  platform: string;
  type: string;
  size: string;
  sha256: string;
  signing: string;
  signed: boolean;
};

export const windowsRelease: Release = {
  key: "windows",
  name: "Windows",
  version: "0.1.0 (preview)",
  platform: "Windows 10 / 11, x64",
  type: "EXE installer (NSIS, per-user)",
  size: "121,261,243 bytes (115.6 MiB)",
  sha256: "bd27ed2fec1c6c15e32929de57db89bac6f758c73d6da3f318c206e02eb393e3",
  signing: "Unsigned — Windows SmartScreen will warn.",
  signed: false,
};

export const androidRelease: Release = {
  key: "android",
  name: "Android",
  version: "1.0-online-preview (build 1)",
  platform: "Android 7.0 (API 24) or newer",
  type: "APK, universal, Capacitor shell",
  size: "4,121,028 bytes (3.9 MiB)",
  sha256: "8d4a1e1bda942d74940824695d4ab85629813dc3b7def6974cd586057053cc8f",
  signing: "Debug certificate only — internal testing artifact, not production-signed.",
  signed: false,
};

export function httpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// NEXT_PUBLIC values are inlined at build time, so each must be referenced literally.
export const releaseUrls: Record<Release["key"], string | null> = {
  windows: httpsUrl(process.env.NEXT_PUBLIC_WINDOWS_URL),
  // The APK is small enough to ship with the site, so its link is served from this origin (verified after each deploy). The Windows installer is too large for that and
  // stays unpublished until a release host URL is configured.
  android: httpsUrl(process.env.NEXT_PUBLIC_APK_URL) ?? "/downloads/ORYQEN-Online-Preview-1.0.0-staging-debug.apk",
};
