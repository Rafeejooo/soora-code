/**
 * Generate PWA icon PNGs from SVG source
 * ───────────────────────────────────────
 * Uses sharp (npm i -D sharp) to convert soranime.svg to 192x192 & 512x512 PNGs.
 *
 * Run:  node scripts/generate-icons.js
 *
 * If sharp is not installed, generates placeholder icons using canvas-free
 * SVG-in-PNG embedding approach.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');
const ICONS_DIR = join(PUBLIC, 'icons');
const SVG_PATH = join(PUBLIC, 'soranime.svg');
const MASKABLE_SVG = join(PUBLIC, 'soora.svg');

const SIZES = [192, 512];

async function generateWithSharp() {
  const sharp = (await import('sharp')).default;
  const svgBuffer = readFileSync(SVG_PATH);
  const maskableSvg = existsSync(MASKABLE_SVG) ? readFileSync(MASKABLE_SVG) : svgBuffer;

  if (!existsSync(ICONS_DIR)) mkdirSync(ICONS_DIR, { recursive: true });

  for (const size of SIZES) {
    // Regular icon (transparent background)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(ICONS_DIR, `icon-${size}x${size}.png`));
    console.log(`✓ icon-${size}x${size}.png`);

    // Maskable icon (with padding & background)
    const padding = Math.round(size * 0.1);
    const innerSize = size - padding * 2;
    await sharp(maskableSvg)
      .resize(innerSize, innerSize)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 6, g: 6, b: 14, alpha: 1 }, // #06060e
      })
      .png()
      .toFile(join(ICONS_DIR, `icon-maskable-${size}x${size}.png`));
    console.log(`✓ icon-maskable-${size}x${size}.png`);
  }

  console.log('\n✅ All icons generated in public/icons/');
}

async function generateFallback() {
  // If sharp isn't available, create SVG-embedded PNGs
  // These are valid for manifest but not pixel-perfect
  const svgContent = readFileSync(SVG_PATH, 'utf-8');

  if (!existsSync(ICONS_DIR)) mkdirSync(ICONS_DIR, { recursive: true });

  for (const size of SIZES) {
    // Create an SVG wrapper at the target size
    const wrappedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <rect width="24" height="24" fill="#06060e" rx="4"/>
  ${svgContent.replace(/<\/?svg[^>]*>/g, '')}
</svg>`;

    writeFileSync(join(ICONS_DIR, `icon-${size}x${size}.svg`), wrappedSvg);
    writeFileSync(join(ICONS_DIR, `icon-maskable-${size}x${size}.svg`), wrappedSvg);
    console.log(`✓ icon-${size}x${size}.svg (SVG fallback — install sharp for PNG)`);
  }

  console.log('\n⚠ Generated SVG fallbacks. For proper PNG icons, run:');
  console.log('  npm i -D sharp && node scripts/generate-icons.js');
}

// Main
(async () => {
  try {
    await generateWithSharp();
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' || e.message?.includes('sharp')) {
      console.log('sharp not installed — generating SVG fallbacks...\n');
      await generateFallback();
    } else {
      throw e;
    }
  }
})();
