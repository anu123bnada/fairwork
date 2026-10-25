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
  size: "121,260,491 bytes (115.6 MiB)",
  sha256: "64925b35e269250bd68aff8672398abe0e19eee024baf0d65456f6a36911fae7",
  signing: "Unsigned — Windows SmartScreen will warn.",
  signed: false,
};

export const androidRelease: Release = {
  key: "android",
  name: "Android",
  version: "1.0-online-preview (build 1)",
  platform: "Android 7.0 (API 24) or newer",
  type: "APK, universal, Capacitor shell",
  size: "4,121,000 bytes (3.9 MiB)",
  sha256: "03e650b4242fc524be5585d56d96247e6c6c2c061fe59d7e08e4baa619c07446",
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
  android: httpsUrl(process.env.NEXT_PUBLIC_APK_URL),
};
