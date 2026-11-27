# Snoozeline (working title was Catnap) — project handoff

HTML5 "draw to protect" physics puzzle (sleeping cat, limited ink). Owner: Aydar (Russian-speaking indie dev). Target: Playgama first (also YouTube Playables via Playgama), GamePix later via a separate adapter. DO NOT upload/publish to Playgama without the owner's explicit "yes".

## Layout
- index.html — DOM UI (HUD, modals, menu) + Valey Studio splash (~1.5 s, tap to skip; game_ready is sent when it hides). playgama-bridge.js is the FIRST script in <head> (Bridge required step 2).
- src/sim.js — Matter.js physics core, shared by browser and Node generator (UMD). Fixed step 1000/120 ms, seeded rng, deterministic.
- src/gen.js — level generator + solvability validator. `node src/gen.js <worlds>`; env `ONLY_I=4,5` limits level indexes, `FAST=1` uses a smaller shape set (attic is slow: hundreds of water drops). Writes gen-out/part_*.json.
- src/merge.js — merges gen-out/part_*.json into src/levels.js (+ `hint` = known solution polyline) and src/levels.report.json. `FILL_OLD=1` fills missing ids from gen-out/old_report.json (testing only).
- src/rehint.js — finds a ROBUST hint per level (wins when drawn a few px off; prefers 0, then 1 hit). `IDS=4,26 node src/rehint.js` -> gen-out/hints_*.json (merge applies them; files sorting later win).
- src/verify.js — MUST pass before every upload: no level is won without lines, every hint wins within budget, gives 3 stars, and wins in >= 5 of 6 slightly-off drawings. Physics differs in the last float digits between Node/Chrome/Safari, so only robust solutions are acceptable.
- src/art.js — all procedural canvas art (world backgrounds cached offscreen, animated cat, threats, ink, hint ghost).
- src/game.js — rendering loop, input, UI, audio playback. src/platform.js — Bridge adapter + standalone fallback (`?mock=1` fakes ads). src/i18n.js — 9 languages (en default; v2 strings appended at the end).
- assets/*.ogg — real CC0 audio (Kenney + OpenGameArt), see licenses/CREDITS.md. Playgama rule 3.3.2 forbids code-synthesized sound.
- build.py — dist/snoozeline-playgama.zip (upload) and dist/snoozeline-standalone.html.
- Setup: `npm i`. Preview: serve the folder (the app's preview cannot read ~/Desktop directly; a mirror copy is used).

## Core rules (changed in v2)
- Lines are dynamic bodies and fall. A line lying ON the cat (contact from above) passes every ball/box hit to the cat; a line dropped onto the cat wakes it. Leaning on the cat's side is harmless. => shelters must stand on the floor/shelf; a lazy flat "roof" no longer works.
- Players cannot draw inside the cat's box (toast "Not on the cat!").
- Balls/boxes that hit the cat bounce off it (no pile-ups that block later hits).
- Stars are measured against each level's slack: 3 stars if ink used <= minInk + 50% of (budget - minInk), 2 stars up to 85%; more than max(1, level.bumps) hits caps at 2.
- Level 1 shows the hint ghost until the first stroke (onboarding). Rewarded `show_hint` shows it on any level after a fail; `skip_level` after 2 fails.
- Interstitials: requested on every natural pause (Next / Retry / Menu from a result screen). No own counters — Bridge decides frequency.

## Furniture (v3)
Level field `furniture: [{k, x, side, step, under}]`; kinds nightstand, sofa, chair, table, wall, stairs. Geometry lives in sim.js (FURN, furnitureParts, furnitureSpot) and is shared by sim, generator (props/bridges from part corners) and art.js (A.furniture). Players cannot draw inside furniture (points are skipped). Nightstand is 132 wide (room for shelter legs around the cat); chair seat is 124 wide with the cat near the backrest, so a line from the backrest to the free seat edge holds.
- strokeBody() sets the moment of inertia itself (parallel-axis sum): Matter sums only the parts' own inertias, which made long lines jitter and fly off at a touch. Never remove this; all hints depend on it. Ink is dense (0.012) and furniture/floor are grippy so lines can rest on supports. "Cat under the table" was dropped: the legs fence every threat off. Level time = last spawn + 1.9 s (pace() in gen.js), so there is no idle waiting.

## Levels
Sim resets Matter's body ids per level (deterministic per engine). Chaos world: cat wakes on the 4th hit (sleep 4) because it is the most chaotic. Level field `bumps` = hits the reference hint takes; 3 stars allow max(1, bumps) hits.
60 levels (5 worlds x 12): 0 bedroom (hand-authored tutorial specs, one idea per level), 1 attic (drips+wind+rollers), 2 garden (bees), 3 workshop (ramps throw balls at the cat; cat placed at the ramp's landing point), 4 chaos. Targets per world are in TARGET in gen.js; budget factor falls from ~2.6x (tutorial) to 1.4x (last level).

## Chapters and cats (v4)
- Menu groups levels in chapters of CH=6 (game.js); names c0..c9 in i18n, fallback "<world name> N" so adding levels just adds chapters at the end (progress is stored by level index — only append). Locked chapters show only their title.
- Second chapter of each world uses the alternative background (PAL2 / `v` flag in art.js bg()); a level may force it with field `v`.
- Win card shows "Chapter complete!" (first completion) and "New cat unlocked!". Cats (Art.SKINS) unlock by TOTAL stars (thresholds, nothing is spent); chosen skin is saved as `skin`, `seen` = number of unlocked cats already shown (red dot on the menu cat button).
- Bridge storage.get may return the save already parsed (object) — loadSave() accepts both. `__catnap.reload()` reloads the save (testing).
- Score (v5): runScore() = 1000 per win + up to 600 for saved ink (vs the level's slack) + 400/150 for 0/1 hits; best per level in save.score; levels done before v5 count 1000 + 0/300/600 by stars. Total goes to leaderboard `total_score` (config `leaderboards`, isMain) via P.setScore when it grows.
- Leaderboard UI follows bridge.leaderboards.type: in_game -> our modal (getEntries), native_popup -> showNativePopup, native/not_available -> no board (score pill stays, not tappable). `?mock=1` fakes an in_game board.
- Playgama itself has no native board: enable SaaS leaderboards by adding `"saas": {"publicToken": "...", "leaderboards": {"platforms": ["playgama", "qa_tool"]}}` to playgama-bridge-config.json (token from the game card in developer.playgama.com -> Bridge SaaS -> Leaderboards). Done 2026-11-27: draft game card Snoozeline (application id cmwymo3a20pwpno0h7op16t4w) with leaderboard total_score; its publicToken is in the config. Archive snoozeline-1.5.0 (id cmwymusgp188imz0hf7lk937d) uploaded 2026-11-27: build check PASSED, Bridge 2.4.4 found; SaaS board answers in the QA tool. Next in the console: covers (square/portrait/landscape), form, certification; form filled (category puzzle, 9 languages, iOS/Android/desktop, both orientations, leaderboards). Sandbox published 2026-11-27 on the owner's yes: https://playgama.ai/play/gklwt2vjc5lt3g (no moderation). Still the owner's: Guided Certification in the QA tool, then moderation; distributeEverywhere and link left unset. Every new upload needs a new explicit yes.

## CrazyGames
- build.py also writes dist/snoozeline-crazygames.zip (same files: Bridge detects crazy_games and loads their SDK v3 itself) and dist/crazygames-covers/ (1920x1080, 800x1200, 800x800 from promo/cover.html). Upload is done by the owner on developer.crazygames.com.
- Their rules handled in code via P.id === 'crazy_games': no interstitial on the result-screen Menu button (no ads on navigation). level_paused/level_resumed are sent for settings during a level and when leaving a level for the menu (Bridge relays them as gameplayStop/Start). Leaderboard is hidden there (type not_available).
- Covers must have NO alpha channel (CrazyGames rejects PNGs with transparency): promo/cover.html draws on an opaque canvas and also writes JPGs; the CrazyGames folder uses the JPGs; its square and landscape covers (cg_*) and the 2:3 one keep the title at the bottom, away from the top-left "label zone" where CrazyGames puts NEW/HOT badges. Preview videos (17.4 s, no audio, 1920x1080 and 1080x1620) come from promo/video.html (frames rendered with the real sim) + promo/encode.swift (AVFoundation H.264).
- Test locally with `?platform_id=crazy_games` (CrazyGames SDK runs in its local environment).

## Open items
- Playtest with humans; fix unfair levels (watch attic and workshop, where one "pi" box solves many levels and difficulty comes mostly from the shrinking ink budget).
- Safari < 15 / old iOS may not decode Ogg Vorbis: add .mp3 copies of assets (game already falls back to .mp3 when ogg is unsupported).
- Bridge behaviour can only be fully verified in the Playgama sandbox.
- Optional: daily challenge, cat skins, GamePix/YouTube Playables builds.

## Rules to respect
Storage only via bridge.storage; no emoji icons (inline SVG); no Esc handling; no text selection; localisation from bridge.platform.language; send game_ready; pause/audio events from Bridge; audio only from files.
