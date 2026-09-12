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

// 1. Standard SVG Logo (with rounded corners for standalone / web display)
const createStandardSvg = (size, isTransparentBg = false) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#059669"/>
  <g transform="translate(106, 106) scale(12.5)" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
    <path d="M2 7h20" />
    <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
  </g>
</svg>
`;

// 2. Maskable SVG Logo (Full-bleed solid #059669 background, store icon contained strictly in center 60% safe zone)
const createMaskableSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#059669"/>
  <g transform="translate(136, 136) scale(10)" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
    <path d="M2 7h20" />
    <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
  </g>
</svg>
`;

async function generate() {
  const stdSvg512 = createStandardSvg(512);
  const maskSvg512 = createMaskableSvg(512);

  // Write SVG assets
  fs.writeFileSync(path.join(iconsDir, 'icon.svg'), stdSvg512);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), stdSvg512);

  // 1. icon-192x192.png
  await sharp(Buffer.from(stdSvg512))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192x192.png'));

  // 2. icon-512x512.png
  await sharp(Buffer.from(stdSvg512))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-512x512.png'));

  // 3. icon-maskable-192x192.png
  await sharp(Buffer.from(maskSvg512))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-192x192.png'));

  // 4. icon-maskable-512x512.png
  await sharp(Buffer.from(maskSvg512))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-512x512.png'));

  // 5. apple-touch-icon.png (180x180)
  await sharp(Buffer.from(maskSvg512))
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));

  // 6. favicon.ico (64x64 PNG in root for broad browser compatibility)
  await sharp(Buffer.from(stdSvg512))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  console.log('All PWA icons generated successfully!');
}

generate().catch(console.error);
