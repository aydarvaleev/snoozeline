/* Level generator + solvability validator (Node).
   Usage: node src/gen.js <world indexes...>   (writes $OUT_DIR/part_<worlds>.json, default ./gen-out)
   Then: node src/merge.js  -> src/levels.js + src/levels.report.json

   Design:
   - World 0 levels 1-12 are hand-authored tutorial specs (one new idea per level).
   - Every later level aims at a target "minimum ink" from a smooth per-world curve.
     The generator adapts a difficulty knob until the cheapest single-stroke solution lands in the band.
   - After the tutorial a plain flat roof must NOT solve the level within its ink budget. */
const S = require('./sim.js');
const fs = require('fs');
const path = require('path');
const { Sim, rng, W, FLOOR } = S;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// --- candidate solutions (single-stroke shields), relative to the cat -------------------------
function shapes(cx, sy) {
  const out = [];
  const FAST = !!process.env.FAST;
  const widths = FAST ? [70, 90, 120, 160, 210] : [50, 70, 90, 120, 160, 210, 260];
  const heights = FAST ? [30, 45, 60, 80] : [30, 45, 60, 80, 105];
  const offs = FAST ? [0, -25, 25] : [0, -25, 25, -50, 50];
  for (const w of widths) for (const h of heights) for (const o of offs) {
    const x = cx + o;
    out.push({ n: 'roof', pts: [{ x: x - w / 2, y: sy - h }, { x: x + w / 2, y: sy - h }] });
    out.push({ n: 'pi', pts: [{ x: x - w / 2, y: sy }, { x: x - w / 2, y: sy - h }, { x: x + w / 2, y: sy - h }, { x: x + w / 2, y: sy }] });
    out.push({ n: 'tent', pts: [{ x: x - w / 2, y: sy }, { x, y: sy - h }, { x: x + w / 2, y: sy }] });
    const dome = [];
    for (let k = 0; k <= 14; k++) { const a = Math.PI * (1 - k / 14); dome.push({ x: x + Math.cos(a) * w / 2, y: sy - Math.sin(a) * h }); }
    out.push({ n: 'dome', pts: dome });
    out.push({ n: 'lean', pts: [{ x: x - w / 2, y: sy - h }, { x: x + w / 2, y: sy }] });
    out.push({ n: 'lean2', pts: [{ x: x - w / 2, y: sy }, { x: x + w / 2, y: sy - h }] });
  }
  out.forEach(c => { c.ink = S.pathLength(S.resample(c.pts, 9)); });
  out.sort((a, b) => a.ink - b.ink);
  return out;
}

function run(level, strokes) {
  const sim = new Sim(level);
  if (strokes) strokes.forEach(p => sim.addStroke(p));
  sim.state = 'running';
  let n = 0;
  while (sim.state === 'running' && n < 120 * (level.time + 3)) { sim.step(); n++; }
  return sim;
}

const probeOf = level => Object.assign({}, level, { ink: 99999 });

// a solution must survive the player drawing it a few pixels off, otherwise the level is unfair
// same test as src/verify.js: the hint must win in >= 5 of 6 slightly-off drawings
const PERTURB = [[-2, 0], [2, 0], [-5, 0], [5, 0], [0, -3], [0, -6]].map(o => p => ({ x: p.x + o[0], y: p.y + o[1] }));
function isRobust(level, pts) {
  let wins = 0;
  for (const f of PERTURB) if (run(probeOf(level), [pts.map(f)]).state === 'won') wins++;
  return wins >= 5;
}

// cheapest ROBUST single-stroke solution (shape list is sorted by ink); clean = cat never hit
function solve(level, maxInk, clean) {
  if (run(level, null).state !== 'failed') return { trivial: true };
  const cands = shapes(level.cat.x, level.cat.y);
  for (const want of clean ? [true] : [true, false]) {
    for (const c of cands) {
      if (c.ink > maxInk) break;
      const sim = run(probeOf(level), [c.pts]);
      if (sim.state === 'won' && (!want || sim.hurts === 0) && (process.env.NOROBUST || isRobust(level, c.pts))) {
        return { ink: c.ink, shape: c.n, hurts: sim.hurts, pts: c.pts };
      }
    }
  }
  return { none: true };
}

// does any plain flat roof (the "lazy" answer) win within the budget?
function roofWins(level, budget) {
  const cands = shapes(level.cat.x, level.cat.y).filter(c => c.n === 'roof' && c.ink <= budget);
  for (const c of cands) if (run(probeOf(level), [c.pts]).state === 'won') return true;
  return false;
}

// --- tutorial (world 0, levels 1-12): hand-authored, one idea per level --------------------------
const C = 180; // screen centre
const fall = (k, n, dt, t0, x0, x1, extra) => Object.assign({ k, n, dt, t0, x0, x1, jit: 0.25 }, extra || {});
const rollIn = (side, n, dt, t0, speed, cy) => {
  const sx = side < 0 ? -30 : W + 30;
  return { k: 'ball', n, dt, t0, x0: sx, x1: sx, y: (cy || FLOOR) - 14, vx: -side * speed, vy: 0, jit: 0.2 };
};
const TUTORIAL = [
  // 1. three slow balls straight onto the cat — any line above works
  { cat: 180, time: 6, emit: [fall('ball', 3, 1.4, 0.6, C - 10, C + 10)] },
  // 2. balls and boxes, a bit wider — ink limit is introduced
  { cat: 180, time: 7, emit: [fall('ball', 3, 1.3, 0.6, C - 30, C + 30), fall('pot', 2, 2.0, 1.2, C - 25, C + 25)] },
  // 3. cat off-centre, more stuff
  { cat: 120, time: 8, emit: [fall('ball', 4, 1.0, 0.5, 70, 170), fall('pot', 2, 2.2, 1.0, 80, 160)] },
  // 4. wide rain of balls — the roof must be wider
  { cat: 230, time: 8, emit: [fall('ball', 6, 0.8, 0.5, 160, 300), fall('pot', 2, 2.4, 1.4, 180, 280)] },
  // 5. NEW: balls roll in along the floor from the left — a flat roof is not enough, slant it down to the floor
  { cat: 200, time: 8, emit: [rollIn(-1, 4, 1.3, 0.8, 4.0), fall('ball', 2, 2.0, 1.4, 185, 215)] },
  // 6. same from the right, more from above
  { cat: 150, time: 8, emit: [rollIn(1, 4, 1.3, 0.8, 4.0), fall('ball', 3, 1.6, 1.2, 120, 180)] },
  // 7. rolls from both sides — tent / arch
  { cat: 180, time: 8, emit: [rollIn(-1, 3, 1.5, 0.8, 4.0), rollIn(1, 3, 1.5, 1.5, 4.0), fall('pot', 2, 2.2, 1.0, 165, 195)] },
  // 8. both sides + top
  { cat: 170, time: 9, emit: [rollIn(-1, 3, 1.6, 1.0, 3.8), rollIn(1, 3, 1.6, 1.8, 3.8), fall('ball', 4, 1.2, 0.6, 120, 220)] },
  // 9. heavy boxes from above, wide
  { cat: 200, time: 9, emit: [fall('pot', 5, 1.1, 0.5, 120, 280), fall('ball', 4, 1.3, 1.0, 130, 270)] },
  // 10. fast rollers + wide top
  { cat: 140, time: 9.5, emit: [rollIn(1, 4, 1.2, 0.8, 4.6), fall('ball', 5, 1.0, 0.6, 60, 220), fall('pot', 2, 2.5, 1.6, 80, 200)] },
  // 11. busy: both sides + wide top
  { cat: 190, time: 10, emit: [rollIn(-1, 3, 1.5, 0.8, 4.2), rollIn(1, 3, 1.5, 1.4, 4.2), fall('ball', 5, 1.0, 0.6, 110, 270), fall('pot', 2, 2.6, 1.8, 130, 250)] },
  // 12. final exam of the bedroom
  { cat: 160, time: 10.5, emit: [rollIn(-1, 4, 1.3, 0.8, 4.4), rollIn(1, 4, 1.3, 1.3, 4.4), fall('ball', 6, 0.9, 0.5, 70, 250), fall('pot', 3, 2.0, 1.2, 90, 230)] }
];

function tutorialLevel(i) {
  const t = TUTORIAL[i];
  return { world: 0, seed: 101 + i * 17, sleep: 3, cat: { x: t.cat, y: FLOOR }, statics: [], emit: t.emit, time: t.time };
}

// --- procedural worlds 1-4 -----------------------------------------------------------------------
const WORLDS = ['bedroom', 'attic', 'garden', 'workshop', 'chaos'];
// target cheapest-solution ink: [first level, last level] of each world (sawtooth that keeps rising)
const TARGET = [null, [165, 230], [185, 270], [200, 290], [230, 340]];

function rampLanding(L) {
  const probe = Object.assign({}, L, { cat: { x: -900, y: FLOOR }, emit: [Object.assign({}, L.emit[L.emit.length - 1], { n: 1, jit: 0 })], time: 6 });
  const sim = new Sim(probe); sim.state = 'running';
  for (let k = 0; k < 120 * 6; k++) {
    sim.step();
    const b = sim.threats[0];
    if (b && b.position.y > FLOOR - 20) return b.position.x;
  }
  return null;
}

function makeLevel(wi, i, seed, d) {
  const r = rng(seed);
  const dt = Math.min(d, 1); // timings stop growing at d=1, spatial spread keeps growing
  let cx = Math.round(110 + r() * 140);
  const L = { world: wi, seed, sleep: 3, cat: { x: cx, y: FLOOR }, statics: [], emit: [] };
  const shelf = wi === 1 && i >= 4 && r() < 0.4;
  if (shelf) {
    const sy = Math.round(lerp(400, 450, r()));
    L.cat.y = sy;
    L.statics.push({ x: cx, y: sy + 8, w: 150, h: 16, a: 0, kind: 'shelf' });
  }
  const cy = L.cat.y;
  const sp = lerp(35, 150, d);
  const top = (n, gap, t0) => {
    L.emit.push({ k: 'ball', n: Math.ceil(n * 0.65), dt: gap * 1.5, t0, x0: cx - sp, x1: cx + sp, jit: 0.4 });
    L.emit.push({ k: 'pot', n: Math.floor(n * 0.35) + 1, dt: gap * 2.6, t0: t0 + 0.5, x0: cx - sp, x1: cx + sp, jit: 0.4 });
  };
  const roll = (side, n, gap, t0, speed) => {
    const sx = cy < FLOOR ? cx + (side < 0 ? -68 : 68) : (side < 0 ? -30 : W + 30);
    L.emit.push({ k: 'ball', n, dt: gap, t0, x0: sx, x1: sx, y: cy - 14, vx: -side * speed, vy: 0, jit: 0.3 });
  };
  let time;
  if (wi === 1) {
    // attic: wind-blown drips from both sides, later rollers and falling junk
    time = 8.5 + dt * 3.5;
    const wind = r() < 0.5 ? -1 : 1, vx = wind * lerp(1.4, 3.2, dt), drift = 39 * Math.abs(vx);
    L.emit.push({ k: 'drip', x: cx - wind * drift, vx, spread: lerp(40, 150, d), rate: lerp(10, 18, dt), t0: 0.4, dur: time - 1.8 });
    if (i >= 1) L.emit.push({ k: 'drip', x: cx + wind * drift * lerp(0.4, 1.1, r()), vx: -vx * 0.8, spread: lerp(30, 130, d), rate: lerp(6, 13, dt), t0: 1.0, dur: time - 2.4 });
    roll(wind, 2 + Math.round(d * 4), 1.5, 1.6, lerp(3.6, 4.6, dt));
    if (i >= 2) top(2 + Math.round(d * 4), 1.4, 1.5);
  } else if (wi === 2) {
    // garden: bees home in from the sides, later from above
    time = 8 + dt * 4;
    const n = 5 + Math.round(d * 8), sd = r() < 0.5 ? -1 : 1;
    L.emit.push({ k: 'bee', n, dt: lerp(0.6, 0.3, dt), t0: 0.4, x: sd < 0 ? -18 : W + 18, y: cy - Math.round(lerp(30, 130, r())) });
    if (i >= 3) L.emit.push({ k: 'bee', n: Math.ceil(n * 0.7), dt: 0.4, t0: 1.0, x: sd < 0 ? W + 18 : -18, y: cy - Math.round(lerp(30, 220, r())) });
    if (i >= 7) L.emit.push({ k: 'bee', n: 3 + Math.round(d * 3), dt: 0.5, t0: 2.0, x: cx + Math.round((r() - 0.5) * sp), y: -20 });
  } else if (wi === 3) {
    // workshop: ramps redirect balls sideways into the cat, plus rollers and falling junk
    time = 8.5 + dt * 3.5;
    const sd = r() < 0.5 ? -1 : 1, ry = Math.round(lerp(190, 320, r()));
    const rx = sd < 0 ? lerp(50, 90, r()) : W - lerp(50, 90, r());
    L.statics.push({ x: Math.round(rx), y: ry, w: 150, h: 10, a: -sd * lerp(0.25, 0.42, r()), kind: 'ramp' });
    L.emit.push({ k: 'ball', n: 3 + Math.round(d * 6), dt: lerp(1.2, 0.6, dt), t0: 0.5, x0: rx + sd * 45, x1: rx + sd * 45 + 6, y: ry - 70, jit: 0.3 });
    // put the cat where the ramp throws the balls (probe one ball with the cat far away)
    const land = rampLanding(L);
    if (land != null) { cx = Math.round(clamp(land + (r() - 0.5) * 30, 60, W - 60)); L.cat.x = cx; }
    if (i >= 1) top(2 + Math.round(d * 5), 1.4, 1.0);
    roll(-sd, 3 + Math.round(d * 4), 1.4, 1.8, lerp(3.6, 4.6, dt));
    if (i >= 6) {
      const ry2 = ry + Math.round(lerp(20, 80, r()));
      L.statics.push({ x: Math.round(W - rx), y: ry2, w: 130, h: 10, a: sd * 0.3, kind: 'ramp' });
      L.emit.push({ k: 'ball', n: 2 + Math.round(d * 3), dt: 1.1, t0: 1.4, x0: W - rx - sd * 40, x1: W - rx - sd * 40 + 6, y: ry2 - 70, jit: 0.3 });
    }
  } else {
    // chaos: everything at once
    time = 9.5 + dt * 3.5;
    const wind = r() < 0.5 ? -1 : 1, vx = wind * 2.0, drift = 39 * Math.abs(vx);
    L.emit.push({ k: 'drip', x: cx - wind * drift, vx, spread: lerp(16, 90, d), rate: lerp(6, 12, dt), t0: 0.4, dur: time - 2 });
    const sd = r() < 0.5 ? -1 : 1;
    L.emit.push({ k: 'bee', n: 3 + Math.round(d * 7), dt: 0.5, t0: 1.0, x: sd < 0 ? -18 : W + 18, y: cy - Math.round(lerp(30, 160, r())) });
    top(3 + Math.round(d * 5), 1.3, 0.8);
    roll(-sd, 2 + Math.round(d * 3), 1.7, 1.8, 3.6);
  }
  L.time = Math.round(time * 10) / 10;
  return L;
}

// ink budget multiplier over the cheapest solution: generous early, tight late
const budgetFactor = g => g < 12 ? lerp(2.6, 2.0, g / 11) : lerp(1.9, 1.4, (g - 12) / 47);
const roundInk = v => Math.round(Math.min(640, Math.max(140, v)) / 10) * 10;

function finalize(L, sol, g) {
  L.ink = roundInk(sol.ink * budgetFactor(g));
  L.solution = sol.shape; L.minInk = Math.round(sol.ink); L.solutionPts = sol.pts; // exact: rounding changes physics outcomes
  return L;
}

module.exports = { makeLevel, solve, roofWins, run, shapes, tutorialLevel };
if (require.main === module) main();
function main() {
const PER = 12;
const levels = [];
const ONLY = process.argv.slice(2).map(Number);
for (let wi = 0; wi < WORLDS.length; wi++) {
  if (ONLY.length && !ONLY.includes(wi)) continue;
  const ONLY_I = process.env.ONLY_I ? process.env.ONLY_I.split(',').map(Number) : null;
  for (let i = 0; i < PER; i++) {
    if (ONLY_I && !ONLY_I.includes(i)) continue;
    const g = wi * PER + i;
    let found = null;
    if (wi === 0) {
      const L = tutorialLevel(i);
      const sol = solve(L, 660, true);
      if (!sol.ink) throw new Error('tutorial ' + i + ' unsolvable/trivial ' + JSON.stringify(sol));
      found = finalize(L, sol, g);
      if (i >= 4 && roofWins(found, found.ink)) console.error('  note: tutorial ' + (i + 1) + ' solvable by roof');
    } else {
      const target = lerp(TARGET[wi][0], TARGET[wi][1], i / 11), lo = target * 0.88, hi = target * 1.18;
      let d = 0.25 + 0.6 * (i / 11), best = null;
      for (let attempt = 0; attempt < (process.env.FAST ? 25 : 60) && !found; attempt++) {
        const seed = 1000 * (wi + 1) + 37 * i + attempt * 7919 + 11;
        const L = makeLevel(wi, i, seed, d);
        const sol = solve(L, hi * 1.6);
        if (sol.ink) {
          const err = sol.ink < lo ? lo - sol.ink : (sol.ink > hi ? sol.ink - hi : 0);
          if (err === 0) {
            const cand = finalize(L, sol, g);
            if (!roofWins(cand, cand.ink)) { found = cand; break; }
            d = Math.min(1.8, d + 0.08); // a roof works: make it busier
            continue;
          }
          if (!best || err < best.err) best = { err, L, sol };
          d = clamp(d + (sol.ink < lo ? 0.1 : -0.1), 0, 1.8);
        } else {
          d = clamp(d - (sol.none ? 0.12 : -0.15), 0, 1.8); // unsolvable -> easier, trivial -> harder
        }
      }
      if (!found && best) { found = finalize(best.L, best.sol, g); found.fallback = true; }
      if (!found) throw new Error('no level for world ' + wi + ' idx ' + i);
      found.target = Math.round(target);
    }
    found.id = g;
    levels.push(found);
    console.error('w' + wi + ' #' + (i + 1) + ' minInk=' + found.minInk + (found.target ? ' (target ' + found.target + ')' : '') + ' ink=' + found.ink + ' ' + found.solution + (found.fallback ? ' FALLBACK' : ''));
  }
}
const outDir = process.env.OUT_DIR || path.join(__dirname, '..', 'gen-out');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'part_' + (ONLY.join('_') || 'all') + (process.env.ONLY_I ? '_i' + process.env.ONLY_I.replace(/,/g, '-') : '') + '.json'), JSON.stringify(levels));
console.log('done', ONLY.join(','), levels.length);
}
