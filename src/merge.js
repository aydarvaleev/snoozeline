/* Merge gen-out/part_*.json into src/levels.js (game data) and src/levels.report.json (full report). */
const fs = require('fs');
const path = require('path');
const dir = process.env.OUT_DIR || path.join(__dirname, '..', 'gen-out');
const all = [];
fs.readdirSync(dir).filter(f => /^part_.*\.json$/.test(f)).forEach(f => {
  JSON.parse(fs.readFileSync(path.join(dir, f))).forEach(l => { all[l.id] = l; });
});
if (process.env.FILL_OLD) {
  // temporary: fill missing ids from the previous report (for testing before generation finishes)
  const old = JSON.parse(fs.readFileSync(path.join(dir, 'old_report.json')));
  old.forEach(l => { if (!all[l.id]) { all[l.id] = Object.assign({}, l, { old: true }); } });
}
const levels = all.filter(Boolean);
// robust hints from src/rehint.js override the generator's hint/minInk/ink
fs.readdirSync(dir).filter(f => /^hints_.*\.json$/.test(f)).forEach(f => {
  JSON.parse(fs.readFileSync(path.join(dir, f))).forEach(h => { const l = all[h.id]; if (l) Object.assign(l, { hint: h.hint, minInk: h.minInk, ink: h.ink, solution: h.shape, robust: h.robust, clean: h.clean }); });
});
if (levels.length !== 60) console.warn('warning: ' + levels.length + ' levels merged');
// chaos is the most chaotic physics: the cat sleeps deeper there (4 hits) so slightly-off drawings still work
levels.forEach(l => { if (l.world === 4) l.sleep = 4; });
const game = levels.map(l => ({
  id: l.id, world: l.world, seed: l.seed, sleep: l.sleep, cat: l.cat, statics: l.statics, furniture: l.furniture || [],
  emit: l.emit, // full precision: the physics is chaotic, rounding changes outcomes
  time: l.time, ink: l.ink, minInk: l.minInk, hint: l.hint || l.solutionPts
}));
// bumps = hits the reference hint lets through; 3 stars stay reachable for anyone doing as well
{
  const S = require('./sim.js');
  game.forEach(lv => {
    if (!lv.hint) return;
    const sim = new S.Sim(Object.assign({}, lv, { ink: 99999 })); sim.addStroke(lv.hint); sim.state = 'running';
    let n = 0; while (sim.state === 'running' && n < 120 * (lv.time + 3)) { sim.step(); n++; }
    lv.bumps = sim.state === 'won' ? sim.hurts : 0;
  });
}
fs.writeFileSync(path.join(__dirname, 'levels.js'), 'window.CATNAP_LEVELS=' + JSON.stringify(game) + ';\n');
fs.writeFileSync(path.join(__dirname, 'levels.report.json'), JSON.stringify(levels, null, 1));
for (let w = 0; w < 5; w++) {
  const L = levels.filter(l => l.world === w);
  console.log('world ' + w + ': ' + L.map(l => l.minInk + (l.fallback ? '!' : '') + (l.old ? 'o' : '')).join(' ') + '  | ' + L.map(l => l.solution).join(','));
}
