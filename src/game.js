(function () {
  'use strict';
  var S = window.CatSim, P = window.Platform, LEVELS = window.CATNAP_LEVELS || [];
  var W = S.W, H = S.H, FLOOR = S.FLOOR;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('c'), ctx = canvas.getContext('2d');
  var stage = $('stage');

  /* ---------- state ---------- */
  var save = { done: {}, stars: {}, sound: true, music: true, lang: null };
  var lang = 'en', cur = 0, sim = null, drawing = null, fails = 0, paused = false, screen = 'menu', particles = [], shake = 0, hurtFlash = 0;
  var levelsPlayed = 0;

  function t(k, v) {
    var d = (window.I18N[lang] || {})[k]; if (d == null) d = window.I18N.en[k]; if (d == null) d = k;
    return v ? d.replace('{n}', v) : d;
  }
  var ICONS = {
    play: '<path d="M8 5v14l11-7z"/>', retry: '<path d="M17.65 6.35A8 8 0 1 0 19.73 14h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"/>',
    menu: '<path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>', gear: '<path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.4 3a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 3h4l.4-3c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>',
    star: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.5 5.7 21l1.5-7L2 9.3l7-.8z"/>', lock: '<path d="M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9zm-8-2a3 3 0 0 1 6 0v2H9z"/>',
    close: '<path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4l5.6 5.6 1.4-1.4L13.4 12z"/>',
    next: '<path d="M6 5v14l9-7zm10 0h2v14h-2z"/>', video: '<path d="M4 6h11a2 2 0 0 1 2 2v2l5-3v10l-5-3v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>',
    snd: '<path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/>', mus: '<path d="M12 3v10.6A4 4 0 1 0 14 17V7h4V3z"/>'
  };
  function ic(n, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; }

  /* ---------- audio (compressed files; missing files are tolerated) ---------- */
  var AC = null, bufs = {}, musicNode = null;
  function audioInit() {
    if (AC) return;
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    ['sfx_draw', 'sfx_hit', 'sfx_win', 'sfx_fail', 'sfx_click', 'sfx_star', 'music'].forEach(function (n) {
      fetch('assets/' + n + '.ogg').then(function (r) { return r.ok ? r.arrayBuffer() : null; })
        .then(function (ab) { return ab && new Promise(function (ok, no) { AC.decodeAudioData(ab, ok, no); }); })
        .then(function (b) { if (b) { bufs[n] = b; if (n === 'music') startMusic(); } }).catch(function () {});
    });
  }
  function audioOn() { return P.audio && !paused; }
  function sfx(n, vol) {
    if (!AC || !bufs[n] || !save.sound || !audioOn()) return;
    var s = AC.createBufferSource(), g = AC.createGain(); s.buffer = bufs[n]; g.gain.value = vol || 0.7; s.connect(g); g.connect(AC.destination); s.start();
  }
  function startMusic() {
    if (!AC || !bufs.music || musicNode) return;
    musicNode = AC.createBufferSource(); musicNode.buffer = bufs.music; musicNode.loop = true;
    musicNode.gainNode = AC.createGain(); musicNode.gainNode.gain.value = 0.0;
    musicNode.connect(musicNode.gainNode); musicNode.gainNode.connect(AC.destination); musicNode.start(); applyAudio();
  }
  function applyAudio() {
    if (musicNode) musicNode.gainNode.gain.value = (save.music && audioOn()) ? 0.28 : 0;
    if (AC) { if (audioOn() || true) { if (AC.state === 'suspended') AC.resume(); } }
  }

  /* ---------- persistence ---------- */
  function persist() { P.set(['catnap'], [JSON.stringify({ done: save.done, stars: save.stars, sound: save.sound, music: save.music, lang: save.lang })]); }
  function loadSave() {
    return P.get(['catnap']).then(function (v) {
      try { var o = JSON.parse(v[0]); if (o) { save.done = o.done || {}; save.stars = o.stars || {}; save.sound = o.sound !== false; save.music = o.music !== false; save.lang = o.lang || null; } } catch (e) {}
    });
  }
  function unlockedMax() { var m = 0; for (var k in save.done) m = Math.max(m, +k + 1); return Math.min(m, LEVELS.length - 1); }

  /* ---------- layout ---------- */
  var scale = 1, dpr = 1, ox = 0, oy = 0, vox = 0, voy = 0;
  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    scale = Math.min(vw / W, vh / H); dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.floor(W * scale), ch = Math.floor(H * scale);
    stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
    stage.style.left = Math.floor((vw - cw) / 2) + 'px'; stage.style.top = Math.floor((vh - ch) / 2) + 'px';
    stage.style.fontSize = Math.max(11, Math.floor(scale * 15)) + 'px';
    canvas.width = Math.floor(vw * dpr); canvas.height = Math.floor(vh * dpr);
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    canvas.style.left = -Math.floor((vw - cw) / 2) + 'px'; canvas.style.top = -Math.floor((vh - ch) / 2) + 'px';
    var r = stage.getBoundingClientRect(); ox = r.left; oy = r.top; vox = (vw - cw) / 2 / scale; voy = (vh - ch) / 2 / scale;
  }
  window.addEventListener('resize', resize);

  /* ---------- level control ---------- */
  function startLevel(i) {
    cur = i; sim = new S.Sim(LEVELS[i]); particles = []; drawing = null; hurtFlash = 0; screen = 'play';
    hideModals(); $('hud').classList.remove('hide'); $('menu').classList.add('hide'); updateHud();
    var hint = $('hint'); var k = i === 0 ? 'hint1' : i === 1 ? 'hint2' : i === 4 ? 'hint3' : null;
    if (i % 12 === 0 && i > 0) k = 'wh' + (i / 12);
    if (i === 12 + 0) k = 'wh1';
    hint.textContent = k ? t(k) : ''; hint.classList.toggle('hide', !k); $('tapHint').classList.toggle('hide', i !== 0);
    P.msg('level_started', String(i + 1));
  }
  function updateHud() {
    $('lvl').textContent = t('level', cur + 1);
    var pct = sim ? sim.inkLeft() / sim.level.ink : 1;
    $('inkfill').style.width = Math.max(0, pct * 100) + '%';
    var hs = ''; for (var i = 0; i < (sim ? sim.level.sleep || 3 : 3); i++) hs += '<span class="z ' + (sim && i >= sim.sleep ? 'off' : '') + '">z</span>';
    $('zs').innerHTML = hs;
  }
  function hideModals() { $('win').classList.add('hide'); $('fail').classList.add('hide'); $('settings').classList.add('hide'); }

  function onWin() {
    var s = sim.stars(); save.done[cur] = 1; save.stars[cur] = Math.max(save.stars[cur] || 0, s); persist(); fails = 0;
    sfx('sfx_win'); P.msg('level_completed', String(cur + 1));
    var st = ''; for (var i = 0; i < 3; i++) st += ic('star', i < s ? 'on' : 'off');
    $('winstars').innerHTML = st; $('winTitle').textContent = cur >= LEVELS.length - 1 ? t('the_end') : t('win');
    $('nextBtn').classList.toggle('hide', cur >= LEVELS.length - 1);
    setTimeout(function () {
      $('win').classList.remove('hide'); sfx('sfx_star', 0.5);
      if (++levelsPlayed % 2 === 0) P.interstitial('level_completed');
    }, 500);
  }
  function onFail() {
    fails++; sfx('sfx_fail'); P.msg('level_failed', String(cur + 1));
    setTimeout(function () {
      $('fail').classList.remove('hide');
      $('skipBtn').classList.toggle('hide', !(fails >= 2 && P.rewardedSupported && cur < LEVELS.length - 1));
    }, 600);
  }

  /* ---------- menu / levels ---------- */
  function showMenu() {
    screen = 'menu'; sim = null; hideModals(); $('hud').classList.add('hide'); $('hint').classList.add('hide'); $('menu').classList.remove('hide');
    var max = unlockedMax(), html = '';
    for (var w = 0; w < 5; w++) {
      var first = w * 12;
      if (first >= LEVELS.length) break;
      html += '<h3>' + t('w' + w) + '</h3><div class="grid">';
      for (var i = first; i < Math.min(first + 12, LEVELS.length); i++) {
        var lock = i > max, s = save.stars[i] || 0;
        html += '<button class="lv ' + (lock ? 'lock' : '') + '" data-i="' + i + '" ' + (lock ? 'disabled aria-label="' + t('locked') + '"' : '') + '>' +
          (lock ? ic('lock') : '<b>' + (i + 1) + '</b><span class="mini">' + [0, 1, 2].map(function (k) { return ic('star', k < s ? 'on' : 'off'); }).join('') + '</span>') + '</button>';
      }
      html += '</div>';
    }
    $('levelList').innerHTML = html;
    $('menuTitle').textContent = t('title');
    $('continue').innerHTML = ic('play') + '<span>' + t('level', max + 1) + '</span>';
  }
  $('levelList').addEventListener('click', function (e) {
    var b = e.target.closest('.lv'); if (!b || b.disabled) return; sfx('sfx_click'); startLevel(+b.dataset.i);
  });
  $('continue').onclick = function () { audioInit(); sfx('sfx_click'); startLevel(unlockedMax()); };

  /* ---------- settings ---------- */
  function buildSettings() {
    $('setTitle').textContent = t('settings');
    $('sndRow').innerHTML = ic('snd') + '<span>' + t('sound') + '</span><button class="tog ' + (save.sound ? 'on' : '') + '" id="sndT" role="switch" aria-checked="' + save.sound + '"></button>';
    $('musRow').innerHTML = ic('mus') + '<span>' + t('music') + '</span><button class="tog ' + (save.music ? 'on' : '') + '" id="musT" role="switch" aria-checked="' + save.music + '"></button>';
    $('langLbl').textContent = t('language');
    var opts = ''; Object.keys(window.LANG_NAMES).forEach(function (k) { opts += '<option value="' + k + '"' + (k === lang ? ' selected' : '') + '>' + window.LANG_NAMES[k] + '</option>'; });
    $('langSel').innerHTML = opts; $('closeSet').innerHTML = ic('close'); $('closeSet').setAttribute('aria-label', t('close'));
    $('sndT').onclick = function () { save.sound = !save.sound; persist(); buildSettings(); };
    $('musT').onclick = function () { save.music = !save.music; persist(); applyAudio(); buildSettings(); };
  }
  $('langSel').onchange = function () { lang = this.value; save.lang = lang; persist(); buildSettings(); applyText(); if (screen === 'menu') showMenu(); };
  function openSettings() { audioInit(); buildSettings(); $('settings').classList.remove('hide'); if (sim && sim.state === 'running') paused = true; }
  function closeSettings() { $('settings').classList.add('hide'); paused = P.paused; applyAudio(); }
  $('gear').onclick = $('gear2').onclick = function () { sfx('sfx_click'); openSettings(); };
  $('closeSet').onclick = closeSettings;
  $('menuBtn').onclick = function () { sfx('sfx_click'); showMenu(); };
  $('retryBtn').onclick = function () { sfx('sfx_click'); startLevel(cur); };
  $('retry2').onclick = function () { sfx('sfx_click'); startLevel(cur); };
  $('retry3').onclick = function () { sfx('sfx_click'); startLevel(cur); };
  $('nextBtn').onclick = function () { sfx('sfx_click'); startLevel(Math.min(cur + 1, LEVELS.length - 1)); };
  $('menu2').onclick = $('menu3').onclick = function () { sfx('sfx_click'); showMenu(); };
  $('skipBtn').onclick = function () {
    P.rewarded('skip_level', function (ok) { if (ok) { save.done[cur] = 1; persist(); fails = 0; startLevel(Math.min(cur + 1, LEVELS.length - 1)); } });
  };
  function applyText() {
    $('retryBtn').setAttribute('aria-label', t('retry')); $('menuBtn').setAttribute('aria-label', t('levels')); $('gear').setAttribute('aria-label', t('settings'));
    $('gear2').setAttribute('aria-label', t('settings'));
    $('failTitle').textContent = t('fail');
    $('retry2').innerHTML = ic('retry') + '<span>' + t('retry') + '</span>'; $('retry3').innerHTML = ic('retry') + '<span>' + t('again') + '</span>';
    $('nextBtn').innerHTML = ic('next') + '<span>' + t('next') + '</span>';
    $('skipBtn').innerHTML = ic('video') + '<span>' + t('skipAd') + '</span>';
    $('menu2').innerHTML = ic('menu'); $('menu3').innerHTML = ic('menu');
    $('menuBtn').innerHTML = ic('menu'); $('retryBtn').innerHTML = ic('retry'); $('gear').innerHTML = ic('gear'); $('gear2').innerHTML = ic('gear');
    $('menu2').setAttribute('aria-label', t('levels')); $('menu3').setAttribute('aria-label', t('levels'));
    $('tapHint').textContent = t('tapToDraw');
    document.title = t('title'); document.documentElement.lang = lang;
    if (sim) updateHud();
  }

  /* ---------- input ---------- */
  function pt(e) { return { x: (e.clientX - ox) / scale, y: (e.clientY - oy) / scale }; }
  canvas.addEventListener('pointerdown', function (e) {
    if (screen !== 'play' || !sim || sim.state === 'won' || sim.state === 'failed' || paused) return;
    audioInit(); applyAudio(); canvas.setPointerCapture(e.pointerId);
    var p = pt(e); drawing = { pts: [p], len: 0 }; $('hint').classList.add('hide'); $('tapHint').classList.add('hide');
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drawing) return;
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!evs.length) evs = [e];
    for (var i = 0; i < evs.length; i++) {
      var p = pt(evs[i]), a = drawing.pts[drawing.pts.length - 1], d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d < 3) continue;
      var left = sim.inkLeft() - drawing.len;
      if (d > left) { if (left > 1) { var k = left / d; p = { x: a.x + (p.x - a.x) * k, y: a.y + (p.y - a.y) * k }; d = left; } else { finishStroke(); return; } }
      p.y = Math.min(p.y, FLOOR - 4);
      drawing.pts.push(p); drawing.len += d;
      if (Math.random() < 0.3) sfx('sfx_draw', 0.15);
      if (d >= left) { finishStroke(); return; }
    }
    $('inkfill').style.width = Math.max(0, (sim.inkLeft() - drawing.len) / sim.level.ink * 100) + '%';
  });
  function finishStroke() {
    if (!drawing) return;
    var pts = drawing.pts; drawing = null;
    if (pts.length >= 2 && S.pathLength(pts) > 8) { sim.addStroke(pts); }
    updateHud();
  }
  canvas.addEventListener('pointerup', finishStroke);
  canvas.addEventListener('pointercancel', finishStroke);
  ['contextmenu', 'selectstart', 'dragstart'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }); });

  /* ---------- rendering ---------- */
  var WORLD_COL = [['#f7e3d3', '#e9c3a4', '#8a5a44'], ['#c9d3e6', '#8fa3c7', '#4b5a7d'], ['#d8efc4', '#9ed38a', '#4f8a3f'], ['#e6dcc8', '#c4ae86', '#6e5a3b'], ['#ead0ee', '#c79bd2', '#6b3f7a']];
  function drawBg(wi) {
    var c = WORLD_COL[wi] || WORLD_COL[0];
    var g = ctx.createLinearGradient(0, 0, 0, FLOOR); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
    ctx.fillStyle = c[0]; ctx.fillRect(-vox - 5, -voy - 5, W + 2 * vox + 10, H + 2 * voy + 10);
    ctx.fillStyle = g; ctx.fillRect(-vox - 5, -voy - 5, W + 2 * vox + 10, FLOOR + voy + 5);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (var i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(40 + i * 75, 60 + (i % 2) * 40, 22 + (i % 3) * 6, 0, 7); ctx.fill(); }
    ctx.fillStyle = c[2]; ctx.fillRect(-vox - 5, FLOOR, W + 2 * vox + 10, H - FLOOR + voy + 5);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-vox - 5, FLOOR, W + 2 * vox + 10, 6);
  }
  function drawCat(x, y, sleepLeft, tt) {
    var breathe = Math.sin(tt * 2.2) * 1.4, awake = sleepLeft <= 0;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#f2a65a'; ctx.beginPath(); ctx.ellipse(0, -15 + breathe * 0.4, 40, 15 - breathe * 0.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e08a3c'; for (var i = -1; i <= 1; i++) { ctx.fillRect(i * 14 - 2, -29, 4, 9); }
    ctx.fillStyle = '#f2a65a'; ctx.beginPath(); ctx.arc(-28, -20, 13, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-38, -30); ctx.lineTo(-35, -42); ctx.lineTo(-27, -32); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-26, -32); ctx.lineTo(-19, -42); ctx.lineTo(-17, -29); ctx.fill();
    ctx.fillStyle = '#f2a65a'; ctx.beginPath(); ctx.ellipse(36, -8, 16, 6, -0.4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    if (awake) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-32, -22, 4, 0, 7); ctx.arc(-23, -22, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.arc(-32, -22, 1.8, 0, 7); ctx.arc(-23, -22, 1.8, 0, 7); ctx.fill(); }
    else {
      var lids = sleepLeft < 3 ? 0.4 : 0; ctx.beginPath(); ctx.arc(-32, -21 - lids, 3.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(-23, -21 - lids, 3.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
    ctx.fillStyle = '#e57373'; ctx.beginPath(); ctx.arc(-27.5, -17, 1.6, 0, 7); ctx.fill();
    ctx.restore();
    if (!awake) {
      ctx.fillStyle = 'rgba(60,50,110,.55)'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      for (var k = 0; k < 3; k++) { var ph = (tt * 0.6 + k / 3) % 1; ctx.globalAlpha = 1 - ph; ctx.fillText('z', x - 10 + ph * 20 + k * 3, y - 48 - ph * 34); }
      ctx.globalAlpha = 1;
    }
  }
  function polyStroke(pts, w, col) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
  }
  function render(tt) {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, vox * scale * dpr, voy * scale * dpr);
    var wi = sim ? sim.level.world : 0; drawBg(wi);
    if (shake > 0) { ctx.save(); ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); }
    if (sim) {
      sim.statics.forEach(function (b) {
        var d = b.def; ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a || 0);
        ctx.fillStyle = '#7a5b45'; ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-d.w / 2, -d.h / 2, d.w, 3); ctx.restore();
      });
      drawCat(sim.level.cat.x, FLOOR, sim.sleep, tt);
      sim.strokes.forEach(function (b) {
        var pts = b.local; var a = b.angle, c = Math.cos(a), s = Math.sin(a), q = [];
        for (var i = 0; i < pts.length; i++) q.push({ x: b.position.x + pts[i].x * c - pts[i].y * s, y: b.position.y + pts[i].x * s + pts[i].y * c });
        polyStroke(q, 8, '#3b2a4d'); polyStroke(q, 4, '#7c5cc4');
      });
      sim.threats.forEach(function (b) {
        var p = b.position;
        if (b.kind === 'ball') { ctx.fillStyle = '#e8503f'; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(p.x - 4, p.y - 4, 4, 0, 7); ctx.fill(); }
        else if (b.kind === 'pot') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.angle); ctx.fillStyle = '#b5653a'; ctx.fillRect(-26, -26, 52, 52); ctx.fillStyle = '#8a4526'; ctx.fillRect(-26, -26, 52, 9); ctx.restore(); }
        else if (b.kind === 'drop') { ctx.fillStyle = '#4aa3df'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, 7); ctx.fill(); }
        else if (b.kind === 'bee') {
          ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(p.x - 2, p.y - 5, 4, 2.4, -0.5, 0, 7); ctx.ellipse(p.x + 3, p.y - 5, 4, 2.4, 0.5, 0, 7); ctx.fill();
          ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 6, 4.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(p.x - 1.5, p.y - 4, 2, 8);
        }
      });
    }
    if (drawing && drawing.pts.length > 1) { polyStroke(drawing.pts, 8, '#3b2a4d'); polyStroke(drawing.pts, 4, '#a58be6'); }
    particles.forEach(function (q) { ctx.globalAlpha = Math.max(0, q.l); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
    if (shake > 0) ctx.restore();
    if (hurtFlash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + hurtFlash * 0.25 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function burst(x, y, col, n) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.28, v = 20 + Math.random() * 60; particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, r: 1.5 + Math.random() * 2, c: col, l: 1 }); } }

  /* ---------- main loop (fixed 120 Hz sim, 2 steps per 60 fps frame) ---------- */
  var last = 0, acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(100, now - (last || now)); last = now;
    if (sim && !paused && !P.paused && (sim.state === 'running' || sim.state === 'ready')) {
      acc += dt;
      while (acc >= S.DT) {
        acc -= S.DT; sim.step();
        var evs = sim.fx.splice(0);
        for (var i = 0; i < evs.length; i++) {
          var e = evs[i];
          if (e.t === 'hurt') { hurtFlash = 1; shake = 6; burst(e.x, e.y, '#ff6b6b', 8); sfx('sfx_hit'); updateHud(); }
          else if (e.t === 'splash') burst(e.x, e.y, '#4aa3df', 3);
          else if (e.t === 'thud') { burst(e.x, e.y, '#fff', 3); if (e.v > 2.4) sfx('sfx_hit', 0.25); }
          else if (e.t === 'win') onWin();
          else if (e.t === 'fail') onFail();
        }
      }
      if (sim.state === 'running') { var tl = $('timefill'); tl.style.width = Math.min(100, sim.t / sim.level.time * 100) + '%'; }
    } else acc = 0;
    var s = dt / 1000;
    for (var j = particles.length - 1; j >= 0; j--) { var q = particles[j]; q.x += q.vx * s; q.y += q.vy * s; q.vy += 300 * s; q.l -= s * 1.8; if (q.l <= 0) particles.splice(j, 1); }
    shake = Math.max(0, shake - dt * 0.03); hurtFlash = Math.max(0, hurtFlash - dt * 0.004);
    render(now / 1000);
  }

  /* ---------- boot ---------- */
  function boot() {
    if (!LEVELS.length) { $('menuTitle').textContent = 'No levels'; return; }
    resize();
    var want = save.lang || P.lang;
    lang = window.I18N[want] ? want : 'en';
    P.onPause = function (v) { paused = v; applyAudio(); };
    P.onAudio = function () { applyAudio(); };
    applyText(); startLevel(unlockedMax()); requestAnimationFrame(frame);
    document.addEventListener('pointerdown', function once() { audioInit(); document.removeEventListener('pointerdown', once); });
    P.msg('game_ready');
  }
  P.init().then(loadSave).then(boot);
  window.__catnap = { start: startLevel, get sim() { return sim; }, menu: showMenu };
})();
