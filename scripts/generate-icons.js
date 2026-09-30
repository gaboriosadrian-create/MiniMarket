import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
const iconsDir = path.resolve('public/icons');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Standard SVG Icon (512x512 with pure solid white background and centered UWI "U" Isotype Logo)
const createStandardSvg = (size = 512) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="uwi-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#006AFF"/>
      <stop offset="50%" stop-color="#6366F1"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <linearGradient id="uwi-icon-dot" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00D26A"/>
      <stop offset="100%" stop-color="#006AFF"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#ffffff"/>
  <g transform="translate(86, 110) scale(3.4)" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M 22 28 C 22 56, 32 72, 50 72 C 68 72, 78 56, 78 28" stroke="url(#uwi-icon-grad)" stroke-width="13"/>
    <path d="M 50 48 L 50 28" stroke="url(#uwi-icon-grad)" stroke-width="11"/>
    <circle cx="78" cy="14" r="7" fill="url(#uwi-icon-dot)" stroke="none"/>
  </g>
</svg>
`.trim();

// 2. Maskable SVG Icon (Full-bleed white #ffffff background with centered UWI Logo in the 65% safe zone)
const createMaskableSvg = (size = 512) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="uwi-mask-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#006AFF"/>
      <stop offset="50%" stop-color="#6366F1"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <linearGradient id="uwi-mask-dot" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00D26A"/>
      <stop offset="100%" stop-color="#006AFF"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#ffffff"/>
  <g transform="translate(101, 123) scale(3.1)" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M 22 28 C 22 56, 32 72, 50 72 C 68 72, 78 56, 78 28" stroke="url(#uwi-mask-grad)" stroke-width="13"/>
    <path d="M 50 48 L 50 28" stroke="url(#uwi-mask-grad)" stroke-width="11"/>
    <circle cx="78" cy="14" r="7" fill="url(#uwi-mask-dot)" stroke="none"/>
  </g>
</svg>
`.trim();

async function generate() {
  const stdSvg512 = createStandardSvg(512);
  const maskSvg512 = createMaskableSvg(512);

  // 1. Write SVG assets
  fs.writeFileSync(path.join(iconsDir, 'icon.svg'), stdSvg512);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), stdSvg512);

  // 2. icon-192x192.png
  await sharp(Buffer.from(stdSvg512))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192x192.png'));

  // 3. icon-512x512.png
  await sharp(Buffer.from(stdSvg512))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-512x512.png'));

  // 4. icon-maskable-192x192.png
  await sharp(Buffer.from(maskSvg512))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-192x192.png'));

  // 5. icon-maskable-512x512.png
  await sharp(Buffer.from(maskSvg512))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-512x512.png'));

  // 6. apple-touch-icon.png (180x180)
  await sharp(Buffer.from(maskSvg512))
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));

  // 7. favicon.ico (64x64 PNG in root for broad browser compatibility)
  await sharp(Buffer.from(stdSvg512))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  console.log('All UWI PWA icons generated successfully with white background and login visual identity!');
}

generate().catch(console.error);
