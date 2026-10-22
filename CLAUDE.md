# Nightvale: handoff notes

A cosy 2D Stardew-like game (vanilla JS, canvas). Open `index.html` through a local server (`.claude/launch.json` → "game-dev", port 8767). `python3 tools/build.py` writes the single-file builds `dist/nightvale.html` and `dist/nightvale-artifact.html`. The playable artifact is https://claude.ai/artifact/M57YuEsbGu3qDcEPCFvRyo (publish the artifact build there, keep its `db`/`user` capabilities).

## Layout
- `js/art/*`: procedural pixel art modules, each one global (`CharArt`, `MobArt`, `ItemArt`, `InteriorArt`, `WildArt`, `GothicArt`, ...).
- `js/data/*`: items, monsters, shops, contracts (`items3.js`), dialogue (`text.js`, `text3.js`).
- `js/world/*`: maps, buildings, interiors, NPCs, mobs, the Depths (`dungeon.js`, rare floors in `rare.js`).
- `js/systems/*`: farming, Guild (`guild.js`), Runesmithy/geodes (`smithy.js`), pets & mounts (`menagerie.js`), romance, Night Market, etc.
- `DESIGN3.md`: the round-3 spec. Picker pages live in `tools/`.

## Where things stand
Done: Guild contracts + 4 bounty bosses, Runesmithy + Collection Cabinet (specimen drawer; niches via `G.prefs.cabinetStyle`), pets/horses/flying dragons (R), romance (Laura, Jasmine, Amara, Ronan, Caspian), homes, rare cave floors, Night Market, Handbook/Crafting tabs, tester mode, Golden Hour default look.

Pending:
1. Portraits: user finds faces not cute/human enough. `CharArt.portraitStyled(style, ...)` has valley/sweet/soft/close/close_sweet; 'human' (64px) and 'human_hd' (96px) were being drawn. Next: a pick page showing EVERY character in each style, then make the chosen style the default and soften walking-sprite faces.
2. Alternatives the user asked for (round 3 page https://claude.ai/artifact/U8NrQSaz6LCS6os1cJWfzP, picks in its db doc `picks/round3`): horses, dragons, Vorrakh (MobArt ids `__b`/`__c`), Jasmine's & Amara's homes, Observatory & Crystal Garden rare floors (InteriorArt kinds `*_b`/`*_c`). Build an A/B/C pick page, then apply.
3. Furniture not drawn yet: trophy case, mineral cabinet (Cabinet milestone 14 pays 1,500 ✦ meanwhile).

## User preferences
- Sounds must be subtle and soft, never jarring.
- For visual decisions, make pick pages with several real alternatives, mark a recommendation, add a "Show alternatives" button, and save picks via the artifact `db` capability. Keep character designs; change rendering.
- They want it to feel very polished, clean and fun.
