import fs from "fs";
import sharp from "sharp";
import { createCanvas, loadImage, registerFont } from "canvas";
import * as cheerio from "cheerio";

// Link preview images (dist/<url>/og.png, 1200×630), one template for every page.
// Each page carries its own details in <script id="og-data"> (see layouts/base.html).

const W = 1200;
const H = 630;
const COLORS = {
  bg: '#0b1226', line: '#5d78c4', inner: '#2c3f78', box: '#0f1834',
  chip: '#3a4f8a', chipText: '#c4cde6', muted: '#9aa6c8', text: '#e9edf8', white: '#ffffff',
};
// Accent color comes from the campaign's dark-mode "accent" (og-data in layouts/base.html)
const LOGO = '#e6bf6a';

const ART = { x: 646, y: 76, size: 478, pad: 8 };
const LEFT = { x: 76, width: 560 };

const DIE_PATHS = [
  ['m12.312 104.848 56.86-98.822 57.35 98.331-114.21.491Z', 1],
  ['M9.062 104.384 8.24 48.312 65.782 5.86l-56.72 98.525Z', .7],
  ['M129.193 103.774l.878-55.093L72.229 5.826l56.964 97.948Z', .45],
  ['M69.172 150.174l-56.86-42.42 114.209-.907-57.349 43.327Z', .6],
];

function dieSvg(color, width) {
  const height = Math.round(width * 152 / 130);
  const paths = DIE_PATHS.map(([d, o]) => `<path d="${d}" opacity="${o}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 2 130 152" width="${width}" height="${height}"><g fill="${color}">${paths}</g></svg>`;
}

const dieCache = new Map();
function loadDie(color, width) {
  const key = `${color}/${width}`;
  if (!dieCache.has(key)) {
    // Render at 2× and draw scaled down for crisp edges
    dieCache.set(key, sharp(Buffer.from(dieSvg(color, width * 2))).png().toBuffer().then(loadImage));
  }
  return dieCache.get(key);
}

const artCache = new Map();
function loadArt(file) {
  if (!artCache.has(file)) {
    artCache.set(file, (async () => {
      const inner = ART.size - ART.pad * 2;
      const { width, height } = await sharp(file).metadata();
      if (width !== height) {
        console.warn(`[og-image] ${file} is ${width}×${height}, not square; center-cropping it.`);
      }
      const buffer = await sharp(file).resize(inner, inner, { fit: 'cover', position: 'centre' }).png().toBuffer();
      return loadImage(buffer);
    })());
  }
  return artCache.get(file);
}

export default async function (eleventyConfig) {
  eleventyConfig.on('eleventy.after', async ({ results }) => {
    registerFont('src/assets/fonts/ChakraPetch-SemiBold.ttf', { family: 'Chakra Petch', weight: '600' });
    registerFont('src/assets/fonts/ChakraPetch-Bold.ttf', { family: 'Chakra Petch', weight: '700' });

    await Promise.all(results.map(async (result) => {
      if (!result.outputPath.endsWith('/index.html')) return;

      const $ = cheerio.load(result.content);
      let data = {};
      try { data = JSON.parse($('#og-data').text() || '{}'); } catch { /* fall back to <title> */ }
      data.title ||= $('head title').text();

      const buffer = await createImage(data);
      const folder = 'dist' + result.url; // index.html lives here
      await fs.promises.mkdir(folder, { recursive: true });
      await fs.promises.writeFile(folder + 'og.png', buffer);
    }));
  });
}

async function createImage({ kicker, title, date, minutes, image, accent }) {
  const ac = /^#[0-9a-f]{3,8}$/i.test(accent || '') ? accent : LOGO;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background and double frame
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  strokeRoundRect(ctx, 24, 24, W - 48, H - 48, 8, COLORS.line, 2);
  strokeRoundRect(ctx, 32, 32, W - 64, H - 64, 5, COLORS.inner, 1);

  // Art box
  ctx.fillStyle = COLORS.box;
  roundRect(ctx, ART.x, ART.y, ART.size, ART.size, 4);
  ctx.fill();
  strokeRoundRect(ctx, ART.x, ART.y, ART.size, ART.size, 4, COLORS.line, 2);
  const art = image && fs.existsSync(image) ? await loadArt(image) : null;
  if (art) {
    ctx.drawImage(art, ART.x + ART.pad, ART.y + ART.pad, ART.size - ART.pad * 2, ART.size - ART.pad * 2);
  } else {
    const dw = 250;
    const dh = Math.round(dw * 152 / 130);
    ctx.drawImage(await loadDie(ac, dw), ART.x + (ART.size - dw) / 2, ART.y + (ART.size - dh) / 2, dw, dh);
  }

  // Top line
  let y = 84;
  ctx.textBaseline = 'top';
  if (kicker) {
    ctx.font = '600 26px "Chakra Petch"';
    ctx.fillStyle = ac;
    fillSpaced(ctx, ellipsize(ctx, kicker.toUpperCase(), LEFT.width, 0.14 * 26), LEFT.x, y, 0.14 * 26);
    y += 26 + 30;
  }

  // Title: 84px down to 56px to fit within 3 lines
  // Keep "Part 3" on one line (City of Mist episodes span several parts)
  const cleanTitle = String(title || '').replace(/\bPart (\d+)/g, 'Part\u00a0$1');
  let size = 84;
  let lines;
  for (; size >= 56; size -= 2) {
    ctx.font = `700 ${size}px "Chakra Petch"`;
    lines = wrap(ctx, cleanTitle, LEFT.width);
    if (lines.length <= 3) break;
  }
  size = Math.max(size, 56);
  ctx.font = `700 ${size}px "Chakra Petch"`;
  lines = clampLines(ctx, wrap(ctx, cleanTitle, LEFT.width), 3, LEFT.width);
  ctx.fillStyle = COLORS.white;
  const lineHeight = Math.round(size * 1.05);
  lines.forEach((line, i) => ctx.fillText(line, LEFT.x, y + i * lineHeight));
  y += lines.length * lineHeight + 28;

  // Chips
  const chips = [date, minutes ? `${minutes} min read` : ''].filter(Boolean).map((c) => c.toUpperCase());
  let x = LEFT.x;
  ctx.font = '600 24px "Chakra Petch"';
  for (const chip of chips) {
    const spacing = 0.06 * 24;
    const w = measureSpaced(ctx, chip, spacing) + 32;
    strokeRoundRect(ctx, x, y, w, 46, 4, COLORS.chip, 2);
    ctx.fillStyle = COLORS.chipText;
    fillSpaced(ctx, chip, x + 16, y + 10, spacing);
    x += w + 12;
  }

  // Signature, bottom left
  const sigBottom = H - 74;
  const dw = 44;
  const dh = Math.round(dw * 152 / 130);
  ctx.drawImage(await loadDie(LOGO, dw), LEFT.x, sigBottom - dh, dw, dh);
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 13px "Chakra Petch"';
  ctx.fillStyle = COLORS.muted;
  fillSpaced(ctx, 'RAMBLINGS OF AN', LEFT.x + dw + 16, sigBottom - 30, 0.3 * 13);
  ctx.font = '700 28px "Chakra Petch"';
  ctx.fillStyle = COLORS.text;
  fillSpaced(ctx, 'RPG ADDICT', LEFT.x + dw + 16, sigBottom - 2, 0.05 * 28);

  const buffer = canvas.toBuffer('image/png');
  return sharp(buffer).png({ compressionLevel: 9 }).toBuffer();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function strokeRoundRect(ctx, x, y, w, h, r, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  const o = width % 2 ? 0.5 : 0; // keep odd-width lines on pixel boundaries
  roundRect(ctx, x + o, y + o, w, h, r);
  ctx.stroke();
}

// node-canvas has no letterSpacing, so space characters by hand
function measureSpaced(ctx, text, spacing) {
  return [...text].reduce((w, ch) => w + ctx.measureText(ch).width + spacing, 0) - spacing;
}

function fillSpaced(ctx, text, x, y, spacing) {
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
}

function ellipsize(ctx, text, maxWidth, spacing) {
  if (measureSpaced(ctx, text, spacing) <= maxWidth) return text;
  let t = text;
  while (t.length && measureSpaced(ctx, t + '…', spacing) > maxWidth) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/[ \t\n]+/).filter(Boolean)) { // not \s, which would split on non-breaking spaces
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function clampLines(ctx, lines, max, maxWidth) {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last.includes(' ') && ctx.measureText(last + '…').width > maxWidth) {
    last = last.slice(0, last.lastIndexOf(' '));
  }
  kept[max - 1] = last.replace(/[\s.,;:–-]+$/, '') + '…';
  return kept;
}
