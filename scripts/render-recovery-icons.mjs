// Raster exports from the unchanged approved assets, composed in the original
// auth-logo slots. This creates new files; rejected brand assets remain intact.
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
for (const size of [180, 192, 512]) {
  const output = `public/oryqen/restored-icon-${size}.png`;
  assert.ok(!existsSync(output), `Refusing to overwrite ${output}`);
  const scale = size / 113;
  const glass = await sharp('public/figma/auth/logo-glass.svg', { density: 288 }).resize(size, size).png().toBuffer();
  const shield = await sharp('public/figma/auth/shield.svg', { density: 288 }).resize(Math.round(34.86 * scale), Math.round(43.26 * scale)).png().toBuffer();
  await sharp(glass).composite([{ input: shield, left: Math.round(39.07 * scale), top: Math.round(34.87 * scale) }]).png().toFile(output);
}
console.log('Exported three restored icon sizes from original glass/shield assets.');
