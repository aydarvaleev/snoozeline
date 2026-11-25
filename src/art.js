/* Snoozeline art: procedural canvas drawing (no image files, no network).
   World backgrounds are pre-rendered into an offscreen canvas and re-used every frame. */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var A = {};

  // palette per world: wall top, wall bottom, floor, floor dark, accent
  var PAL = [
    { top: '#ffe9d6', bot: '#f6cfae', floor: '#b97f57', floorD: '#8f5c3d', acc: '#e98f6b', ui: '#7c5cc4' },
    { top: '#5d6b8c', bot: '#8e9cbb', floor: '#7a6a5a', floorD: '#594b3f', acc: '#c9d3e6', ui: '#4b6bb8' },
    { top: '#bfe6ff', bot: '#e9f7da', floor: '#6fb552', floorD: '#4f8a3f', acc: '#ffd34d', ui: '#3f9a5a' },
    { top: '#efe3cc', bot: '#d9c4a0', floor: '#9a9389', floorD: '#77716a', acc: '#e3a33a', ui: '#c0722c' },
    { top: '#3b2a5e', bot: '#8a5aa8', floor: '#5a3b6e', floorD: '#3d2650', acc: '#ff8fb1', ui: '#a35bd6' }
  ];
  A.PAL = PAL;

  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  A.rr = rr;

  /* ---------------- backgrounds ---------------- */
  // x0,y0,x1,y1: visible area in game units (may extend beyond 0..W / 0..H)
  function bg(ctx, wi, x0, y0, x1, y1, W, FLOOR) {
    var p = PAL[wi] || PAL[0], r = rng(77 + wi * 13), i, x, y;
    var g = ctx.createLinearGradient(0, y0, 0, FLOOR); g.addColorStop(0, p.top); g.addColorStop(1, p.bot);
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, FLOOR - y0);
    if (wi === 0) {
      // wallpaper: soft vertical stripes + tiny dots
      for (x = Math.floor(x0 / 36) * 36; x < x1; x += 36) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x, y0, 14, FLOOR - y0); }
      ctx.fillStyle = 'rgba(200,120,90,.12)';
      for (x = Math.floor(x0 / 36) * 36 + 25; x < x1; x += 36) for (y = 20; y < FLOOR - 120; y += 44) { ctx.beginPath(); ctx.arc(x, y + ((x / 36) % 2) * 22, 2.2, 0, TAU); ctx.fill(); }
      // window with night sky and moon
      var wx = 210, wy = 130, ww = 110, wh = 130;
      ctx.fillStyle = '#8a5a44'; rr(ctx, wx - 8, wy - 8, ww + 16, wh + 16, 10); ctx.fill();
      var sky = ctx.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, '#24305e'); sky.addColorStop(1, '#5a5fa0');
      ctx.fillStyle = sky; rr(ctx, wx, wy, ww, wh, 6); ctx.fill();
      ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(wx + 76, wy + 36, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a4277'; ctx.beginPath(); ctx.arc(wx + 83, wy + 31, 14, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; for (i = 0; i < 9; i++) { ctx.globalAlpha = 0.5 + r() * 0.5; ctx.fillRect(wx + 6 + r() * (ww - 12), wy + 6 + r() * (wh - 40), 1.6, 1.6); } ctx.globalAlpha = 1;
      ctx.fillStyle = '#8a5a44'; ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh); ctx.fillRect(wx, wy + wh / 2 - 3, ww, 6);
      // curtains
      ctx.fillStyle = '#e98f6b';
      ctx.beginPath(); ctx.moveTo(wx - 18, wy - 16); ctx.quadraticCurveTo(wx + 10, wy + wh / 2, wx - 4, wy + wh + 18); ctx.lineTo(wx - 22, wy + wh + 18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(wx + ww + 18, wy - 16); ctx.quadraticCurveTo(wx + ww - 10, wy + wh / 2, wx + ww + 4, wy + wh + 18); ctx.lineTo(wx + ww + 22, wy + wh + 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c56f4f'; ctx.fillRect(wx - 26, wy - 20, ww + 52, 7);
      // picture frame with a fish
      ctx.fillStyle = '#c9915f'; rr(ctx, 40, 150, 70, 54, 4); ctx.fill(); ctx.fillStyle = '#d9f0f7'; ctx.fillRect(47, 157, 56, 40);
      ctx.fillStyle = '#4aa3df'; ctx.beginPath(); ctx.ellipse(73, 177, 15, 8, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(86, 177); ctx.lineTo(96, 169); ctx.lineTo(96, 185); ctx.fill();
      // skirting board
      ctx.fillStyle = '#fff3e6'; ctx.fillRect(x0, FLOOR - 14, x1 - x0, 14); ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x0, FLOOR - 14, x1 - x0, 2);
    } else if (wi === 1) {
      // attic: slanted roof beams and planks
      ctx.fillStyle = 'rgba(0,0,0,.08)';
      for (y = Math.floor(y0 / 22) * 22; y < FLOOR; y += 22) ctx.fillRect(x0, y, x1 - x0, 1.5);
      ctx.fillStyle = '#4a3a32';
      ctx.beginPath(); ctx.moveTo(x0, 150); ctx.lineTo(W / 2, -10); ctx.lineTo(x1, 150); ctx.lineTo(x1, 120); ctx.lineTo(W / 2, -40); ctx.lineTo(x0, 120); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a4840'; ctx.fillRect(W / 2 - 8, -10, 16, FLOOR + 10);
      // round window with rain
      ctx.fillStyle = '#4a3a32'; ctx.beginPath(); ctx.arc(W / 2, 230, 46, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2b3454'; ctx.beginPath(); ctx.arc(W / 2, 230, 38, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(160,190,230,.6)'; ctx.lineWidth = 1.2;
      for (i = 0; i < 14; i++) { x = W / 2 - 30 + r() * 60; y = 200 + r() * 50; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9); ctx.stroke(); }
      ctx.fillStyle = '#4a3a32'; ctx.fillRect(W / 2 - 38, 228, 76, 4); ctx.fillRect(W / 2 - 2, 192, 4, 76);
      // cobwebs
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
      [[x0, y0 + 20, 1], [x1, y0 + 20, -1]].forEach(function (c) {
        for (var k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + c[2] * 60 * Math.cos(k * 0.45), c[1] + 60 * Math.sin(k * 0.45)); ctx.stroke(); }
        for (var j = 1; j < 4; j++) { ctx.beginPath(); ctx.arc(c[0], c[1], j * 15, c[2] > 0 ? 0 : Math.PI - 1.4, c[2] > 0 ? 1.4 : Math.PI); ctx.stroke(); }
      });
      // boxes in the background
      ctx.fillStyle = 'rgba(60,45,40,.35)'; rr(ctx, 14, FLOOR - 60, 56, 60, 3); ctx.fill(); rr(ctx, 30, FLOOR - 96, 40, 36, 3); ctx.fill(); rr(ctx, W - 80, FLOOR - 50, 66, 50, 3); ctx.fill();
    } else if (wi === 2) {
      // garden: sun, clouds, hills, fence
      ctx.fillStyle = 'rgba(255,230,120,.5)'; ctx.beginPath(); ctx.arc(W - 60, 80, 48, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(W - 60, 80, 30, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      [[60, 90], [170, 150], [x1 - 40, 200], [x0 + 30, 230]].forEach(function (c) { ctx.beginPath(); ctx.arc(c[0], c[1], 18, 0, TAU); ctx.arc(c[0] + 20, c[1] - 8, 22, 0, TAU); ctx.arc(c[0] + 44, c[1], 17, 0, TAU); ctx.fill(); });
      ctx.fillStyle = '#a9d98b'; ctx.beginPath(); ctx.moveTo(x0, FLOOR - 80);
      for (x = x0; x <= x1 + 20; x += 20) ctx.lineTo(x, FLOOR - 90 - Math.sin(x / 70) * 30); ctx.lineTo(x1, FLOOR); ctx.lineTo(x0, FLOOR); ctx.fill();
      for (x = Math.floor(x0 / 30) * 30; x < x1; x += 30) {
        ctx.fillStyle = '#f4efe6'; ctx.beginPath(); ctx.moveTo(x + 4, FLOOR); ctx.lineTo(x + 4, FLOOR - 70); ctx.lineTo(x + 13, FLOOR - 80); ctx.lineTo(x + 22, FLOOR - 70); ctx.lineTo(x + 22, FLOOR); ctx.fill();
      }
      ctx.fillStyle = '#e4ddd0'; ctx.fillRect(x0, FLOOR - 58, x1 - x0, 7); ctx.fillRect(x0, FLOOR - 26, x1 - x0, 7);
      for (i = 0; i < 16; i++) {
        x = x0 + r() * (x1 - x0); y = FLOOR - 4 - r() * 10;
        ctx.strokeStyle = '#4f8a3f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = ['#ff7aa2', '#ffd34d', '#ffffff', '#b48cff'][i % 4]; for (var k2 = 0; k2 < 5; k2++) { ctx.beginPath(); ctx.arc(x + Math.cos(k2 * 1.26) * 4, y + Math.sin(k2 * 1.26) * 4, 3, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#f2a65a'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
      }
    } else if (wi === 3) {
      // workshop: pegboard + tool silhouettes + workbench
      ctx.fillStyle = '#c9a878'; rr(ctx, 30, 70, 300, 210, 8); ctx.fill();
      ctx.fillStyle = 'rgba(80,55,30,.35)';
      for (x = 44; x < 320; x += 16) for (y = 84; y < 270; y += 16) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(70,60,55,.75)';
      rr(ctx, 70, 110, 10, 70, 3); ctx.fill(); rr(ctx, 58, 100, 34, 16, 4); ctx.fill();             // hammer
      rr(ctx, 130, 100, 8, 80, 2); ctx.fill(); ctx.beginPath(); ctx.arc(134, 190, 10, 0, TAU); ctx.fill(); // screwdriver
      ctx.beginPath(); ctx.arc(215, 140, 26, 0, TAU); ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(70,60,55,.75)'; ctx.stroke(); // tape roll
      rr(ctx, 260, 100, 14, 90, 3); ctx.fill(); ctx.fillRect(250, 100, 34, 10);                       // wrench-ish
      ctx.fillStyle = '#e3a33a'; ctx.fillRect(30, 280, 300, 8);
      ctx.fillStyle = 'rgba(0,0,0,.05)'; for (x = Math.floor(x0 / 60) * 60; x < x1; x += 60) ctx.fillRect(x, y0, 2, FLOOR - y0);
      ctx.fillStyle = '#ffcf3d'; ctx.fillRect(x0, FLOOR - 10, x1 - x0, 10);
      ctx.fillStyle = '#333'; for (x = Math.floor(x0 / 24) * 24; x < x1; x += 24) { ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x + 10, FLOOR - 10); ctx.lineTo(x + 20, FLOOR - 10); ctx.lineTo(x + 10, FLOOR); ctx.fill(); }
    } else {
      // chaos: starry twilight with floating shapes
      for (i = 0; i < 60; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.6) + ')'; var s = r() < 0.15 ? 2.4 : 1.3; ctx.fillRect(x0 + r() * (x1 - x0), y0 + r() * (FLOOR - y0 - 150), s, s); }
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(70, 90, 26, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,143,177,.09)'; for (i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x0 + r() * (x1 - x0), 200 + r() * 200, 20 + r() * 40, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#6a4a86'; ctx.beginPath(); ctx.moveTo(x0, FLOOR);
      for (x = x0; x <= x1 + 30; x += 30) ctx.lineTo(x, FLOOR - 40 - ((x * 7) % 50)); ctx.lineTo(x1, FLOOR); ctx.fill();
    }
    // floor
    var fg = ctx.createLinearGradient(0, FLOOR, 0, y1); fg.addColorStop(0, p.floor); fg.addColorStop(1, p.floorD);
    ctx.fillStyle = fg; ctx.fillRect(x0, FLOOR, x1 - x0, y1 - FLOOR);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x0, FLOOR, x1 - x0, 4);
    if (wi === 0 || wi === 1) { ctx.fillStyle = 'rgba(0,0,0,.12)'; for (x = Math.floor(x0 / 70) * 70; x < x1; x += 70) ctx.fillRect(x, FLOOR + 4, 2, y1 - FLOOR); }
    if (wi === 2) { ctx.fillStyle = 'rgba(255,255,255,.12)'; for (i = 0; i < 40; i++) ctx.fillRect(x0 + r() * (x1 - x0), FLOOR + 6 + r() * 40, 2, 5); }
  }

  var cache = { key: '', canvas: null };
  A.background = function (ctx, wi, x0, y0, x1, y1, W, FLOOR, scale) {
    var key = [wi, x0, y0, x1, y1, scale].join(',');
    if (cache.key !== key) {
      var c = cache.canvas || document.createElement('canvas');
      c.width = Math.ceil((x1 - x0) * scale); c.height = Math.ceil((y1 - y0) * scale);
      var g = c.getContext('2d'); g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
      bg(g, wi, x0, y0, x1, y1, W, FLOOR);
      cache.canvas = c; cache.key = key;
    }
    ctx.drawImage(cache.canvas, x0, y0, x1 - x0, y1 - y0);
  };

  /* ---------------- cat ---------------- */
  // st: { sleep, max, t, hurt (0..1 flinch), awake (bool), happy (0..1 win stretch) }
  A.cat = function (ctx, x, y, st) {
    var t = st.t, breathe = Math.sin(t * 2.2), hurt = st.hurt || 0, awake = st.awake;
    var jump = hurt > 0 ? Math.sin(hurt * Math.PI) * 10 : 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(0.8, 0.8); // drawn to match the 78px physics body
    // bed / cushion
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(0, -1, 50, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9b7fd6'; ctx.beginPath(); ctx.ellipse(0, -5, 48, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b8a1ea'; ctx.beginPath(); ctx.ellipse(0, -8, 42, 6, 0, 0, TAU); ctx.fill();
    ctx.translate(0, -jump);
    var body = '#f4a259', dark = '#d9782f', belly = '#fde3c4';
    // tail (sways while asleep, puffs when awake)
    var sw = awake ? 0 : Math.sin(t * 1.3) * 0.25;
    ctx.strokeStyle = body; ctx.lineWidth = awake ? 11 : 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(30, -12);
    if (awake) ctx.quadraticCurveTo(52, -20, 46, -48);
    else ctx.quadraticCurveTo(52 + sw * 10, -4, 40 + sw * 18, 4 - sw * 6);
    ctx.stroke();
    ctx.strokeStyle = dark; ctx.lineWidth = awake ? 11 : 9; ctx.beginPath();
    if (awake) { ctx.moveTo(47, -40); ctx.lineTo(46, -48); } else { ctx.moveTo(42 + sw * 18, 2 - sw * 6); ctx.lineTo(40 + sw * 18, 4 - sw * 6); }
    ctx.stroke();
    // body
    var bh = 16 + breathe * (awake ? 0 : 1.2);
    var g = ctx.createLinearGradient(0, -36, 0, 0); g.addColorStop(0, '#ffb978'); g.addColorStop(1, body);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(4, -16 - (awake ? 4 : 0), 38, bh, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(2, -8, 26, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; for (var i = -1; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(i * 12 + 4, -30 - (awake ? 4 : 0) - breathe * 0.6, 3, 7, 0.15, 0, TAU); ctx.fill(); }
    // paws
    ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(-18, -3, 8, 4.5, 0, 0, TAU); ctx.ellipse(-4, -3, 8, 4.5, 0, 0, TAU); ctx.fill();
    // head
    var hy = awake ? -36 : -22, hx = -30;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(awake ? 0 : -0.12 + breathe * 0.02);
    var ear = awake ? -0.0 : (hurt > 0 ? 0.5 : Math.max(0, Math.sin(t * 0.9) - 0.96) * 6);
    ctx.fillStyle = body;
    ctx.save(); ctx.translate(-9, -9); ctx.rotate(-0.25 - ear * 0.3); ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(-2, -14); ctx.lineTo(6, -1); ctx.fill();
    ctx.fillStyle = '#ffb3b3'; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-1.5, -9); ctx.lineTo(3, -1); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(8, -9); ctx.rotate(0.25 + ear * 0.3); ctx.beginPath(); ctx.moveTo(-6, -1); ctx.lineTo(2, -14); ctx.lineTo(6, 2); ctx.fill();
    ctx.fillStyle = '#ffb3b3'; ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(1.5, -9); ctx.lineTo(3, 0); ctx.fill(); ctx.restore();
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 16, 14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(0, -11, 2, 3.5, 0, 0, TAU); ctx.ellipse(-5, -10, 1.6, 3, -0.3, 0, TAU); ctx.ellipse(5, -10, 1.6, 3, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(0, 6, 9, 6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    if (awake) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-6, -1, 4.6, 0, TAU); ctx.arc(6, -1, 4.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(-6, -1, 3, 0, TAU); ctx.arc(6, -1, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(-6, -1, 1, 2.6, 0, 0, TAU); ctx.ellipse(6, -1, 1, 2.6, 0, 0, TAU); ctx.fill();
    } else if (hurt > 0) {
      ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(-4, 0); ctx.lineTo(-9, 2); ctx.moveTo(9, -3); ctx.lineTo(4, 0); ctx.lineTo(9, 2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-6, -1, 3.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(6, -1, 3.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
    ctx.fillStyle = '#e57373'; ctx.beginPath(); ctx.moveTo(-2, 4); ctx.lineTo(2, 4); ctx.lineTo(0, 6.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 6.5); ctx.quadraticCurveTo(-2, 9, -4, 8); ctx.moveTo(0, 6.5); ctx.quadraticCurveTo(2, 9, 4, 8); ctx.stroke();
    if (awake) { ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.ellipse(0, 10.5, 2.4, 2, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(60,40,30,.5)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-8, 5); ctx.lineTo(-20, 3); ctx.moveTo(-8, 7); ctx.lineTo(-20, 8); ctx.moveTo(8, 5); ctx.lineTo(20, 3); ctx.moveTo(8, 7); ctx.lineTo(20, 8); ctx.stroke();
    // blush while happy
    if (st.happy) { ctx.fillStyle = 'rgba(255,120,140,' + 0.45 * st.happy + ')'; ctx.beginPath(); ctx.arc(-10, 4, 3, 0, TAU); ctx.arc(10, 4, 3, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.restore();
    // z's or alarm
    x -= 0; y += 8; // z's / alarm sit a bit lower after scaling
    if (!awake) {
      ctx.fillStyle = 'rgba(70,55,140,.7)'; ctx.textAlign = 'center';
      for (var k = 0; k < 3; k++) {
        var ph = (t * 0.5 + k / 3) % 1; ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
        ctx.font = 'bold ' + (10 + ph * 8) + 'px system-ui,sans-serif';
        ctx.fillText('z', x - 34 + ph * 26 + Math.sin(ph * 6 + k) * 3, y - 44 - ph * 40);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#e8503f'; ctx.font = '900 26px system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', x - 30 + Math.sin(t * 30) * 1.5, y - 66);
    }
  };

  /* ---------------- threats ---------------- */
  var BALL_COL = [['#e8503f', '#ffd34d'], ['#4b8fd6', '#ffffff'], ['#ff8a3d', '#ffffff'], ['#8bc34a', '#ffffff'], ['#ff5fa2', '#ffe066']];
  A.ball = function (ctx, x, y, r, ang, wi) {
    var c = BALL_COL[wi] || BALL_COL[0];
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = c[0]; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.fillStyle = c[1]; ctx.fillRect(-r, -r * 0.22, r * 2, r * 0.44);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(r * 0.35, r * 0.35, r, 0, TAU); ctx.arc(r * 2, r * 2, r * 2, 0, TAU, true); ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.38, r * 0.28, 0, TAU); ctx.fill();
  };
  // "pot" objects: books in the bedroom, boxes in the attic, flower pots in the garden, toolboxes in the workshop
  A.box = function (ctx, x, y, s, ang, wi) {
    var h = s / 2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (wi === 2 || wi === 4) {
      ctx.fillStyle = '#4f8a3f'; ctx.beginPath(); ctx.ellipse(-h * 0.35, -h * 1.05, h * 0.32, h * 0.6, -0.5, 0, TAU); ctx.ellipse(h * 0.35, -h * 1.05, h * 0.32, h * 0.6, 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff7aa2'; ctx.beginPath(); ctx.arc(0, -h * 1.3, h * 0.35, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c4643a'; ctx.beginPath(); ctx.moveTo(-h, -h); ctx.lineTo(h, -h); ctx.lineTo(h * 0.75, h); ctx.lineTo(-h * 0.75, h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a24f2c'; ctx.fillRect(-h * 1.05, -h, h * 2.1, h * 0.4);
    } else if (wi === 0) {
      var cols = ['#5b8def', '#e8503f', '#f2c14e'];
      for (var i = 0; i < 3; i++) { ctx.fillStyle = cols[i]; rr(ctx, -h, -h + i * s / 3, s, s / 3 - 1, 2); ctx.fill(); ctx.fillStyle = '#fff8ef'; ctx.fillRect(h - 4, -h + i * s / 3 + 2, 3, s / 3 - 5); }
    } else if (wi === 3) {
      ctx.fillStyle = '#d64545'; rr(ctx, -h, -h * 0.6, s, h * 1.6, 3); ctx.fill();
      ctx.fillStyle = '#a83232'; ctx.fillRect(-h, -h * 0.6, s, h * 0.35);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-h * 0.45, -h * 0.6); ctx.lineTo(-h * 0.45, -h); ctx.lineTo(h * 0.45, -h); ctx.lineTo(h * 0.45, -h * 0.6); ctx.stroke();
    } else {
      ctx.fillStyle = '#c99a62'; rr(ctx, -h, -h, s, s, 2); ctx.fill();
      ctx.fillStyle = '#a77a45'; ctx.fillRect(-h, -h * 0.15, s, h * 0.3);
      ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1; ctx.strokeRect(-h + 0.5, -h + 0.5, s - 1, s - 1);
    }
    ctx.restore();
  };
  A.drop = function (ctx, x, y, vx, vy) {
    var a = Math.atan2(vy, vx) - Math.PI / 2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = '#5ab4ec'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.quadraticCurveTo(4, 0, 3.6, 1.5); ctx.arc(0, 1.5, 3.6, 0, Math.PI); ctx.quadraticCurveTo(-4, 0, 0, -7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-1.2, 1, 1.1, 0, TAU); ctx.fill();
    ctx.restore();
  };
  A.bee = function (ctx, x, y, t, vx, ph) {
    var flap = Math.sin(t * 60 + ph) * 0.5 + 0.5;
    ctx.save(); ctx.translate(x, y); if (vx < 0) ctx.scale(-1, 1);
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.strokeStyle = 'rgba(80,120,160,.5)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.ellipse(-2, -5, 4.5, 2.2 + flap * 1.5, -0.6 - flap * 0.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(2, -5, 4.5, 2.2 + flap * 1.5, 0.6 + flap * 0.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2b2140'; ctx.fillRect(-2.5, -4.6, 2, 9.2); ctx.fillRect(1.5, -4.2, 2, 8.4);
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-10, -1); ctx.lineTo(-7, 1.5); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -1, 1, 0, TAU); ctx.fill();
    ctx.restore();
  };

  /* ---------------- level props ---------------- */
  A.statics = function (ctx, d, wi) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a || 0);
    var w = d.w, h = d.h;
    if (d.kind === 'shelf') {
      ctx.fillStyle = '#8a5a44'; rr(ctx, -w / 2, -h / 2, w, h, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 1, w - 4, 3);
      ctx.fillStyle = '#6b4433'; ctx.fillRect(-w / 2 + 14, h / 2, 6, 14); ctx.fillRect(w / 2 - 20, h / 2, 6, 14);
    } else {
      ctx.fillStyle = '#7a8794'; rr(ctx, -w / 2, -h / 2, w, h, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-w / 2, -h / 2, w, 2);
      ctx.fillStyle = '#4c5560'; for (var x = -w / 2 + 10; x < w / 2; x += 26) { ctx.beginPath(); ctx.arc(x, 0, 1.6, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  };

  /* ---------------- furniture & stairs (geometry comes from CatSim.furnitureParts) ---------------- */
  var WOOD = ['#b07a4f', '#8a6a52', '#a8774a', '#9c7a55', '#8e5f8a'];
  var FABRIC = ['#e98f6b', '#6f86b8', '#7fb069', '#d9a441', '#c770a8'];
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(v * k))); };
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  function slab(ctx, q, col, r) {
    ctx.fillStyle = col; rr(ctx, q.x - q.w / 2, q.y - q.h / 2, q.w, q.h, r == null ? 3 : r); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(q.x - q.w / 2 + 2, q.y - q.h / 2 + 1, q.w - 4, Math.min(3, q.h / 3));
  }
  A.furniture = function (ctx, f, wi) {
    var S = window.CatSim, parts = S.furnitureParts(f), wood = WOOD[wi] || WOOD[0], fab = FABRIC[wi] || FABRIC[0], i;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    parts.forEach(function (q) { if (q.y + q.h / 2 > 540 && f.k !== 'wall') { ctx.beginPath(); ctx.ellipse(q.x, 549, q.w / 2 + 4, 4, 0, 0, Math.PI * 2); ctx.fill(); } });
    if (f.k === 'nightstand') {
      var n = parts[0]; slab(ctx, n, wood, 4);
      ctx.fillStyle = shade(wood, 0.8);
      ctx.fillRect(n.x - n.w / 2 - 3, n.y - n.h / 2, n.w + 6, 8);
      for (i = 0; i < 2; i++) {
        var dy = n.y - n.h / 2 + 22 + i * 40;
        ctx.strokeStyle = shade(wood, 0.7); ctx.lineWidth = 2; ctx.strokeRect(n.x - n.w / 2 + 10, dy, n.w - 20, 30);
        ctx.fillStyle = '#f2d39b'; ctx.beginPath(); ctx.arc(n.x, dy + 15, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (f.k === 'sofa') {
      var seat = parts[0], aL = parts[1], aR = parts[2];
      // backrest (decor only, behind the cat)
      ctx.fillStyle = shade(fab, 0.85); rr(ctx, seat.x - seat.w / 2 + 14, seat.y - seat.h / 2 - 58, seat.w - 28, 70, 14); ctx.fill();
      slab(ctx, seat, fab, 10);
      ctx.fillStyle = shade(fab, 1.12); rr(ctx, seat.x - seat.w / 2 + 24, seat.y - seat.h / 2 - 2, seat.w / 2 - 26, 18, 8); ctx.fill();
      rr(ctx, seat.x + 2, seat.y - seat.h / 2 - 2, seat.w / 2 - 26, 18, 8); ctx.fill();
      slab(ctx, aL, shade(fab, 0.92), 10); slab(ctx, aR, shade(fab, 0.92), 10);
      ctx.fillStyle = shade(wood, 0.7); ctx.fillRect(seat.x - seat.w / 2 + 10, 540, 8, 8); ctx.fillRect(seat.x + seat.w / 2 - 18, 540, 8, 8);
    } else if (f.k === 'chair') {
      parts.forEach(function (q, k) { slab(ctx, q, k === 0 ? wood : shade(wood, 0.85), k === 0 ? 3 : 2); });
      var bk = parts[3]; ctx.fillStyle = shade(wood, 0.85);
      ctx.fillRect(bk.x - (f.side || 1) * 4 - 1, bk.y - bk.h / 2 + 8, 2, bk.h - 16);
      ctx.fillStyle = fab; rr(ctx, parts[0].x - parts[0].w / 2 + 4, parts[0].y - parts[0].h / 2 - 5, parts[0].w - 8, 7, 3); ctx.fill();
    } else if (f.k === 'table') {
      slab(ctx, parts[1], shade(wood, 0.85), 2); slab(ctx, parts[2], shade(wood, 0.85), 2);
      slab(ctx, parts[0], wood, 3);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.moveTo(parts[0].x - 50, parts[0].y + 7); ctx.lineTo(parts[0].x + 50, parts[0].y + 7); ctx.lineTo(parts[0].x + 40, parts[0].y + 26); ctx.lineTo(parts[0].x - 40, parts[0].y + 26); ctx.fill();
    } else if (f.k === 'wall') {
      var wq = parts[0]; ctx.fillStyle = shade(wood, 0.75); ctx.fillRect(wq.x - wq.w / 2, -400, wq.w, wq.y + wq.h / 2 + 400);
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      for (var y = 0; y < 548; y += 26) ctx.fillRect(wq.x - wq.w / 2, y, wq.w, 2);
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect((f.side || -1) < 0 ? wq.x + wq.w / 2 - 3 : wq.x - wq.w / 2, -400, 3, 948);
    } else if (f.k === 'stairs') {
      parts.forEach(function (q) {
        slab(ctx, q, shade(wood, 0.95), 2);
        ctx.fillStyle = shade(wood, 0.7); ctx.fillRect(q.x - q.w / 2, q.y - q.h / 2, q.w, 6);
        ctx.fillStyle = fab; ctx.fillRect(q.x - q.w / 2 + 10, q.y - q.h / 2, q.w - 20, 4);
        ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.strokeRect(q.x - q.w / 2 + 0.5, q.y - q.h / 2 + 0.5, q.w - 1, q.h - 1);
      });
    }
    ctx.restore();
  };

  // ink line: shadow + body + highlight
  A.ink = function (ctx, pts, live, col) {
    if (pts.length < 2) return;
    function path() { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(0, 3); path(); ctx.strokeStyle = 'rgba(30,20,50,.18)'; ctx.lineWidth = 9; ctx.stroke(); ctx.restore();
    path(); ctx.strokeStyle = '#2f2346'; ctx.lineWidth = 9; ctx.stroke();
    path(); ctx.strokeStyle = live ? '#b39cf0' : (col || '#7c5cc4'); ctx.lineWidth = 5; ctx.stroke();
    ctx.save(); ctx.translate(-0.8, -1.2); path(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
  };

  // dashed ghost of the hint solution
  A.ghost = function (ctx, pts, t) {
    if (!pts || pts.length < 2) return;
    ctx.save(); ctx.setLineDash([8, 8]); ctx.lineDashOffset = -t * 30;
    ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.2;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 9; ctx.stroke();
    ctx.setLineDash([10, 8]); ctx.strokeStyle = '#7c5cc4'; ctx.lineWidth = 5; ctx.stroke();
    ctx.restore();
  };

  window.CatArt = A;
})();
