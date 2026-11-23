const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'index.html');
const jsPath = path.join(__dirname, '..', 'script.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

const matches = js.match(/#([a-zA-Z0-9_-]+)/g) || [];
const ids = Array.from(new Set(matches.map(m => m.slice(1))));
const missing = ids.filter(id => !html.includes(`id="${id}"`));

console.log('Checked IDs count:', ids.length);
if (missing.length > 0) {
  console.error('Missing IDs in index.html:', missing);
  process.exit(1);
} else {
  console.log('ALL IDs matched successfully! No missing IDs.');
}
