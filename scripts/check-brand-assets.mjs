import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { brandManifestSchema } from "../src/lib/brand/contract.ts";

const manifest = brandManifestSchema.parse(JSON.parse(readFileSync(new URL("../src/lib/brand/assets.json", import.meta.url), "utf8")));
if (!manifest.identity) {
  console.log("PENDING: approved ORYQEN masters have not been supplied. Existing identity remains unchanged.");
  if (process.argv.includes("--require-approved")) process.exitCode = 1;
} else {
  for (const kind of ["logo", "mark"]) for (const theme of ["light", "dark"]) {
    const asset = manifest.identity[kind][theme];
    const bytes = readFileSync(new URL(`../public${asset.src}`, import.meta.url));
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error(`Approved ${kind}/${theme} hash mismatch`);
    console.log(`PASS: ${kind}/${theme} asset integrity`);
  }
  console.log("Asset hashes verified; visual/platform approval still requires recorded inspection.");
}
