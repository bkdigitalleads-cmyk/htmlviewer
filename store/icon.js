const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// HTML Viewer's icon.
// `node icon.js options` writes docs/design/icon-options.png: three concepts
// in the app's own palette (paper, ink, reading-lamp teal), each large and
// at 60 px on a light and a dark wallpaper. Brian picks one; none is chosen
// here.
//   folio    - a page with a folded corner, its top half text, its lower half
//              code brackets: the page and its code, the app's two views
//   brackets - large angle brackets in paper white framing a small page, on ink
//   lens     - a reading lens over a page of code lines, on paper
// No letters, no browser or editor marks, no globe or compass.
// `node icon.js` writes the shipped files (assets/icon.png, the splash icons,
// the Android foreground, the favicon and the website icons) from CHOSEN.
// Until Brian picks, CHOSEN is null and the shipped files are a plain teal
// stand-in tile with a page outline.
const CHOSEN = null;

const ROOT = path.join(__dirname, '..');
const INK = '#16171A';
const PAPER = '#F6F5F2';
const WHITE = '#FFFFFF';
const TEAL = '#0B6E66';
const TEAL_DEEP = '#08524C';
const MINT = '#5BC9BE';
const RULE = '#D9D6CF';

const art = {
  folio: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="${TEAL}"/>
    <defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#00110F" flood-opacity="0.35"/></filter></defs>
    <g filter="url(#s)">
      <path d="M262 168h346l154 154v486c0 26-21 48-48 48H262c-26 0-48-22-48-48V216c0-26 22-48 48-48z" fill="${WHITE}"/>
      <path d="M608 168v106c0 26 22 48 48 48h106z" fill="#D7EEEB"/>
    </g>
    <rect x="290" y="268" width="250" height="34" rx="17" fill="${INK}"/>
    <rect x="290" y="336" width="400" height="22" rx="11" fill="${RULE}"/>
    <rect x="290" y="384" width="350" height="22" rx="11" fill="${RULE}"/>
    <line x1="268" y1="478" x2="756" y2="478" stroke="#E7E4DE" stroke-width="6"/>
    <path d="M420 560l-96 82 96 82" stroke="${TEAL}" stroke-width="44" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M604 560l96 82-96 82" stroke="${TEAL}" stroke-width="44" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M548 540l-72 204" stroke="${INK}" stroke-width="36" fill="none" stroke-linecap="round"/>
  </svg>`,
  brackets: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="${INK}"/>
    <path d="M300 300L128 512l172 212" stroke="${MINT}" stroke-width="70" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M724 300l172 212-172 212" stroke="${MINT}" stroke-width="70" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M392 288h180l76 76v342c0 18-14 32-32 32H392c-18 0-32-14-32-32V320c0-18 14-32 32-32z" fill="${PAPER}"/>
    <path d="M572 288v58c0 10 8 18 18 18h58z" fill="#CFE9E5"/>
    <rect x="404" y="388" width="140" height="24" rx="12" fill="${INK}"/>
    <rect x="404" y="440" width="200" height="16" rx="8" fill="${RULE}"/>
    <rect x="404" y="476" width="170" height="16" rx="8" fill="${RULE}"/>
    <rect x="404" y="528" width="200" height="110" rx="12" fill="#CFE9E5"/>
    <rect x="404" y="664" width="120" height="16" rx="8" fill="${RULE}"/>
  </svg>`,
  lens: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="${PAPER}"/>
    <path d="M236 150h400l150 150v574H236z" fill="${WHITE}" stroke="${RULE}" stroke-width="8"/>
    <path d="M636 150v150h150" fill="#ECEAE5" stroke="${RULE}" stroke-width="8" stroke-linejoin="round"/>
    ${[
      [290, 250, 180, INK], [290, 320, 300, TEAL], [340, 390, 250, '#A8A49B'], [340, 460, 330, TEAL], [290, 530, 210, INK], [290, 600, 380, '#A8A49B'], [340, 670, 220, TEAL], [290, 740, 260, INK],
    ].map(([x, y, w, c]) => `<rect x="${x}" y="${y}" width="${w}" height="30" rx="15" fill="${c}"/>`).join('')}
    <circle cx="610" cy="560" r="190" fill="${WHITE}" fill-opacity="0.55" stroke="${TEAL_DEEP}" stroke-width="54"/>
    <path d="M748 700l150 150" stroke="${TEAL_DEEP}" stroke-width="80" stroke-linecap="round"/>
  </svg>`,
};

/** The stand-in until Brian picks: the teal tile with a plain page outline. */
const standIn = () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${TEAL}"/>
  <path d="M330 220h290l140 140v420c0 22-18 40-40 40H330c-22 0-40-18-40-40V260c0-22 18-40 40-40z" fill="none" stroke="${WHITE}" stroke-width="40" stroke-linejoin="round"/>
  <path d="M620 220v100c0 22 18 40 40 40h100" fill="none" stroke="${WHITE}" stroke-width="40" stroke-linejoin="round"/>
</svg>`;

const NAMES = { folio: '1. Folio', brackets: '2. Brackets', lens: '3. Lens' };

async function png(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

/** The tile with iOS-like rounded corners, for showing on a wallpaper. */
async function rounded(svg, size) {
  const r = Math.round(size * 0.225);
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`);
  return sharp(await png(svg, size)).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function options() {
  const W = 1500;
  const H = 820;
  const col = W / 3;
  const layers = [];
  const labels = [];
  let i = 0;
  for (const key of Object.keys(art)) {
    const svg = art[key]();
    const x = Math.round(i * col);
    layers.push({ input: await rounded(svg, 360), left: x + Math.round((col - 360) / 2), top: 70 });
    // A hairline round the large tile, so a paper-colored concept still shows its edge on the sheet.
    layers.push({ input: Buffer.from(`<svg width="362" height="362"><rect x="1" y="1" width="360" height="360" rx="81" fill="none" stroke="#C9C6BF" stroke-width="1.5"/></svg>`), left: x + Math.round((col - 360) / 2) - 1, top: 69 });
    // 60 px on a light and a dark wallpaper.
    for (const [k, bg] of [[0, '#DCE3EA'], [1, '#1C2230']]) {
      const wx = x + Math.round(col / 2) - 150 + k * 160;
      layers.push({ input: await sharp({ create: { width: 140, height: 140, channels: 4, background: bg } }).png().toBuffer(), left: wx, top: 520 });
      layers.push({ input: await rounded(svg, 60), left: wx + 40, top: 560 });
    }
    labels.push(`<text x="${x + col / 2}" y="480" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="${INK}" text-anchor="middle">${NAMES[key]}</text>`);
    labels.push(`<text x="${x + col / 2}" y="700" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#55575D" text-anchor="middle">60 px, light and dark wallpaper</text>`);
    i++;
  }
  const head = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="${PAPER}"/>
    <text x="40" y="44" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#55575D">HTML Viewer icon options. None is picked: Brian picks one, then node store/icon.js writes the shipped files.</text>
    ${labels.join('')}
    <text x="40" y="780" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#7D7F86">No letters, no browser or editor marks. Square 1024 masters, RGB with no alpha; iOS rounds the corners.</text></svg>`;
  const out = path.join(ROOT, 'docs/design/icon-options.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(head)).composite(layers).png().toFile(out);
  console.log('wrote', out);
}

async function shipped() {
  const svg = CHOSEN ? art[CHOSEN]() : standIn();
  const bg = CHOSEN === 'brackets' ? INK : CHOSEN === 'lens' ? PAPER : TEAL;
  const write = (rel, buf) => {
    const f = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, buf);
    console.log('wrote', rel);
  };
  // 1024 RGB with no alpha, square corners (iOS rounds them).
  write('assets/icon.png', await sharp(await png(svg, 1024)).removeAlpha().png().toBuffer());
  // Android adaptive foreground: the mark at 62% in the middle of the same tile.
  const fg = await png(svg, 640);
  write('assets/android-icon-foreground.png', await sharp({ create: { width: 1024, height: 1024, channels: 3, background: bg } }).composite([{ input: fg, left: 192, top: 192 }]).png().toBuffer());
  // Splash: the rounded tile on paper (light) or graphite (dark).
  for (const [name, back] of [['splash-icon.png', PAPER], ['splash-icon-dark.png', '#121314']]) {
    write(`assets/${name}`, await sharp({ create: { width: 512, height: 512, channels: 4, background: back } }).composite([{ input: await rounded(svg, 400), left: 56, top: 56 }]).png().toBuffer());
  }
  write('assets/favicon.png', await rounded(svg, 64));
  write('docs/apple-touch-icon.png', await sharp(await png(svg, 180)).removeAlpha().png().toBuffer());
  write('docs/icon-512.png', await rounded(svg, 512));
}

const MODES = { options, shipped };
const mode = process.argv[2] ?? 'shipped';
(MODES[mode] ?? shipped)().catch((e) => {
  console.error(e);
  process.exit(1);
});
module.exports = { CHOSEN };
