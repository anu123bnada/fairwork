# ORYQEN V5 WebGL compatibility patch

Changes in `app/cinematic-core.tsx`:
- Stop requesting high-performance GPU preference (use `default`).
- Disable multisample antialiasing at WebGL context creation to reduce resource requirements.
- Cap device pixel ratio at 1.25 to lower GPU workload.
- Handle `webglcontextlost` and show the existing visual fallback.
- Keep renderer, scene and animation cleanup on unmount.

This patch is a compatibility improvement, **not** a guaranteed fix for Chrome/ANGLE context failures. WebGL initialization still depends on the browser, GPU driver, and available GPU resources. The WebGL test cube working does not prove every context request will succeed.

## Run

Extract this ZIP to a fresh folder, open a terminal in that folder (where `package.json` is), and run:

```powershell
npm install
npm run dev
```

Visit http://localhost:3000 in normal Chrome. Close other GPU-heavy tabs before testing. If the error persists, test in a clean Chrome profile and report whether the cube works there. For a separate context probe in DevTools Console, run:

```js
const c = document.createElement('canvas');
const gl = c.getContext('webgl2', { antialias: false, powerPreference: 'default' }) || c.getContext('webgl', { antialias: false, powerPreference: 'default' });
console.log(gl ? gl.getParameter(gl.VERSION) : 'No WebGL context');
```

Note: browser extensions that inject `bis_skin_checked` / `bis_register` attributes are a separate likely cause of the hydration warning; test with extensions disabled.
