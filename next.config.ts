import type { NextConfig } from "next";

const config: NextConfig = {
  // Local Auth uses loopback hosts (localhost:3000 and 127.0.0.1:3100).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // A separate local artifact keeps browser verification away from the active
  // development server and the configured production build.
  distDir: process.env.FAIRWORK_BROWSER_SMOKE === "1" ? "test-results/day2-next"
    : process.env.FAIRWORK_ANDROID_POC === "1" ? "test-results/android-next" : ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }, {source:"/ocr/:path*",headers:[
      {key:"Content-Security-Policy",value:"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self'"},
      {key:"Cross-Origin-Resource-Policy",value:"same-origin"},
    ]}];
  },
};
export default config;
