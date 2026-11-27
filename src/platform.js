/* Platform adapter: Playgama Bridge when present, in-memory standalone mode otherwise.
   Keeps the game code independent of the portal SDK (GamePix etc. can get their own adapter). */
(function () {
  'use strict';
  var P = {
    kind: 'standalone', lang: 'en', audio: true, paused: false,
    rewardedSupported: false, interstitialSupported: false, mem: {}, lbType: 'not_available',
    onPause: function () {}, onAudio: function () {}
  };
  var rewardCb = null;
  var mock = /[?&]mock=1/.test(location.search);

  P.init = function () {
    var b = window.bridge;
    if (b && typeof b.initialize === 'function') {
      return b.initialize().then(function () {
        P.kind = 'bridge';
        P.lang = String(b.platform.language || 'en').slice(0, 2).toLowerCase();
        P.audio = b.platform.isAudioEnabled !== false;
        P.rewardedSupported = !!b.advertisement.isRewardedSupported;
        P.interstitialSupported = !!b.advertisement.isInterstitialSupported;
        try { P.lbType = (b.leaderboards && b.leaderboards.type) || 'not_available'; } catch (e) { P.lbType = 'not_available'; }
        if (mock) P.lbType = 'in_game';
        if (b.advertisement.interstitialState === 'opened' || b.advertisement.rewardedState === 'opened') P.paused = true;
        b.platform.on(b.EVENT_NAME.AUDIO_STATE_CHANGED, function (v) { P.audio = v !== false; P.onAudio(P.audio); });
        b.platform.on(b.EVENT_NAME.PAUSE_STATE_CHANGED, function (v) { P.paused = !!v; P.onPause(P.paused); });
        b.advertisement.on(b.EVENT_NAME.REWARDED_STATE_CHANGED, function (state) {
          if (!rewardCb) return;
          var cb = rewardCb;
          if (state === 'rewarded') { rewardCb = null; cb(true); }
          else if (state === 'failed' || state === 'closed') { rewardCb = null; cb(false); }
        });
      }).catch(function () { /* run standalone */ });
    }
    if (mock) { P.rewardedSupported = true; P.interstitialSupported = true; P.lbType = 'in_game'; }
    return Promise.resolve();
  };

  P.get = function (keys) {
    if (P.kind === 'bridge') return window.bridge.storage.get(keys).catch(function () { return keys.map(function () { return null; }); });
    return Promise.resolve(keys.map(function (k) { return P.mem[k] == null ? null : P.mem[k]; }));
  };
  P.set = function (keys, vals) {
    if (P.kind === 'bridge') return window.bridge.storage.set(keys, vals).catch(function () {});
    keys.forEach(function (k, i) { P.mem[k] = vals[i]; });
    return Promise.resolve();
  };
  P.msg = function (name, data) {
    if (P.kind !== 'bridge') return;
    try { window.bridge.platform.sendMessage(name, data); } catch (e) { try { window.bridge.platform.sendMessage(name); } catch (e2) {} }
  };
  P.interstitial = function (placement) {
    if (P.kind === 'bridge' && P.interstitialSupported) { try { window.bridge.advertisement.showInterstitial(placement); } catch (e) {} }
  };
  P.rewarded = function (placement, done) {
    if (P.kind === 'bridge' && P.rewardedSupported) {
      rewardCb = done;
      try { window.bridge.advertisement.showRewarded(placement); } catch (e) { rewardCb = null; done(false); }
    } else if (mock) { setTimeout(function () { done(true); }, 300); }
    else done(false);
  };
  /* leaderboard: one board, id 'total_score' (see playgama-bridge-config.json) */
  var LB = 'total_score';
  P.setScore = function (score) {
    if (P.kind !== 'bridge' || P.lbType === 'not_available' || mock) return;
    try { window.bridge.leaderboards.setScore(LB, score).catch(function () {}); } catch (e) {}
  };
  P.getEntries = function () {
    if (mock) return Promise.resolve([{ rank: 1, name: 'Mia', score: 104200 }, { rank: 2, name: 'Leo', score: 98750 }, { rank: 3, name: 'Sasha', score: 87310 }, { rank: 4, name: 'Kenji', score: 61020 }, { rank: 5, name: 'Ana', score: 40400 }]);
    if (P.kind !== 'bridge' || P.lbType !== 'in_game') return Promise.reject(new Error('n/a'));
    return window.bridge.leaderboards.getEntries(LB);
  };
  P.showNativeBoard = function () {
    if (P.kind === 'bridge' && P.lbType === 'native_popup') { try { window.bridge.leaderboards.showNativePopup(LB).catch(function () {}); } catch (e) {} }
  };
  window.Platform = P;
})();
