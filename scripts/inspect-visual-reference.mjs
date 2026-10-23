import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const path = process.argv[2];
if (!path) throw new Error('Pass the local prototype recording path.');
const directory = 'test-results/day3-visual/recording';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path).href);
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  const metadata = await page.evaluate(() => {
    const video = document.querySelector('video'); video.pause();
    return { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
  });
  const frames = [];
  for (let time = 0; time < metadata.duration; time += 4) {
    const png = await page.evaluate(async (seconds) => {
      const video = document.querySelector('video');
      await new Promise(resolve => { video.addEventListener('seeked', resolve, { once: true }); video.currentTime = Math.max(0.01, seconds); });
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      return canvas.toDataURL('image/png').split(',')[1];
    }, time);
    const file = `${directory}/${String(time).padStart(3, '0')}s.png`;
    await writeFile(file, Buffer.from(png, 'base64')); frames.push({ time, file });
  }
  await writeFile(`${directory}/metadata.json`, JSON.stringify({ source: path, ...metadata, frames }, null, 2));
  console.log(JSON.stringify({ ...metadata, frameCount: frames.length }));
} finally { await browser.close(); }
