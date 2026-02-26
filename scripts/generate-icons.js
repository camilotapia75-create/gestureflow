#!/usr/bin/env node
/**
 * Run: node scripts/generate-icons.js
 * Requires: npm install -g sharp (or add sharp to devDependencies)
 *
 * Alternatively you can convert public/icons/icon.svg manually at:
 * https://convertio.co/svg-png/
 * Sizes needed: 192x192 and 512x512
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/icons/icon.svg');
const outDir = path.join(__dirname, '../public/icons');

try {
  require('sharp');
  const sharp = require('sharp');
  const svgBuffer = fs.readFileSync(svgPath);

  sharp(svgBuffer).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'), (err) => {
    if (err) console.error('192px error:', err);
    else console.log('✅ icon-192.png generated');
  });

  sharp(svgBuffer).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'), (err) => {
    if (err) console.error('512px error:', err);
    else console.log('✅ icon-512.png generated');
  });
} catch {
  console.log('sharp not installed. Creating placeholder PNGs...');
  // Create tiny 1x1 PNG placeholders so the manifest doesn't 404
  // Real icons: convert public/icons/icon.svg at https://svgtopng.com
  const placeholder = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(path.join(outDir, 'icon-192.png'), placeholder);
  fs.writeFileSync(path.join(outDir, 'icon-512.png'), placeholder);
  console.log('✅ Placeholder icons created. For production, convert icon.svg to proper PNGs.');
}
