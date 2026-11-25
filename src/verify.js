/* Headless check of src/levels.js with the game's own physics:
   every level must fail with no lines, be won by its stored hint within the ink budget,
   and the hint must earn 3 stars. Usage: node src/verify.js */
global.window = {};
require('./levels.js');
const S = require('./sim.js');
const L = window.CATNAP_LEVELS;
let bad = 0;
function run(level, strokes) {
  const sim = new S.Sim(level);
  (strokes || []).forEach(p => sim.addStroke(p));
  sim.state = 'running';
  let n = 0;
  while (sim.state === 'running' && n < 120 * (level.time + 3)) { sim.step(); n++; }
  return sim;
}
L.forEach((lv, i) => {
  const problems = [];
  if (run(lv).state !== 'failed') problems.push('wins with no lines');
  if (!lv.hint) problems.push('no hint');
  else {
    const s = run(lv, [lv.hint]);
    if (s.state !== 'won') problems.push('hint does not win');
    if (s.inkUsed > lv.ink) problems.push('hint over budget ' + Math.round(s.inkUsed) + '>' + lv.ink);
    if (s.state === 'won' && s.stars() < 3) problems.push('hint earns ' + s.stars() + ' stars (hurts ' + s.hurts + ')');
    // robustness: physics differs in the last digits between browsers, and players never draw exactly,
    // so the hint must also win when drawn slightly off
    const offs = [[-2, 0], [2, 0], [-5, 0], [5, 0], [0, -3], [0, -6]];
    let ok = 0;
    offs.forEach(o => { if (run(lv, [lv.hint.map(p => ({ x: p.x + o[0], y: p.y + o[1] }))]).state === 'won') ok++; });
    if (ok < 5) problems.push('fragile: hint wins only ' + ok + '/6 when drawn slightly off');
  }
  if (problems.length) { bad++; console.log('level ' + (i + 1) + ': ' + problems.join('; ')); }
});
console.log(L.length + ' levels checked, ' + bad + ' with problems');
process.exitCode = bad ? 1 : 0;
