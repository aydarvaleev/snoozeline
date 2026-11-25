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
  var levelsPlayed = 0, catHurt = 0, catHappy = 0, hintFor = -1, toastT = 0;
  var Art = window.CatArt;

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
    snd: '<path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/>', mus: '<path d="M12 3v10.6A4 4 0 1 0 14 17V7h4V3z"/>',
    bulb: '<path d="M9 21h6v-1.5H9zm3-19a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z"/>'
  };
  function ic(n, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; }

  /* ---------- audio: compressed files from assets/ (ogg, mp3 fallback for old Safari); missing files are tolerated ---------- */
  var AC = null, bufs = {}, musicNode = null;
  var EXT = (function () { var a = document.createElement('audio'); return a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"') ? '.ogg' : '.mp3'; })();
  var SOUNDS = ['click', 'draw', 'thud', 'hurt', 'win', 'fail', 'star', 'music'];
  function audioInit() {
    if (AC) return;
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    SOUNDS.forEach(function (n) {
      fetch('assets/' + n + EXT).then(function (r) { return r.ok ? r.arrayBuffer() : null; })
        .then(function (ab) { return ab && new Promise(function (ok, no) { AC.decodeAudioData(ab, ok, no); }); })
        .then(function (b) { if (b) { bufs[n] = b; if (n === 'music') startMusic(); } }).catch(function () {});
    });
    applyAudio();
  }
  function audioOn() { return P.audio && !paused && !P.paused && !document.hidden; }
  function sfx(n, vol) {
    n = n.replace(/^sfx_/, '');
    if (!AC || !bufs[n] || !save.sound || !audioOn()) return;
    var s = AC.createBufferSource(), g = AC.createGain(); s.buffer = bufs[n]; g.gain.value = vol == null ? 0.8 : vol;
    if (n === 'draw') s.playbackRate.value = 0.9 + Math.random() * 0.25;
    s.connect(g); g.connect(AC.destination); s.start();
  }
  function startMusic() {
    if (!AC || !bufs.music || musicNode) return;
    musicNode = AC.createBufferSource(); musicNode.buffer = bufs.music; musicNode.loop = true;
    musicNode.gainNode = AC.createGain(); musicNode.gainNode.gain.value = 0;
    musicNode.connect(musicNode.gainNode); musicNode.gainNode.connect(AC.destination); musicNode.start(); applyAudio();
  }
  function applyAudio() {
    if (!AC) return;
    var on = audioOn();
    if (musicNode) musicNode.gainNode.gain.setTargetAtTime(save.music && on ? 0.35 : 0, AC.currentTime, 0.08);
    // fully suspend the context while paused / hidden / muted by the platform so nothing can leak
    if (on && AC.state === 'suspended') AC.resume();
    else if (!on && AC.state === 'running') AC.suspend();
  }
  document.addEventListener('visibilitychange', function () { applyAudio(); });

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
    cur = i; sim = new S.Sim(LEVELS[i]); particles = []; drawing = null; hurtFlash = 0; catHurt = 0; catHappy = 0; screen = 'play';
    if (hintFor !== i) hintFor = -1;
    hideModals(); $('hud').classList.remove('hide'); $('menu').classList.add('hide'); updateHud();
    var hint = $('hint'); var k = i === 0 ? 'hint1' : i === 1 ? 'hint2' : i === 2 ? 'hintCat' : i === 4 ? 'hint3' : null;
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
    var s = sim.stars(); catHappy = 1; confetti(); save.done[cur] = 1; save.stars[cur] = Math.max(save.stars[cur] || 0, s); persist(); fails = 0;
    sfx('sfx_win'); P.msg('level_completed', String(cur + 1));
    var st = ''; for (var i = 0; i < 3; i++) st += ic('star', i < s ? 'on' : 'off');
    $('winstars').innerHTML = st; $('winTitle').textContent = cur >= LEVELS.length - 1 ? t('the_end') : t('win');
    $('nextBtn').classList.toggle('hide', cur >= LEVELS.length - 1);
    setTimeout(function () {
      $('win').classList.remove('hide'); sfx('sfx_star', 0.5);
    }, 500);
  }
  function onFail() {
    fails++; sfx('sfx_fail'); P.msg('level_failed', String(cur + 1));
    setTimeout(function () {
      $('fail').classList.remove('hide');
      $('skipBtn').classList.toggle('hide', !(fails >= 2 && P.rewardedSupported && cur < LEVELS.length - 1));
      $('hintBtn').classList.toggle('hide', !(P.rewardedSupported && LEVELS[cur].hint && hintFor !== cur));
    }, 600);
  }

  /* ---------- menu / levels ---------- */
  function showMenu() {
    screen = 'menu'; sim = null; hideModals(); $('hud').classList.add('hide'); $('hint').classList.add('hide'); $('tapHint').classList.add('hide'); $('toast').classList.add('hide'); $('menu').classList.remove('hide');
    var max = unlockedMax(), html = '';
    for (var w = 0; w < 5; w++) {
      var first = w * 12;
      if (first >= LEVELS.length) break;
      var ws = 0; for (var q = first; q < Math.min(first + 12, LEVELS.length); q++) ws += save.stars[q] || 0;
      html += '<div style="--acc:' + Art.PAL[w].ui + '"><div class="wh"><span>' + t('w' + w) + '</span><span class="cnt">' + ic('star', 'on') + ws + '/36</span></div><div class="grid">';
      for (var i = first; i < Math.min(first + 12, LEVELS.length); i++) {
        var lock = i > max, s = save.stars[i] || 0;
        html += '<button class="lv ' + (lock ? 'lock' : '') + (i === max ? ' cur' : '') + '" data-i="' + i + '" ' + (lock ? 'disabled aria-label="' + t('locked') + '"' : '') + '>' +
          (lock ? ic('lock') : '<b>' + (i + 1) + '</b><span class="mini">' + [0, 1, 2].map(function (k) { return ic('star', k < s ? 'on' : 'off'); }).join('') + '</span>') + '</button>';
      }
      html += '</div></div>';
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
  $('retry2').onclick = function () { sfx('sfx_click'); P.interstitial('level_failed'); startLevel(cur); };
  $('retry3').onclick = function () { sfx('sfx_click'); P.interstitial('level_completed'); startLevel(cur); };
  $('nextBtn').onclick = function () { sfx('sfx_click'); P.interstitial('level_completed'); startLevel(Math.min(cur + 1, LEVELS.length - 1)); };
  $('menu2').onclick = $('menu3').onclick = function () { sfx('sfx_click'); P.interstitial('menu'); showMenu(); };
  $('hintBtn').onclick = function () {
    P.rewarded('show_hint', function (ok) { if (ok) { hintFor = cur; startLevel(cur); } });
  };
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
    $('hintBtn').innerHTML = ic('bulb') + '<span>' + t('hintAd') + '</span>';
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
    var p = pt(e);
    if (sim.inCatZone(p.x, p.y, 6)) { toast(t('notOnCat')); return; }
    drawing = { pts: [p], len: 0 }; $('hint').classList.add('hide'); $('tapHint').classList.add('hide');
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
      if (sim.inCatZone(p.x, p.y, 6)) { toast(t('notOnCat')); finishStroke(); return; }
      drawing.pts.push(p); drawing.len += d;
      if (Math.random() < 0.35) sfx('draw', 0.5);
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
  function render(tt) {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, vox * scale * dpr, voy * scale * dpr);
    var wi = sim ? sim.level.world : 0;
    Art.background(ctx, wi, -vox, -voy, W + vox, H + voy, W, FLOOR, scale * dpr);
    if (shake > 0) { ctx.save(); ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); }
    if (sim) {
      sim.statics.forEach(function (b) { Art.statics(ctx, b.def, wi); });
      var c = sim.level.cat;
      Art.cat(ctx, c.x, c.y, { t: tt, hurt: catHurt, awake: sim.sleep <= 0, happy: catHappy });
      if (sim.level.hint && (hintFor === cur || (cur === 0 && !sim.strokes.length && !drawing))) Art.ghost(ctx, sim.level.hint, tt);
      sim.strokes.forEach(function (b) {
        var pts = b.local, a = b.angle, co = Math.cos(a), si = Math.sin(a), q = [];
        for (var i = 0; i < pts.length; i++) q.push({ x: b.position.x + pts[i].x * co - pts[i].y * si, y: b.position.y + pts[i].x * si + pts[i].y * co });
        Art.ink(ctx, q, false, Art.PAL[wi].ui);
      });
      sim.threats.forEach(function (b) {
        var p = b.position;
        if (b.kind === 'ball') Art.ball(ctx, p.x, p.y, b.circleRadius || 13, b.angle, wi);
        else if (b.kind === 'pot') Art.box(ctx, p.x, p.y, b.size || 26, b.angle, wi);
        else if (b.kind === 'drop') Art.drop(ctx, p.x, p.y, b.velocity.x, b.velocity.y);
        else if (b.kind === 'bee') Art.bee(ctx, p.x, p.y, tt, b.velocity.x, b.beePhase || 0);
      });
    }
    if (drawing && drawing.pts.length > 1) Art.ink(ctx, drawing.pts, true);
    particles.forEach(function (q) {
      ctx.globalAlpha = Math.max(0, Math.min(1, q.l)); ctx.fillStyle = q.c;
      if (q.rect) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); ctx.fillRect(-q.r, -q.r * 0.5, q.r * 2, q.r); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
    if (shake > 0) ctx.restore();
    if (hurtFlash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + hurtFlash * 0.22 + ')'; ctx.fillRect(-vox, -voy, W + 2 * vox, H + 2 * voy); }
  }
  function toast(msg) { var el = $('toast'); el.textContent = msg; el.classList.remove('hide'); toastT = 1200; }
  function confetti() {
    var cols = ['#ffc531', '#7c5cc4', '#ff7aa2', '#5ab4ec', '#8bc34a'];
    for (var i = 0; i < 70; i++) {
      var x = W * (0.1 + Math.random() * 0.8);
      particles.push({ x: x, y: -10 - Math.random() * 60, vx: (Math.random() - .5) * 120, vy: 40 + Math.random() * 120, r: 3 + Math.random() * 3,
        c: cols[i % cols.length], l: 2.6 + Math.random(), rect: true, a: Math.random() * 6, va: (Math.random() - .5) * 12, drag: true });
    }
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
          if (e.t === 'hurt') { hurtFlash = 1; shake = 6; catHurt = 1; burst(e.x, e.y, '#ff6b6b', 8); sfx('hurt'); updateHud(); }
          else if (e.t === 'splash') burst(e.x, e.y, '#4aa3df', 3);
          else if (e.t === 'thud') { burst(e.x, e.y, '#fff', 3); if (e.v > 2.4) sfx('thud', Math.min(0.5, e.v * 0.06)); }
          else if (e.t === 'win') onWin();
          else if (e.t === 'fail') onFail();
        }
      }
      if (sim.state === 'running') { var tl = $('timefill'); tl.style.width = Math.min(100, sim.t / sim.level.time * 100) + '%'; }
    } else acc = 0;
    var s = dt / 1000;
    for (var j = particles.length - 1; j >= 0; j--) { var q = particles[j]; q.x += q.vx * s; q.y += q.vy * s;
      if (q.rect) { q.vy = Math.min(q.vy + 120 * s, 110); q.vx *= 0.99; q.a += q.va * s; q.x += Math.sin(q.y * 0.05) * 0.6; q.l -= s * 0.8; }
      else { q.vy += 300 * s; q.l -= s * 1.8; } if (q.l <= 0) particles.splice(j, 1); }
    shake = Math.max(0, shake - dt * 0.03); catHurt = Math.max(0, catHurt - dt * 0.002); toastT = Math.max(0, toastT - dt);
    if (toastT <= 0) $('toast').classList.add('hide'); hurtFlash = Math.max(0, hurtFlash - dt * 0.004);
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
    // studio badge: fades in over the first playable frame and out again; never blocks input
    var sp = $('splash');
    if (sp) {
      document.body.classList.add('intro');
      setTimeout(function () { sp.classList.add('on'); }, 60);
      setTimeout(function () { sp.classList.remove('on'); document.body.classList.remove('intro'); }, 1900);
      setTimeout(function () { sp.remove(); }, 2600);
    }
  }
  P.init().then(loadSave).then(boot);
  window.__catnap = { start: startLevel, get sim() { return sim; }, menu: showMenu };
})();
