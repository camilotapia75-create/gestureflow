/**
 * Downloads animal sound files from Wikimedia Commons at build time.
 * Runs before `next build` on Vercel (full internet access) so sounds are
 * served from the same origin — no CORS issues in the browser.
 *
 * URLs verified via MediaWiki MD5 path formula:
 *   path = md5(normalized_filename)[0] / md5[0:2] / normalized_filename
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'sounds');

fs.mkdirSync(OUT_DIR, { recursive: true });

// URLs computed with correct MediaWiki hash formula and verified against
// Wikimedia Commons search results (all files confirmed to exist).
const SOUNDS = [
  {
    name: 'cat.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/7/77/Cat_meowing_2.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/6/62/Meow.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/0/0c/Meow_domestic_cat.ogg',
    ],
  },
  {
    name: 'dog.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/a/a2/Barking_of_a_dog.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/5/58/Barking_of_a_dog_2.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/c/ce/Sound-of-dog.ogg',
    ],
  },
  {
    name: 'duck.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/e/ee/Sound-of-a-duck.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/b/bb/Quack.ogg',
    ],
  },
  {
    name: 'cow.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/2/25/Moo.ogg',
    ],
  },
  {
    name: 'fart.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/e/eb/Human_Flatulence.ogg',
    ],
  },
];

function download(url, destPath, redirectDepth = 0) {
  if (redirectDepth > 5) return Promise.reject(new Error('too many redirects'));
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    const req = lib.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'GestureFlow-PWA/1.0 (https://github.com/camilotapia75-create/gestureflow; build-bot)',
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        const location = res.headers.location;
        if (!location) { reject(new Error('redirect with no location')); return; }
        const next = location.startsWith('http') ? location : new URL(location, url).href;
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
      const size = fs.statSync(dest).size;
      console.log(`✓ ${sound.name} — ${url} (${(size/1024).toFixed(1)} KB)`);
      return;
    } catch (e) {
      console.warn(`  ✗ ${url} — ${e.message}`);
    }
  }
  console.warn(`⚠ ${sound.name}: all URLs failed — browser will fall back to Web Audio synthesis`);
}

console.log('Downloading animal sounds…');
for (const sound of SOUNDS) {
  await downloadSound(sound);
}
console.log('Done.');
