# ORYQEN V6 — Spatial Cinematic Edition

## Quick start

1. Extract the ZIP into `ORYQEN-V6-Cinematic` (the ZIP has `package.json` at its root).
2. Open a terminal in that folder.
3. Run `npm install` then `npm run dev`.
4. Open http://localhost:3000.

## V6 improvements
- Lazy initialization of the Three.js scene only when the section approaches the viewport.
- Explicit WebGL2 / WebGL context creation and a safe CSS spatial sculpture fallback.
- Reduced GPU pixel ratio and no MSAA for integrated graphics.
- Context loss handling, React effect cleanup, and resize observer cleanup.
- Redesigned fallback with crystalline geometry, multiple orbital rings and atmospheric glow.
- Reduced motion support.
- Existing hero, phone, navigation, demo, features, FAQ and release-link configuration retained.

## Release links
Copy `.env.example` to `.env.local` and provide real official APK and Play Store URLs. Buttons remain labeled coming soon until valid URLs are configured.

## Notes
A Chrome WebGL capability report does not guarantee every individual WebGL context creation succeeds. The fallback keeps the scene usable even when the browser rejects it. Some browser extensions inject attributes into HTML and may trigger hydration warnings; test with extensions disabled.
