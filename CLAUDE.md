# Catnap — project handoff

HTML5 "draw to protect" physics puzzle (sleeping cat, limited ink). Owner: Aydar (Russian-speaking indie dev, Da Nang). Target: Playgama first (also YouTube Playables via Playgama), GamePix later via a separate adapter. DO NOT upload/publish to Playgama without the owner's explicit "yes".

## Layout
- index.html — DOM UI (HUD, modals, menu), loads scripts in order.
- src/sim.js — Matter.js physics core, shared by browser and Node generator (UMD). Fixed step 1000/120 ms, seeded rng, deterministic.
- src/gen.js — level generator + solvability validator. Usage: `node src/gen.js 0 2 4` (world indexes; writes /tmp/part_<worlds>.json). Merge parts into src/levels.js (`window.CATNAP_LEVELS=[...]`) and src/levels.report.json (has `solution`, `minInk`). ~5 min for 2 worlds per process.
- src/game.js — canvas rendering, input, UI logic. src/platform.js — Playgama Bridge adapter + standalone fallback. src/i18n.js — 9 languages (en default).
- assets/*.ogg — PLACEHOLDER synthesized audio. build.py — makes dist/catnap-playgama.zip and dist/catnap-standalone.html.
- Needs: `npm i matter-js @playgama/bridge puppeteer-core`; copy node_modules/matter-js/build/matter.js -> matter.min.js, node_modules/@playgama/bridge/dist/playgama-bridge.js -> ./ . Serve with `python3 -m http.server 8123`; test with headless /usr/bin/google-chrome via puppeteer-core.

## Current state
60 levels (5 worlds x 12): 0 bedroom, 1 attic (drips+wind), 2 garden (bees), 3 workshop (ramps), 4 chaos. Game starts directly on the last unlocked level. Tested at portrait/landscape/square with no bars.

## TODO (owner wants nothing left weak)
1. Worlds 1 and 3: flat difficulty (minInk ~125 everywhere). Smooth the curve; still ~12 of 60 levels solvable by a plain roof. Hand-tune levels 1-12 as tutorial.
2. Render/audio upgrade: PixiJS (or better canvas), Howler.js, particles, cat animation, win screen. Keep initial bundle <30MB, no external network calls (YouTube Playables rule).
3. Real audio (rule 3.3.2): CC0 sets (Kenney, freesound CC0), keep licences file. Replace assets/*.ogg.
4. Art polish (moderation rule 4.3). 5. Bridge integration only verifiable in the Playgama sandbox: check playgama-bridge-config.json placements format vs docs; run the Playgama checklist item by item.
6. Playtest with a human; fix unfair levels. Optional: daily challenge, cat skins, GamePix/YouTube Playables builds.

## Rules to respect
Storage only via bridge.storage; no emoji icons (inline SVG); no Esc handling; no text selection; localisation from bridge.platform.language; send game_ready; pause/audio events from Bridge.
