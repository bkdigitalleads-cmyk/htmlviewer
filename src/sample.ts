/**
 * The sample page that ships inside the app: an HTML file with a style
 * sheet and a picture beside it, linked by relative paths, the way a saved
 * page or an exported report arrives. Settings, Open the sample page, puts
 * it on the recent list; App Review uses it. Made-up content, no brands.
 */

export const SAMPLE_NAME = 'Sample page.html';

export const SAMPLE_FILES: { path: string; text: string }[] = [
  {
    path: 'Sample page.html',
    text: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Garden club, spring report</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header>
    <p class="kicker">Spring report</p>
    <h1>Maple Street Garden Club</h1>
    <p class="lede">Twelve beds, forty-one members and the first tomatoes of the year.</p>
  </header>

  <figure>
    <img src="images/harvest.svg" alt="A bar chart of the harvest by month">
    <figcaption>Harvest by month, in pounds.</figcaption>
  </figure>

  <h2>What we grew</h2>
  <table>
    <thead><tr><th>Bed</th><th>Crop</th><th>Pounds</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Tomatoes</td><td>48</td></tr>
      <tr><td>2</td><td>Beans</td><td>31</td></tr>
      <tr><td>3</td><td>Squash</td><td>27</td></tr>
      <tr><td>4</td><td>Herbs</td><td>9</td></tr>
    </tbody>
  </table>

  <h2>Next month</h2>
  <ul>
    <li>Seed swap on the first Saturday, 10 AM.</li>
    <li>Water rota: two people a day, sign up at the shed.</li>
    <li>Compost delivery to beds 5 to 8.</li>
  </ul>

  <p class="note">This page was opened from the app's own copy. Its style sheet and chart sit beside it in the same folder, linked by relative paths. Links to the web, like <a href="https://example.com">example.com</a>, open in the browser.</p>
</body>
</html>
`,
  },
  {
    path: 'css/style.css',
    text: `:root { --ink: #1d2a24; --soft: #5b6a63; --leaf: #2f7d55; --paper: #fbfaf6; }
body { margin: 0; padding: 28px 22px 48px; font: 17px/1.55 Georgia, serif; color: var(--ink); background: var(--paper); }
header { border-bottom: 2px solid var(--leaf); padding-bottom: 14px; margin-bottom: 20px; }
.kicker { margin: 0; text-transform: uppercase; letter-spacing: .12em; font: 600 12px/1.4 -apple-system, sans-serif; color: var(--leaf); }
h1 { font-size: 30px; line-height: 1.15; margin: 6px 0 8px; }
h2 { font-size: 21px; margin: 28px 0 8px; }
.lede { color: var(--soft); margin: 0; }
figure { margin: 0; }
figure img { width: 100%; height: auto; display: block; border-radius: 10px; background: #fff; }
figcaption { font: 13px/1.4 -apple-system, sans-serif; color: var(--soft); margin-top: 6px; }
table { width: 100%; border-collapse: collapse; font: 15px/1.4 -apple-system, sans-serif; }
th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e3e0d6; }
th { color: var(--soft); font-weight: 600; }
td:last-child, th:last-child { text-align: right; }
.note { margin-top: 28px; padding: 12px 14px; border-left: 3px solid var(--leaf); background: #eef5f0; font: 14px/1.5 -apple-system, sans-serif; }
`,
  },
  {
    path: 'images/harvest.svg',
    text: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" font-family="-apple-system, sans-serif" font-size="11">
  <rect width="320" height="160" fill="#ffffff"/>
  <g fill="#2f7d55">
    <rect x="30" y="110" width="44" height="30" rx="4"/>
    <rect x="100" y="80" width="44" height="60" rx="4"/>
    <rect x="170" y="44" width="44" height="96" rx="4"/>
    <rect x="240" y="22" width="44" height="118" rx="4"/>
  </g>
  <g fill="#5b6a63" text-anchor="middle">
    <text x="52" y="154">Mar</text><text x="122" y="154">Apr</text><text x="192" y="154">May</text><text x="262" y="154">Jun</text>
  </g>
  <line x1="20" y1="140.5" x2="300" y2="140.5" stroke="#c9d3cd"/>
</svg>
`,
  },
];
