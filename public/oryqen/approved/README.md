# Reserved for owner-approved ORYQEN masters

No approved artwork has been supplied. This folder deliberately contains no
placeholder logo. Do not copy the rejected green Q or the old FAIRWORK shield here.

Requested source files (SVG preferred, transparent, complete vector outlines):
- `logo-light.svg`: approved symbol + ORYQEN wordmark, including cyan Q-tail.
- `logo-dark.svg`: approved lockup for dark surfaces.
- `mark-light.svg`, `mark-dark.svg`: approved standalone symbol.

The owner can approve the same unchanged master for both surfaces instead of
supplying two versions. Record that decision; do not infer it or recolor artwork.
Preserve proportions, geometry, typography and colors. Supply clear-space and
minimum-size rules, with approval provenance. Review SVGs for active content and
external resources before use. Use real intrinsic dimensions and SHA-256 hashes
in `src/lib/brand/assets.json`, with an approval reference. Runtime components
accept only this directory; no external URL or legacy fallback is allowed.

After master approval, separately review/export icon derivatives here:
`favicon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, and a
maskable icon with an approved safe zone/background. Do not crop or invent one.
Wire these into `src/app/layout.tsx` and `src/app/manifest.ts`; Windows currently
uses that PWA manifest, not an EXE/MSIX. A future Windows native package needs its
own approved ICO/packaging integration.

Android: derive launcher foreground/background, round icon and splash from the
approved symbol, then update `mobile/poc/android/app/src/main/res/` and the
manifest/theme references. Update the source `mobile/poc/www/offline.html` and
sync using the existing safe local build procedure. Do not replace the project.

Asset arrival is not a visual release approval: inspect every anchor in both
viewports and actual supported themes, check native safe zones and installed
launcher/splash, and re-run route/state coverage before claiming completion.
