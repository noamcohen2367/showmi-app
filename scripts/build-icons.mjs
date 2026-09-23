/**
 * Generate the flat icon assets from the Icon Composer bundle.
 *
 * `.icon` is read only by iOS 26+. Android, the web favicon, and older iOS
 * all need rasterised PNGs, so the bundle's composition is rebuilt here.
 *
 * An approximation by nature: Icon Composer applies shadow, translucency and
 * light/dark appearance variants on device, and none of that survives being
 * flattened. Composition, scale, opacity and order are what carry over.
 *
 * `scale` was confirmed to be relative to each asset's natural size, not to
 * a fit against the canvas — rendering both showed the latter overflowing
 * the canvas entirely.
 *
 * Run it after changing the logo:
 *
 *     node scripts/build-icons.mjs
 *
 * then `npx expo prebuild -p ios` to copy the results into the native
 * project. The generated PNGs are committed, so a normal build never needs
 * this — only a change to `assets/showmi-logo.icon` does.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const at = (relative) => fileURLToPath(new URL(relative, ROOT));

// sharp is a dependency of the scraper, not of the app — the app must never
// import from `scraper/`, but a build script at the repo root may borrow it
// rather than adding a second copy of a large native module.
const require = createRequire(at('scraper/package.json'));
const sharp = require('sharp');

const ICON_DIR = at('assets/showmi-logo.icon');
const IMAGES = at('assets/images');
const SIZE = 1024;

/**
 * Android masks adaptive icons down to an inner circle/squircle: only the
 * middle ~66% is guaranteed visible. The foreground is shrunk to fit inside
 * that, or the mark's arms get clipped on round-icon launchers.
 */
const ANDROID_SAFE = 0.62;

const manifest = JSON.parse(readFileSync(`${ICON_DIR}/icon.json`, 'utf8'));
const layers = manifest.groups[0].layers;

function readLayer(name) {
  const raw = readFileSync(`${ICON_DIR}/Assets/${name}`, 'utf8');
  const open = raw.indexOf('>', raw.indexOf('<svg')) + 1;
  const rootTag = raw.slice(raw.indexOf('<svg'), open);
  return {
    inner: raw.slice(open, raw.lastIndexOf('</svg>')),
    width: Number(/width="(\d+(?:\.\d+)?)"/.exec(rootTag)[1]),
    height: Number(/height="(\d+(?:\.\d+)?)"/.exec(rootTag)[1]),
  };
}

const p3ToHex = (spec) => {
  const [r, g, b] = spec.split(':')[1].split(',').map(Number);
  const c = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
};

const [GRADIENT_FROM, GRADIENT_TO] = manifest.fill['linear-gradient'].map(p3ToHex);

/**
 * The two layers, drawn back to front (Icon Composer lists them front first).
 *
 * `flatten` is for Android's monochrome icon, which the launcher tints a
 * single colour itself: gradients and partial opacity only muddy a shape
 * that is about to be recoloured anyway, so both layers become solid white.
 */
function markup(extraScale = 1, flatten = false) {
  return [...layers]
    .reverse()
    .map((layer) => {
      let { inner } = readLayer(layer['image-name']);
      const { width, height } = readLayer(layer['image-name']);
      if (flatten) {
        inner = inner
          .replace(/(fill|stroke)="url\(#[^)]*\)"/g, '$1="white"')
          .replace(/(fill|stroke)="(?!none)[^"]*"/g, '$1="white"');
      }
      const scale = (layer.position?.scale ?? 1) * extraScale;
      const [tx = 0, ty = 0] = layer.position?.['translation-in-points'] ?? [];
      const x = (SIZE - width * scale) / 2 + tx * extraScale;
      const y = (SIZE - height * scale) / 2 + ty * extraScale;
      const opacity = flatten ? 1 : (layer.opacity ?? 1);
      return `<g opacity="${opacity}" transform="translate(${x} ${y}) scale(${scale})">${inner}</g>`;
    })
    .join('\n');
}

const backgroundDef = `<defs><linearGradient id="__bg" x1="0" y1="0" x2="0" y2="${SIZE}" gradientUnits="userSpaceOnUse">
<stop stop-color="${GRADIENT_FROM}"/><stop offset="1" stop-color="${GRADIENT_TO}"/></linearGradient></defs>`;

const svgDoc = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`;

const withBackground = svgDoc(
  `${backgroundDef}<rect width="${SIZE}" height="${SIZE}" fill="url(#__bg)"/>${markup()}`,
);
const backgroundOnly = svgDoc(
  `${backgroundDef}<rect width="${SIZE}" height="${SIZE}" fill="url(#__bg)"/>`,
);
const foregroundOnly = svgDoc(markup(ANDROID_SAFE));
const monochromeOnly = svgDoc(markup(ANDROID_SAFE, true));
// The splash sits on a solid colour the config supplies, so it carries the
// mark alone — and larger than the Android foreground, which has no mask to
// survive.
const splashOnly = svgDoc(markup(0.8));

const outputs = [
  // Top-level icon: the iOS fallback before 26, and Expo's generic source.
  [`${IMAGES}/showmi-icon.png`, withBackground, SIZE],
  // Android adaptive icon, which the launcher composites and masks itself.
  [`${IMAGES}/showmi-android-foreground.png`, foregroundOnly, SIZE],
  [`${IMAGES}/showmi-android-background.png`, backgroundOnly, SIZE],
  [`${IMAGES}/showmi-android-monochrome.png`, monochromeOnly, SIZE],
  [`${IMAGES}/showmi-splash-icon.png`, splashOnly, SIZE],
  // Favicons are shown at 16-32px, where the gradient is noise; the shape is
  // all that survives, so the full composition is simply scaled down.
  [`${IMAGES}/showmi-favicon.png`, withBackground, 96],
];

for (const [path, svg, size] of outputs) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  writeFileSync(path, buf);
  console.log(`${path.split('/').pop().padEnd(34)} ${size}x${size}  ${(buf.length / 1024).toFixed(0)}KB`);
}

console.log(`\nbackground gradient: ${GRADIENT_FROM} -> ${GRADIENT_TO}`);
