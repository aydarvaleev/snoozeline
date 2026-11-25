/* Platform adapter: Playgama Bridge when present, in-memory standalone mode otherwise.
   Keeps the game code independent of the portal SDK (GamePix etc. can get their own adapter). */
(function () {
  'use strict';
  var P = {
    kind: 'standalone', lang: 'en', audio: true, paused: false,
    rewardedSupported: false, interstitialSupported: false, mem: {},
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
    if (mock) { P.rewardedSupported = true; P.interstitialSupported = true; }
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
  window.Platform = P;
})();
