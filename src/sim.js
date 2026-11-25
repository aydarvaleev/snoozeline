/* Snoozeline physics core — shared by the browser game and the Node level generator. No DOM here. */
(function (root) {
  'use strict';
  var M = (typeof module === 'object' && typeof require === 'function') ? require('matter-js') : root.Matter;

  var W = 360, H = 600, FLOOR = 548;
  var DT = 1000 / 120;            // physics step, ms (two steps per 60 fps frame)
  var STEP_S = DT / 1000;
  var WET_MAX = 10;               // water drops that wake the cat
  var T = 7;                      // stroke thickness
  var CAT_BIT = 1, BALL_BIT = 2, DROP_BIT = 4, BEE_BIT = 8;

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function resample(pts, step) {
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var a = out[out.length - 1], b = pts[i];
      var d = Math.hypot(b.x - a.x, b.y - a.y);
      while (d >= step) {
        var k = step / d;
        var n = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        out.push(n); a = n; d = Math.hypot(b.x - a.x, b.y - a.y);
      }
    }
    var last = pts[pts.length - 1], lo = out[out.length - 1];
    if (Math.hypot(last.x - lo.x, last.y - lo.y) > step * 0.35) out.push({ x: last.x, y: last.y });
    return out;
  }

  function pathLength(pts) {
    var l = 0;
    for (var i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return l;
  }

  function strokeBody(points) {
    var p = resample(points, 9);
    if (p.length < 2) return null;
    var parts = [], len = 0, i;
    var o = { friction: 0.8, frictionStatic: 1, restitution: 0.05, density: 0.012,
      collisionFilter: { category: CAT_BIT, mask: 0xFFFF } };
    for (i = 0; i < p.length - 1; i++) {
      var a = p[i], b = p[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y);
      len += l;
      parts.push(M.Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, l + 1, T,
        Object.assign({ angle: Math.atan2(b.y - a.y, b.x - a.x) }, o)));
    }
    for (i = 0; i < p.length; i++) parts.push(M.Bodies.circle(p[i].x, p[i].y, T / 2, o));
    var body = M.Body.create({ parts: parts, friction: 0.8, frictionStatic: 1, restitution: 0.05,
      label: 'stroke', collisionFilter: { category: CAT_BIT, mask: 0xFFFF } });
    // Matter sums the parts' own inertias without the parallel-axis term, so a long line would get
    // a tiny moment of inertia and spin/jitter wildly at the slightest touch. Use the real value.
    var I = 0;
    for (i = 1; i < body.parts.length; i++) {
      var q = body.parts[i], dx = q.position.x - body.position.x, dy = q.position.y - body.position.y;
      I += q.inertia + q.mass * (dx * dx + dy * dy);
    }
    M.Body.setInertia(body, I);
    body.inkLen = len;
    body.local = p.map(function (q) { return { x: q.x - body.position.x, y: q.y - body.position.y }; });
    return body;
  }

  /* Furniture: one record {k, x, side} -> solid rectangles (shared by sim, generator and art).
     top(f) is the surface the cat sleeps on. Side view, y grows downwards, FLOOR is the floor line. */
  var FURN = {
    nightstand: { w: 132, h: 112 },
    sofa: { w: 152, seat: 60, arm: 24, armH: 106 },
    chair: { w: 124, seat: 80, back: 130 },
    table: { w: 196, h: 122 },
    wall: { w: 22 },
    stairs: { n: 4, sw: 84, rise: 40 }
  };
  function furnitureParts(f) {
    var d = FURN[f.k], x = f.x, out = [];
    if (f.k === 'nightstand') out.push({ x: x, y: FLOOR - d.h / 2, w: d.w, h: d.h });
    else if (f.k === 'sofa') {
      out.push({ x: x, y: FLOOR - d.seat / 2, w: d.w, h: d.seat });
      out.push({ x: x - d.w / 2 + d.arm / 2, y: FLOOR - d.armH / 2, w: d.arm, h: d.armH });
      out.push({ x: x + d.w / 2 - d.arm / 2, y: FLOOR - d.armH / 2, w: d.arm, h: d.armH });
    } else if (f.k === 'chair') {
      var sd = f.side || 1;
      out.push({ x: x, y: FLOOR - d.seat + 6, w: d.w, h: 12 });
      out.push({ x: x - d.w / 2 + 6, y: FLOOR - (d.seat - 12) / 2, w: 8, h: d.seat - 12 });
      out.push({ x: x + d.w / 2 - 6, y: FLOOR - (d.seat - 12) / 2, w: 8, h: d.seat - 12 });
      out.push({ x: x + sd * (d.w / 2 - 5), y: FLOOR - d.seat - d.back / 2, w: 10, h: d.back });
    } else if (f.k === 'table') {
      out.push({ x: x, y: FLOOR - d.h + 7, w: d.w, h: 14 });
      out.push({ x: x - d.w / 2 + 10, y: FLOOR - (d.h - 14) / 2, w: 12, h: d.h - 14 });
      out.push({ x: x + d.w / 2 - 10, y: FLOOR - (d.h - 14) / 2, w: 12, h: d.h - 14 });
    } else if (f.k === 'wall') {
      out.push({ x: (f.side || -1) < 0 ? d.w / 2 : W - d.w / 2, y: FLOOR / 2 - 20, w: d.w, h: FLOOR + 40 });
    } else if (f.k === 'stairs') {
      // highest step at the given side; step i counted from that side
      var sd2 = f.side || -1;
      for (var i = 0; i < d.n; i++) {
        var hh = (d.n - i) * d.rise, cx = sd2 < 0 ? d.sw * (i + 0.5) : W - d.sw * (i + 0.5);
        out.push({ x: cx, y: FLOOR - hh / 2, w: d.sw, h: hh });
      }
    }
    return out;
  }
  // where a cat sleeps on a piece of furniture: {x, y}
  function furnitureSpot(f) {
    var d = FURN[f.k];
    if (f.k === 'nightstand') return { x: f.x, y: FLOOR - d.h };
    if (f.k === 'sofa') return { x: f.x, y: FLOOR - d.seat };
    if (f.k === 'chair') return { x: f.x + (f.side || 1) * 11, y: FLOOR - d.seat }; // near the backrest: free seat in front for a line
    if (f.k === 'table') return f.under ? { x: f.x, y: FLOOR } : { x: f.x, y: FLOOR - d.h };
    if (f.k === 'wall') return { x: (f.side || -1) < 0 ? d.w + 46 : W - d.w - 46, y: FLOOR };
    if (f.k === 'stairs') { var st = f.step || 1, sd = f.side || -1; return { x: sd < 0 ? d.sw * (st + 0.5) : W - d.sw * (st + 0.5), y: FLOOR - (d.n - st) * d.rise }; }
    return { x: f.x, y: FLOOR };
  }

  function expandEvents(level, r) {
    var ev = [];
    (level.emit || []).forEach(function (e) {
      var i, t;
      if (e.k === 'ball' || e.k === 'pot') {
        for (i = 0; i < e.n; i++) {
          t = e.t0 + i * e.dt + (r() - 0.5) * (e.jit || 0);
          ev.push({ t: t, k: e.k, x: e.x0 + (e.x1 - e.x0) * r(), y: e.y == null ? -30 : e.y,
            vx: e.vx || 0, vy: e.vy || 0, s: (e.s || 1) * (0.85 + r() * 0.3) });
        }
      } else if (e.k === 'drip') {
        var n = Math.floor(e.rate * e.dur);
        for (i = 0; i < n; i++) {
          ev.push({ t: e.t0 + i / e.rate + r() * 0.05, k: 'drop', x: e.x + (r() - 0.5) * (e.spread || 10),
            y: e.y == null ? -10 : e.y, vx: e.vx || 0, vy: 0 });
        }
      } else if (e.k === 'bee') {
        for (i = 0; i < e.n; i++) {
          ev.push({ t: e.t0 + i * e.dt, k: 'bee', x: e.x + (r() - 0.5) * 10, y: e.y + (r() - 0.5) * 40, vx: 0, vy: 0 });
        }
      }
    });
    ev.sort(function (a, b) { return a.t - b.t; });
    return ev;
  }

  function Sim(level) {
    // body ids decide collision-pair order: reset them so a level always plays out the same way
    M.Common._nextId = 0;
    this.level = level;
    this.engine = M.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0011 }, positionIterations: 10, velocityIterations: 8 });
    this.world = this.engine.world;
    this.t = 0; this.state = 'ready';
    this.sleep = level.sleep || 3; this.wet = 0; this.hurtCd = 0;
    this.strokes = []; this.threats = []; this.statics = [];
    this.inkUsed = 0; this.fx = []; this.hurts = 0;
    this.events = expandEvents(level, rng((level.seed || 1) * 7 + 13));
    this.evIdx = 0; this.beeRand = rng((level.seed || 1) * 31 + 5);
    var self = this;

    var floor = M.Bodies.rectangle(W / 2, FLOOR + 40, 2400, 80, { isStatic: true, label: 'floor', friction: 1, frictionStatic: 2,
      collisionFilter: { category: CAT_BIT, mask: 0xFFFF } });
    M.Composite.add(this.world, floor);
    (level.statics || []).forEach(function (s) {
      var b = M.Bodies.rectangle(s.x, s.y, s.w, s.h, { isStatic: true, angle: s.a || 0, label: 'static', friction: 0.5,
        collisionFilter: { category: CAT_BIT, mask: 0xFFFF } });
      b.def = s; self.statics.push(b); M.Composite.add(self.world, b);
    });
    (level.furniture || []).forEach(function (f) {
      furnitureParts(f).forEach(function (q) {
        var b = M.Bodies.rectangle(q.x, q.y, q.w, q.h, { isStatic: true, label: 'static', friction: 1, frictionStatic: 2,
          collisionFilter: { category: CAT_BIT, mask: 0xFFFF } });
        b.furn = f.k; self.statics.push(b); M.Composite.add(self.world, b);
      });
    });
    var c = level.cat;
    this.cat = M.Bodies.rectangle(c.x, c.y - 15, 78, 30, { isStatic: true, label: 'cat', friction: 0.6, chamfer: { radius: 13 },
      collisionFilter: { category: CAT_BIT, mask: 0xFFFF } });
    M.Composite.add(this.world, this.cat);
    M.Events.on(this.engine, 'collisionStart', function (e) { self.onCollide(e); });
  }

  Sim.prototype.inkLeft = function () { return Math.max(0, this.level.ink - this.inkUsed); };

  Sim.prototype.addStroke = function (points) {
    var b = strokeBody(points);
    if (!b) return null;
    this.inkUsed += b.inkLen;
    this.strokes.push(b);
    M.Composite.add(this.world, b);
    if (this.state === 'ready') this.state = 'running';
    return b;
  };

  Sim.prototype.damage = function (n, x, y) {
    if (this.hurtCd > 0 || this.state !== 'running') return;
    this.sleep -= n; this.hurts++; this.hurtCd = 0.7;
    this.fx.push({ t: 'hurt', x: x, y: y });
    if (this.sleep <= 0) { this.state = 'failed'; this.fx.push({ t: 'fail' }); }
  };

  Sim.prototype.touchesCat = function (stroke) {
    var b = this.cat.bounds, s = stroke.bounds;
    if (s.max.x < b.min.x - 2 || s.min.x > b.max.x + 2 || s.max.y < b.min.y - 2 || s.min.y > b.max.y + 2) return false;
    var parts = stroke.parts.slice(1);
    for (var i = 0; i < parts.length; i++) {
      var c = M.Collision.collides(this.cat, parts[i]);
      // only a line lying ON the cat counts (contact from above), not one leaning on its side
      if (c && c.collided && Math.abs(c.normal.y) > 0.7 && parts[i].position.y < this.cat.position.y) return true;
    }
    return false;
  };

  // is a point inside a solid (furniture, ramps, shelves)? lines drawn into solids would be shot out
  Sim.prototype.inSolid = function (x, y) {
    return M.Query.point(this.statics, { x: x, y: y }).length > 0;
  };

  // is a point inside the no-draw zone around the cat?
  Sim.prototype.inCatZone = function (x, y, pad) {
    var b = this.cat.bounds; pad = pad || 0;
    return x > b.min.x - pad && x < b.max.x + pad && y > b.min.y - pad && y < b.max.y + pad;
  };

  Sim.prototype.onCollide = function (e) {
    for (var i = 0; i < e.pairs.length; i++) {
      var A = e.pairs[i].bodyA, B = e.pairs[i].bodyB;
      var a = A.parent || A, b = B.parent || B;
      var other = a.label === 'cat' ? b : (b.label === 'cat' ? a : null);
      if (other) {
        var k = other.label;
        if (k === 'drop') {
          other.dead = true; this.wet++;
          this.fx.push({ t: 'splash', x: other.position.x, y: other.position.y });
          if (this.wet >= WET_MAX) { this.wet = 0; this.damage(1, other.position.x, other.position.y); }
        } else if (k === 'stroke') {
          // a line dropped onto the cat wakes it
          if (Math.hypot(other.velocity.x, other.velocity.y) > 2.2) this.damage(1, other.position.x, this.cat.position.y - 15);
        } else if (k === 'bee') {
          other.dead = true; this.damage(1, other.position.x, other.position.y);
        } else if (k === 'ball' || k === 'pot') {
          var sp = Math.hypot(other.velocity.x, other.velocity.y);
          if (sp > 1.0) {
            this.damage(1, other.position.x, other.position.y);
            // the cat flinches: knock the object away so things never pile up on it
            var dx = other.position.x - this.cat.position.x, side = dx < 0 ? -1 : 1;
            M.Body.setVelocity(other, { x: side * (2.2 + Math.min(2, sp * 0.3)), y: -3.2 });
          }
        }
      } else {
        var th = (a.label === 'ball' || a.label === 'pot') ? a : ((b.label === 'ball' || b.label === 'pot') ? b : null);
        if (th) {
          var sp2 = Math.hypot(th.velocity.x, th.velocity.y);
          var st = th === a ? b : a;
          // a hit on a line that lies on the cat goes straight through to the cat
          if (st.label === 'stroke' && sp2 > 2.5 && this.touchesCat(st)) {
            this.damage(1, th.position.x, th.position.y);
          }
          if (sp2 > 1.6 && (!th.lastThud || this.t - th.lastThud > 0.15)) {
            th.lastThud = this.t; this.fx.push({ t: 'thud', x: th.position.x, y: th.position.y, v: sp2 });
          }
        }
      }
    }
  };

  Sim.prototype.spawn = function (ev) {
    var b, k = ev.k;
    if (k === 'ball') {
      b = M.Bodies.circle(ev.x, ev.y, 13 * ev.s, { density: 0.006, restitution: 0.3, friction: 0, frictionStatic: 0, frictionAir: 0, label: 'ball',
        collisionFilter: { category: BALL_BIT, mask: CAT_BIT | BALL_BIT } });
    } else if (k === 'pot') {
      b = M.Bodies.rectangle(ev.x, ev.y, 26 * ev.s, 26 * ev.s, { density: 0.005, restitution: 0.15, friction: 0.5, label: 'pot',
        chamfer: { radius: 4 }, collisionFilter: { category: BALL_BIT, mask: CAT_BIT | BALL_BIT } });
      M.Body.setAngle(b, (this.beeRand() - 0.5) * 0.6);
      b.size = 26 * ev.s;
    } else if (k === 'drop') {
      b = M.Bodies.circle(ev.x, ev.y, 3.2, { density: 0.001, restitution: 0.1, friction: 0.01, frictionAir: 0.02, label: 'drop',
        collisionFilter: { category: DROP_BIT, mask: CAT_BIT } });
    } else {
      b = M.Bodies.circle(ev.x, ev.y, 4.5, { density: 0.0003, frictionAir: 0.05, restitution: 0.2, label: 'bee',
        collisionFilter: { category: BEE_BIT, mask: CAT_BIT } });
      b.beePhase = this.beeRand() * 6.28; b.beeSpeed = 2.4 + this.beeRand() * 0.8;
    }
    b.born = this.t; b.kind = k;
    M.Body.setVelocity(b, { x: ev.vx || 0, y: ev.vy || 0 });
    M.Composite.add(this.world, b);
    this.threats.push(b);
  };

  Sim.prototype.step = function () {
    if (this.state === 'ready') return;
    var running = this.state === 'running', i, b;
    if (running) {
      this.t += STEP_S;
      this.hurtCd = Math.max(0, this.hurtCd - STEP_S);
      while (this.evIdx < this.events.length && this.events[this.evIdx].t <= this.t) this.spawn(this.events[this.evIdx++]);
    }
    var cx = this.cat.position.x, cy = this.cat.position.y;
    var gy = this.engine.gravity.y * this.engine.gravity.scale;
    for (i = 0; i < this.threats.length; i++) {
      b = this.threats[i];
      if (b.label !== 'bee' || b.dead) continue;
      var dx = cx - b.position.x, dy = cy - b.position.y;
      var ang = Math.atan2(dy, dx) + Math.sin(this.t * 9 + b.beePhase) * 0.5;
      var v = b.velocity;
      M.Body.applyForce(b, b.position, { x: 0, y: -b.mass * gy });
      M.Body.setVelocity(b, { x: v.x * 2 * 0.85 + Math.cos(ang) * b.beeSpeed * 0.15, y: v.y * 2 * 0.85 + Math.sin(ang) * b.beeSpeed * 0.15 });
    }
    M.Engine.update(this.engine, DT);
    for (i = this.threats.length - 1; i >= 0; i--) {
      b = this.threats[i];
      var age = this.t - b.born, p = b.position;
      var gone = b.dead || p.y > H + 160 || p.x < -320 || p.x > W + 320 ||
        (b.kind === 'drop' && age > 4) || (b.kind === 'bee' && age > 8) || age > 14;
      if (gone) { M.Composite.remove(this.world, b); this.threats.splice(i, 1); }
    }
    for (i = this.strokes.length - 1; i >= 0; i--) {
      if (this.strokes[i].position.y > H + 400) { M.Composite.remove(this.world, this.strokes[i]); this.strokes.splice(i, 1); }
    }
    if (running && this.state === 'running' && this.t >= this.level.time && this.sleep > 0) {
      this.state = 'won'; this.fx.push({ t: 'win' });
    }
  };

  // stars are measured against the level's own slack (budget minus the cheapest known solution),
  // so 3 stars stay reachable on tight late levels too
  Sim.prototype.stars = function () {
    var L = this.level, used = this.inkUsed, s;
    if (L.minInk) {
      var slack = Math.max(1, L.ink - L.minInk);
      s = used <= L.minInk + slack * 0.5 ? 3 : (used <= L.minInk + slack * 0.85 ? 2 : 1);
    } else {
      var r = this.inkLeft() / L.ink;
      s = r >= 0.4 ? 3 : (r >= 0.15 ? 2 : 1);
    }
    // one bump is always forgiven; on levels where even the reference solution takes more, matching it is enough
    return Math.min(s, this.hurts <= Math.max(1, L.bumps || 0) ? 3 : 2);
  };

  var api = { Sim: Sim, rng: rng, furnitureParts: furnitureParts, furnitureSpot: furnitureSpot, FURN: FURN, resample: resample, pathLength: pathLength, strokeBody: strokeBody,
    W: W, H: H, FLOOR: FLOOR, DT: DT, WET_MAX: WET_MAX, T: T };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CatSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
