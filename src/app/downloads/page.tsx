import Link from 'next/link';
import { AppBrandHeader } from '@/components/brand/brand';
import { androidRelease, windowsRelease, releaseUrls, type Release } from '@/features/releases/releases';

// Release facts come from src/features/releases/releases.ts (checked against
// docs/RELEASE_MANIFEST.md by a test). Controls stay disabled until an https URL is
// configured, so no binary URL is ever fabricated here.
const windows = windowsRelease;
const android = androidRelease;

const panel = { border: '1px solid #d5e2f0', borderRadius: 16, padding: 20, marginTop: 16, background: '#f8fbff' } as const;
const meta = { display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 18px', margin: '14px 0', fontSize: 14 } as const;
const hash = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, overflowWrap: 'anywhere' } as const;
const warning = { background: '#fff7e6', border: '1px solid #f0d9a8', borderRadius: 12, padding: '12px 14px', fontSize: 14, margin: '14px 0 0' } as const;

function ReleasePanel({ title, data }: { title: string; data: Release }) {
  const url = releaseUrls[data.key];
  return <section style={panel}>
    <h2 style={{ marginTop: 0 }}>{title}</h2>
    <dl style={meta}>
      <dt>Version</dt><dd style={{ margin: 0 }}>{data.version}</dd>
      <dt>Compatibility</dt><dd style={{ margin: 0 }}>{data.platform}</dd>
      <dt>File type</dt><dd style={{ margin: 0 }}>{data.type}</dd>
      <dt>Download size</dt><dd style={{ margin: 0 }}>{data.size}</dd>
      <dt>SHA-256</dt><dd style={{ margin: 0 }}><code style={hash}>{data.sha256}</code></dd>
      <dt>Signing</dt><dd style={{ margin: 0 }}>{data.signing}</dd>
    </dl>
    {url ? <a href={url} rel="noopener noreferrer">Download {title}</a> : <button disabled>{title} download — release pending</button>}
    <p style={{ ...warning }} role="note">
      {url ? 'Verify the SHA-256 above before installing.' : 'No public download is published yet.'} These values describe the preview build. Compare
      the checksum with the published manifest before installing.
    </p>
  </section>;
}

export default function DownloadsPage() {
  return <main style={{ maxWidth: 880, margin: '40px auto 72px', padding: '0 24px', fontFamily: 'system-ui', lineHeight: 1.7, color: '#0b1b33' }}>
    <AppBrandHeader />
    <Link href="/">Back to ORYQEN</Link>
    <h1>ORYQEN applications</h1>
    <p>
      One account and shared authorized records across the browser, Windows and Android.
      An internet connection is required; the applications load the hosted ORYQEN
      service rather than a local copy.
    </p>

    <ReleasePanel title="Windows" data={windows} />
    <ReleasePanel title="Android" data={android} />

    <h2>Installation</h2>
    <p>
      Only install an approved release from the official download location. On Windows,
      run the installer and accept the per-user install directory; uninstall through
      Windows Settings. On Android, allow installation from the approved source only.
      After installing, sign in with your existing ORYQEN account.
    </p>
    <p>
      Email verification and recovery links open in your browser. Complete them there
      and then sign in inside the application. Windows and Android keep separate local
      sessions even though they share the same account and records.
    </p>

    <h2>Security notices</h2>
    <ul>
      <li>The Windows installer is unsigned, so SmartScreen will warn. Do not disable Windows protection globally.</li>
      <li>The Android preview APK is signed with a debug certificate and is not a production-signed release.</li>
      <li>Only HTTPS origins are used; cleartext traffic is disabled in the Android build.</li>
      <li>Never install a build whose checksum does not match the published manifest.</li>
    </ul>

    <h2>Preview limitations</h2>
    <p>
      Live AI guidance is unavailable. New opportunity and guidance features require
      approved backend migrations. Original document files are not stored by the text
      importer. No cross-device production acceptance is claimed yet.
    </p>

    <h2>Full release documentation</h2>
    <p>
      Artifact paths, provenance, signing status and the complete test evidence are
      recorded in the repository at <code>docs/RELEASE_MANIFEST.md</code> and
      <code>docs/TEST_REPORT.md</code>.
    </p>

    <Link href="/sign-in">Continue in the browser</Link>
  </main>;
}
