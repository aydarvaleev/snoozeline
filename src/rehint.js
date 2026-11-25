/* Find a ROBUST hint for every level in src/levels.js: the cheapest single stroke that still wins when the
   player draws it a few pixels off (shifted left/right/up, slightly wider). Prefers solutions where the cat is
   never hit (clean = 3 stars). Writes gen-out/hints_<range>.json; then run node src/merge.js.
   Usage: [FROM=0 TO=59] [FAST=1] node src/rehint.js */
global.window = {};
require('./levels.js');
const fs = require('fs'), path = require('path');
const G = require('./gen.js');
const S = require('./sim.js');
const L = window.CATNAP_LEVELS;
const FROM = +(process.env.FROM || 0), TO = +(process.env.TO || L.length - 1);
const IDS = process.env.IDS ? process.env.IDS.split(',').map(Number) : null; // 1-based level numbers

function play(level, pts) { return G.run(Object.assign({}, level, { ink: 99999 }), [pts]); }
const PERTURB = [[-2, 0], [2, 0], [-5, 0], [5, 0], [0, -3], [0, -6]].map(o => p => ({ x: p.x + o[0], y: p.y + o[1] }));
// maxHurts: how many hits the hint may let through (0 = clean, 1 = still 3 stars, Infinity = any win)
function robust(level, pts, maxHurts) {
  let wins = 0, good = 0;
  for (const f of PERTURB) {
    const s = play(level, pts.map(f));
    if (s.state === 'won') { wins++; if (s.hurts <= maxHurts) good++; }
  }
  return wins >= 5 && (maxHurts === Infinity || good >= 4);
}
const out = [];
for (let i = FROM; i <= TO; i++) {
  if (IDS && !IDS.includes(i + 1)) continue;
  const lv = L[i];
  const cands = G.shapes(lv);
  let found = null;
  for (const maxHurts of [0, 1, Infinity]) {
    for (const c of cands) {
      if (c.ink > lv.ink * 0.85) break;            // leave the player real slack
      const s = play(lv, c.pts);
      if (s.state !== 'won' || s.hurts > maxHurts) continue;
      if (robust(lv, c.pts, maxHurts)) { found = { c, clean: maxHurts <= 1, maxHurts }; break; }
    }
    if (found) break;
  }
  if (!found) { console.log('level ' + (i + 1) + ': NO robust hint'); continue; }
  const minInk = Math.round(found.c.ink);
  const ink = Math.max(lv.ink, Math.round(minInk * 1.35 / 10) * 10);
  out.push({ id: lv.id, hint: found.c.pts, minInk, ink, shape: found.c.n, robust: true, clean: found.clean });
  console.log('level ' + (i + 1) + ': ' + found.c.n + ' ink ' + minInk + '/' + ink + (found.maxHurts === 0 ? ' clean' : found.maxHurts === 1 ? ' 1 bump' : ' (hurts)'));
}
const dir = path.join(__dirname, '..', 'gen-out'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'hints_' + (IDS ? 'ids' + IDS.join('-') : FROM + '-' + TO) + '.json'), JSON.stringify(out));
