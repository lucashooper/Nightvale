# Nightvale: handoff notes

A cosy 2D Stardew-like game (vanilla JS, canvas). Open `index.html` through a local server (`.claude/launch.json` → "game-dev", port 8767). `python3 tools/build.py` writes the single-file builds `dist/nightvale.html` and `dist/nightvale-artifact.html`. The playable artifact is https://claude.ai/artifact/M57YuEsbGu3qDcEPCFvRyo (publish the artifact build there, keep its `db`/`user` capabilities).

## Layout
- `js/art/*`: procedural pixel art modules, each one global (`CharArt`, `MobArt`, `ItemArt`, `InteriorArt`, `WildArt`, `GothicArt`, ...).
- `js/data/*`: items, monsters, shops, contracts (`items3.js`), dialogue (`text.js`, `text3.js`).
- `js/world/*`: maps, buildings, interiors, NPCs, mobs, the Depths (`dungeon.js`, rare floors in `rare.js`).
- `js/systems/*`: farming, Guild (`guild.js`), Runesmithy/geodes (`smithy.js`), pets & mounts (`menagerie.js`), romance, Night Market, etc.
- `DESIGN3.md`: the round-3 spec. Picker pages live in `tools/`.
- Design alternatives (Settings → Designs…, `js/ui/designs.js`): choices live in `G.prefs.alts` (`G.alt(key)` → 'a' | 'b' | 'c'; portraits → 'a' | 'human' | 'human_hd'). `G.altArt(id)` maps a MobArt id to its `<id>__b`/`__c` alternative. The alternatives live in `js/art/alt_mounts.js`, `alt_bosses.js` and `alt_rooms.js`, drawn through `MobArt._kit` / `InteriorArt._kit`; the B/C homes are built by `G.Interiors.homes[id](look)` and the rare-floor looks are picked in `rare.js`. `window.ALT_NOTES[key]` holds each alternative's name, note and the artist's pick.
- Round 4 pick page: sources in `tools/picks-r4/` (`page.html`, `page.js`, `take.json` = my picks); `node tools/picks-r4/capture.js` (game served on 8767) screenshots the rooms into `data.json`, then `python3 tools/build_picks.py` writes `tools/style-picks-r4.html`.

## Where things stand
Done: Guild contracts + 4 bounty bosses, Runesmithy + Collection Cabinet (specimen drawer; niches via `G.prefs.cabinetStyle`), pets/horses/flying dragons (R), romance (Laura, Jasmine, Amara, Ronan, Caspian), homes, rare cave floors, Night Market, Handbook/Crafting tabs, tester mode, Golden Hour default look. Round 4: portrait styles 'human' (64 px) and 'human_hd' (96 px); B/C alternatives for horses, dragons, Gloopgarr, Grimjaw, Vorrakh, Jasmine's and Amara's homes, the Observatory and the Crystal Garden; the Designs menu; the trophy case and mineral cabinet furniture.

Pending:
1. Apply the round 4 picks: page https://claude.ai/artifact/YRsM8kGpPNhrTq4BpSvZZq, picks in its db doc `picks/round4` (`choice[key]` = 'a' | 'b' | 'c', portraits 'a' | 'human' | 'human_hd'; `more[key]` = wants more alternatives; `notes[key]`). Make each chosen look the default (e.g. default `G.prefs.alts` in `core.js`; keep the others switchable in Designs), draw more options where `more` is set, then soften the walking-sprite faces to match the chosen portrait style. If a 96 px style wins, consider pre-rendering portraits while loading (about 19 ms each the first time).
2. All defaults are still look A until the user picks.

## User preferences
- Sounds must be subtle and soft, never jarring.
- For visual decisions, make pick pages with several real alternatives, mark a recommendation, add a "Show alternatives" button, and save picks via the artifact `db` capability. Keep character designs; change rendering.
- They want it to feel very polished, clean and fun.
