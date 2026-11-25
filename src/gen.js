/* Level generator + solvability validator (Node). Writes src/levels.js */
const S = require('./sim.js');
const fs = require('fs');
const { Sim, rng, W, H, FLOOR } = S;

function lerp(a, b, t) { return a + (b - a) * t; }

// --- candidate solutions (single-stroke shields), relative to the cat -------------------------
function shapes(cx, sy) {
  const out = [];
  const widths = [60, 90, 120, 160, 210];
  const heights = [36, 56, 80];
  const offs = [0, -25, 25];
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

function solve(level) {
  const nostroke = run(level, null);
  if (nostroke.state !== 'failed') return { trivial: true };
  const sy = level.cat.y;
  const cands = shapes(level.cat.x, sy);
  for (const c of cands) {
    if (c.ink > 620) break;
    const probe = Object.assign({}, level, { ink: 9999 });
    const sim = run(probe, [c.pts]);
    if (sim.state === 'won') return { ink: c.ink, shape: c.n, hurts: sim.hurts };
  }
  return { none: true };
}

// --- level synthesis ---------------------------------------------------------------------------
const WORLDS = ['bedroom', 'attic', 'garden', 'workshop', 'chaos'];

function makeLevel(wi, i, seed) {
  const r = rng(seed);
  const dl = i / 11, dg = (wi * 12 + i) / 59, d = 0.3 * dl + 0.7 * dg;
  const cx = Math.round(110 + r() * 140);
  const L = { world: wi, seed, sleep: 3, cat: { x: cx, y: FLOOR }, statics: [], emit: [] };
  const shelf = wi >= 1 && i >= 5 && r() < 0.5;
  if (shelf) {
    const sy = Math.round(lerp(400, 450, r()));
    L.cat.y = sy;
    L.statics.push({ x: cx, y: sy + 8, w: 150, h: 16, a: 0, kind: 'shelf' });
  }
  const cy = L.cat.y;
  const sp = lerp(40, 135, d);
  const top = (n, dt, t0) => {
    L.emit.push({ k: 'ball', n: Math.ceil(n * 0.65), dt: dt * 1.5, t0, x0: cx - sp, x1: cx + sp, jit: 0.4 });
    L.emit.push({ k: 'pot', n: Math.floor(n * 0.35) + 1, dt: dt * 2.6, t0: t0 + 0.5, x0: cx - sp, x1: cx + sp, jit: 0.4 });
  };
  const roll = (side, n, dt, t0, speed) => {
    // ball rolling along the floor (or along the shelf) towards the cat
    const sx = cy < FLOOR ? cx + (side < 0 ? -68 : 68) : (side < 0 ? -30 : W + 30);
    L.emit.push({ k: 'ball', n, dt, t0, x0: sx, x1: sx, y: cy - 14,
      vx: -side * speed, vy: 0, jit: 0.3 });
  };
  let time;
  if (wi === 0) {
    time = 7 + d * 4;
    top(3 + Math.round(d * 7), lerp(1.2, 0.7, d), 0.6);
    if (i >= 1) { const sd = r() < 0.5 ? -1 : 1; roll(sd, 3 + Math.round(d * 5), 1.2, 1.2, 3.8);
      if (i >= 4) roll(-sd, 3 + Math.round(d * 4), 1.3, 1.8, 3.8); }
  } else if (wi === 1) {
    time = 8.5 + d * 4;
    const wind = r() < 0.5 ? -1 : 1, vx = wind * lerp(1.4, 3.0, d), drift = 39 * Math.abs(vx);
    L.emit.push({ k: 'drip', x: cx - wind * drift, vx, spread: lerp(40, 110, d), rate: lerp(10, 18, d), t0: 0.4, dur: time - 1.8 });
    if (i >= 1) L.emit.push({ k: 'drip', x: cx + wind * drift, vx: -vx, spread: lerp(30, 90, d), rate: lerp(6, 12, d), t0: 1.0, dur: time - 2.4 });
    if (i >= 2) roll(wind, 2 + Math.round(d * 4), 1.5, 1.6, 3.8);
    if (i >= 3) top(2 + Math.round(d * 4), 1.5, 1.5);
  } else if (wi === 2) {
    time = 8 + d * 4.5;
    const n = 6 + Math.round(d * 8), sd = r() < 0.5 ? -1 : 1;
    L.emit.push({ k: 'bee', n, dt: lerp(0.55, 0.3, d), t0: 0.4, x: sd < 0 ? -18 : W + 18, y: cy - Math.round(lerp(30, 130, r())) });
    if (i >= 3) L.emit.push({ k: 'bee', n: Math.ceil(n * 0.7), dt: 0.4, t0: 1.0, x: sd < 0 ? W + 18 : -18, y: cy - Math.round(lerp(30, 220, r())) });
    if (i >= 7) L.emit.push({ k: 'bee', n: 5, dt: 0.5, t0: 2.0, x: cx, y: -20 });
  } else if (wi === 3) {
    time = 8.5 + d * 4;
    const sd = r() < 0.5 ? -1 : 1, ry = Math.round(lerp(190, 300, r()));
    const rx = sd < 0 ? 70 : W - 70;
    L.statics.push({ x: rx, y: ry, w: 150, h: 10, a: sd * 0.32, kind: 'ramp' });
    L.emit.push({ k: 'ball', n: 4 + Math.round(d * 6), dt: lerp(1.2, 0.7, d), t0: 0.5, x0: rx - sd * 40, x1: rx - sd * 40 + 8, y: ry - 70, jit: 0.3 });
    top(3 + Math.round(d * 4), 1.4, 1.0);
    roll(-sd, 3 + Math.round(d * 4), 1.4, 1.8, 3.8);
    if (i >= 6) L.statics.push({ x: W - rx, y: ry + 40, w: 130, h: 10, a: -sd * 0.3, kind: 'ramp' });
  } else {
    time = 9.5 + d * 4;
    const wind = r() < 0.5 ? -1 : 1, vx = wind * 2.0, drift = 39 * Math.abs(vx);
    L.emit.push({ k: 'drip', x: cx - wind * drift, vx, spread: 16, rate: lerp(6, 11, d), t0: 0.4, dur: time - 2 });
    const sd = r() < 0.5 ? -1 : 1;
    L.emit.push({ k: 'bee', n: 4 + Math.round(d * 7), dt: 0.5, t0: 1.0, x: sd < 0 ? -18 : W + 18, y: cy - Math.round(lerp(30, 160, r())) });
    top(3 + Math.round(d * 5), 1.3, 0.8);
    roll(-sd, 2 + Math.round(d * 3), 1.7, 1.8, 3.4);
  }
  L.time = Math.round(time * 10) / 10;
  return L;
}

const PER = 12;
const levels = [];
const report = [];
let globalIdx = 0;
const ONLY = process.argv.slice(2).map(Number);
for (let wi = 0; wi < WORLDS.length; wi++) {
  if (ONLY.length && !ONLY.includes(wi)) continue;
  for (let i = 0; i < PER; i++) {
    let found = null, best = null;
    for (let attempt = 0; attempt < 40 && !found; attempt++) {
      const seed = 1000 * (wi + 1) + 37 * i + attempt * 7919 + 11;
      const L = makeLevel(wi, i, seed);
      const sol = solve(L);
      if (sol.ink && (!best || sol.ink > best.sol.ink)) best = { L, sol };
      const dg = (wi * 12 + i) / 59, need = i < 2 && wi === 0 ? 50 : 0.78 * lerp(70, 300, Math.pow(dg, 0.9));
      if (sol.ink && sol.ink >= need) {
        const factor = lerp(2.4, 1.3, dg);
        L.ink = Math.round(Math.min(620, Math.max(150, sol.ink * factor)) / 10) * 10;
        L.solution = sol.shape; L.minInk = Math.round(sol.ink);
        found = L;
        report.push(`w${wi} #${i} attempt ${attempt} shape=${sol.shape} minInk=${L.minInk} ink=${L.ink} time=${L.time}`);
      }
    }
    if (!found && best) {
      const L = best.L, sol = best.sol, dg2 = (wi * 12 + i) / 59;
      L.ink = Math.round(Math.min(620, Math.max(150, sol.ink * lerp(2.4, 1.3, dg2))) / 10) * 10;
      L.solution = sol.shape; L.minInk = Math.round(sol.ink); found = L;
      report.push(`w${wi} #${i} FALLBACK shape=${sol.shape} minInk=${L.minInk} ink=${L.ink}`);
    }
    if (!found) throw new Error('no level for world ' + wi + ' idx ' + i);
    found.id = wi * PER + i;
    levels.push(found);
    console.error('w' + wi + ' #' + i + ' minInk=' + found.minInk + ' ' + found.solution);
  }
}
const out = levels.map(l => { const o = Object.assign({}, l); return o; });
fs.writeFileSync('/tmp/part_' + (ONLY.join('_') || 'all') + '.json', JSON.stringify(out));
console.log('done', ONLY.join(','), levels.length);
