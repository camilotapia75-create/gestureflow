/**
 * Downloads animal sound files from Wikimedia Commons at build time.
 * Runs as `prebuild` on Vercel (full internet access) so sounds are
 * served from the same origin — no CORS issues in the browser.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'sounds');

fs.mkdirSync(OUT_DIR, { recursive: true });

// Multiple candidate URLs per sound — first successful download wins.
// All files are public domain from Wikimedia Commons.
const SOUNDS = [
  {
    name: 'cat.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/2/2a/Cat_meowing_2.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/0/0b/Cat_meow.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/2/29/Cat_meowing.ogg',
    ],
  },
  {
    name: 'dog.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/2/2b/Bark%2C_Dog%2C_Loud_A.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/f/f3/Dog_barking.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/6/67/Beagle_beagling.ogg',
    ],
  },
  {
    name: 'duck.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/4/47/Sound-of-a-duck.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/b/b2/Mallard_duck_quacking.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/a/a6/Duck_quacking.ogg',
    ],
  },
  {
    name: 'cow.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/d/d8/Moo.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/3/3e/Cow_moo.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/0/0b/Cow_mooing.ogg',
    ],
  },
  {
    name: 'fart.ogg',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/4/4e/Human_Flatulence.ogg',
      'https://upload.wikimedia.org/wikipedia/commons/9/99/Human_flatulence.ogg',
    ],
  },
];

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = https.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        download(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    });
    req.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function downloadSound(sound) {
  const dest = path.join(OUT_DIR, sound.name);
  // Skip if already downloaded (e.g. local dev re-runs)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log(`✓ ${sound.name} (cached)`);
    return;
  }
  for (const url of sound.urls) {
    try {
      await download(url, dest);
      console.log(`✓ ${sound.name} — ${url}`);
      return;
    } catch (e) {
      console.warn(`  ✗ ${url} — ${e.message}`);
    }
  }
  console.warn(`⚠ ${sound.name}: all URLs failed — will fall back to synthesis`);
}

console.log('Downloading animal sounds…');
for (const sound of SOUNDS) {
  await downloadSound(sound);
}
console.log('Done.');
