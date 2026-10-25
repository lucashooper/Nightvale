# Nightvale: handoff notes

A cosy 2D Stardew-like game (vanilla JS, canvas). The repo root is a static website: `index.html` is the marketing page (`site/` holds its CSS, JS and screenshots, refreshed by `node tools/site-shots.js`), and `play.html` is the game. The site's character picker opens `play.html?new=1&name=…&look=skin,hair,hairColor,robe,eyes` (or `?continue=1`), handled by `G.Screens.quick`. Serve the folder locally (`.claude/launch.json` → "game-dev", port 8767). `python3 tools/build.py` writes the single-file builds `dist/nightvale.html` and `dist/nightvale-artifact.html`. The playable artifact is https://claude.ai/artifact/M57YuEsbGu3qDcEPCFvRyo (publish the artifact build there, keep its `db`/`user` capabilities).

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

Round 4 picks (page https://claude.ai/artifact/YRsM8kGpPNhrTq4BpSvZZq, db doc `picks/round4`) are applied as `G.ALT_DEFAULTS` in `core.js`: faces Human HD, horses B (Shire Giant), dragons C (Cloud Serpent), Gloopgarr C (Jelly Glutton), Grimjaw B (Old Silvermane), Vorrakh A, Jasmine B (Honey Bakery), Amara B (Attic Stargazer), Observatory C (Sunstone Hall), Crystal Garden B (Rose Quartz Hollow). Settings saved earlier adopt them once (`prefs.altsV`); Designs still switches any of them. Walking-sprite faces were softened to match (coloured eyes, a hint of blush). HD portraits are drawn ahead in idle time (`UI.warmPortraits`).

Pending: nothing from the user's list. If they ask for more options on something, add `__d`-style ids or a new key the same way.

## User preferences
- Sounds must be subtle and soft, never jarring.
- For visual decisions, make pick pages with several real alternatives, mark a recommendation, add a "Show alternatives" button, and save picks via the artifact `db` capability. Keep character designs; change rendering.
- They want it to feel very polished, clean and fun.
