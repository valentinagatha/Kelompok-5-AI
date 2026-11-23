const fs = require('fs');
const path = require('path');

const appHtmlPath = path.join(__dirname, '..', 'app.html');
const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const layananHtmlPath = path.join(__dirname, '..', 'layanan.html');
const syaratHtmlPath = path.join(__dirname, '..', 'syarat-ketentuan.html');
const jsPath = path.join(__dirname, '..', 'script.js');

// 1. Verify all required multi-page files exist
const requiredFiles = [
  { name: 'app.html', path: appHtmlPath },
  { name: 'index.html', path: indexHtmlPath },
  { name: 'layanan.html', path: layananHtmlPath },
  { name: 'syarat-ketentuan.html', path: syaratHtmlPath },
  { name: 'script.js', path: jsPath }
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file.path)) {
    console.error(`Missing required file: ${file.name}`);
    process.exit(1);
  }
}
console.log('✓ All 4 application pages and script.js exist.');

// 2. Validate that script.js IDs are present in the interactive transfer app (app.html)
const appHtml = fs.readFileSync(appHtmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

const matches = js.match(/#([a-zA-Z0-9_-]+)/g) || [];
const ids = Array.from(new Set(matches.map(m => m.slice(1))));
const missing = ids.filter(id => !appHtml.includes(`id="${id}"`));

console.log('Checked interactive app IDs count:', ids.length);
if (missing.length > 0) {
  console.error('Missing IDs in app.html:', missing);
  process.exit(1);
} else {
  console.log('ALL interactive app IDs matched in app.html successfully!');
}
