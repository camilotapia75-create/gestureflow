/**
 * Downloads animal sound files from Wikimedia Commons at build time.
 * Runs before `next build` on Vercel (full internet access).
 *
 * All direct CDN URLs verified via MediaWiki MD5 hash formula AND cross-checked
 * against search results (duck URL `f/fa` confirmed from Wikipedia page).
 *
 * Files used (all confirmed to exist on Wikimedia Commons):
 *   - Cat:  Cat_meowing_2.ogg  → 7/77
 *   - Dog:  Barking_of_a_dog.ogg (2.6 s) → a/a2
 *   - Duck: Anas_platyrhynchos_-_Mallard_-_XC62258.ogg (3.5 s) → f/fa  ✓ confirmed
 *   - Cow:  Mudchute_cow_1.ogg (2.2 s) → 4/48
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'sounds');

fs.mkdirSync(OUT_DIR, { recursive: true });

const UA = 'GestureFlow-PWA/1.0 (https://github.com/camilotapia75-create/gestureflow; build-bot)';

// For each sound: direct CDN URL first (no redirect overhead),
// then Special:FilePath as fallback (handles any future renames/moves).
const SOUNDS = [
  {
    name: 'cat.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/7/77/Cat_meowing_2.ogg',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Cat_meowing_2.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/6/62/Meow.ogg',
    ],
  },
  {
    // 2.6 s — short single bark
    name: 'dog.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/a/a2/Barking_of_a_dog.ogg',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Barking_of_a_dog.ogg',
    ],
  },
  {
    // 3.5 s — real mallard duck quacking (hash f/fa confirmed from Wikipedia)
    name: 'duck.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/f/fa/Anas_platyrhynchos_-_Mallard_-_XC62258.ogg',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Anas_platyrhynchos_-_Mallard_-_XC62258.ogg',
    ],
  },
  {
    // 2.2 s — Mudchute farm cow (confirmed in Wikimedia Commons search)
    name: 'cow.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/4/48/Mudchute_cow_1.ogg',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Mudchute_cow_1.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/2/25/Moo.ogg',
    ],
  },
];

function download(url, destPath, redirectDepth = 0) {
  if (redirectDepth > 8) return Promise.reject(new Error('too many redirects'));
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    const req = lib.get(url, {
      timeout: 30000,
      headers: { 'User-Agent': UA },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        const loc = res.headers.location;
        if (!loc) { reject(new Error('redirect with no location')); return; }
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        download(next, destPath, redirectDepth + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    });
    req.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch {}
      reject(err);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function downloadSound(sound) {
  const dest = path.join(OUT_DIR, sound.name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log(`✓ ${sound.name} (cached)`);
    return;
  }
  for (const url of sound.urls) {
    try {
      await download(url, dest);
      const kb = (fs.statSync(dest).size / 1024).toFixed(1);
      console.log(`✓ ${sound.name} — ${url} (${kb} KB)`);
      return;
    } catch (e) {
      console.warn(`  ✗ ${url} — ${e.message}`);
    }
  }
  console.warn(`⚠ ${sound.name}: all URLs failed — browser will use Web Audio synthesis`);
}

console.log('Downloading animal sounds…');
for (const sound of SOUNDS) {
  await downloadSound(sound);
}
console.log('Done.');
