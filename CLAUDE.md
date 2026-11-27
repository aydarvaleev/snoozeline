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
- Next idea: score per level + leaderboard via bridge.leaderboards (Playgama itself: only via SaaS; YouTube: native). Hide when type is not_available.

## Open items
- Playtest with humans; fix unfair levels (watch attic and workshop, where one "pi" box solves many levels and difficulty comes mostly from the shrinking ink budget).
- Safari < 15 / old iOS may not decode Ogg Vorbis: add .mp3 copies of assets (game already falls back to .mp3 when ogg is unsupported).
- Bridge behaviour can only be fully verified in the Playgama sandbox.
- Optional: daily challenge, cat skins, GamePix/YouTube Playables builds.

## Rules to respect
Storage only via bridge.storage; no emoji icons (inline SVG); no Esc handling; no text selection; localisation from bridge.platform.language; send game_ready; pause/audio events from Bridge; audio only from files.
