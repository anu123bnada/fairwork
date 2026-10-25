// Production Windows installer configuration. Requires owner-supplied inputs; it
// never generates a certificate, picks an icon or builds an unsigned "release".
//
//   $env:CSC_LINK = "<path or https URL to the owner's .pfx/.p12 code-signing certificate>"
//   $env:CSC_KEY_PASSWORD = "<its password>"          # never written to disk or logged
//   $env:ORYQEN_WINDOWS_ICON = "<path to the owner-approved .ico (or 512px+ .png)>"
//   npm --prefix desktop run build:windows:release
//
// The preview build (package.json "build") is unchanged and stays labelled Preview.
const { existsSync } = require("node:fs");
const missing = [];
if (!process.env.CSC_LINK) missing.push("CSC_LINK (owner code-signing certificate)");
if (!process.env.CSC_KEY_PASSWORD) missing.push("CSC_KEY_PASSWORD");
const icon = process.env.ORYQEN_WINDOWS_ICON;
if (!icon || !existsSync(icon)) missing.push("ORYQEN_WINDOWS_ICON (owner-approved icon file; none exists in the repository)");
if (missing.length) {
  throw new Error(`Production Windows build refused. Missing: ${missing.join("; ")}. See docs/ORYQEN_RELEASE_SIGNING.md.`);
}
module.exports = {
  appId: "app.oryqen.desktop",
  productName: "ORYQEN",
  copyright: "ORYQEN",
  directories: { output: "../test-results/windows-release" },
  files: ["main.cjs", "policy.cjs", "offline.html", "package.json"],
  asar: true,
  win: { target: "nsis", icon, signAndEditExecutable: true },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, runAfterFinish: false },
  artifactName: "ORYQEN-${version}-${arch}-Setup.${ext}",
};
