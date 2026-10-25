# Nightvale

A cozy-mystical 2D pixel-art life sim: grow magical plants in a ruined moon temple, brew them into
potions, befriend the villagers of Hollowmere, and descend fifty floors of the Umbral Depths.

## Play

- **Easiest:** open `dist/nightvale.html` in a browser (Chrome, Edge, Firefox or Safari). It is one
  self-contained file. Fonts load from Google Fonts when online; everything else is built in.
- **From source:** serve this folder (for example `python3 -m http.server`) and open `index.html` (the website: pick a character and press Begin) or `play.html` (the game's own title screen).

Progress saves automatically each night when you go to bed.

### Controls
| Action | Keyboard | Mouse / touch |
|---|---|---|
| Move | WASD or arrows | joystick (touch) |
| Use the held tool or weapon | Space or C | left click / **Use** |
| Talk, harvest, open, examine, eat | E, X or F | right click / **Act** |
| Choose hotbar slot | 1–9, 0, -, = | scroll wheel or click a slot |
| Satchel, potion book, villagers, journal | I or Tab | **Bag** |
| Map / journal | M / J | |
| Pause and settings | Esc | |

Hold the mouse button to keep swinging or watering. When you hold a gift and talk to someone,
you can choose to give it.

## The world

| Place | What you do there |
|---|---|
| **The Verdant Sanctum** (home) | Farm the walled temple garden, brew at cauldrons, sleep in the keeper's cottage, sell through the moon offering box, restore the Moon Altar, pet Inkwell. |
| **Hollowmere** | Mirabel's seed shop, Sable's tavern, the notice board, the moonwell fountain. |
| **Whisperwood** | Foraging, Elowen's tree house, the fairy ring (visit on a full-moon night), Grizelda's hut in the bog. |
| **Glimmermere** | Fishing (Lune gives you a rod), lake shore foraging, the sunken moon statue. |
| **Starfall Ridge** | Brann's forge (tool upgrades, cauldrons), Orvyn's observatory (recipe scrolls), Corvin's Delvers' Lodge, the cemetery, mining, the mouth of the Depths. |
| **The Umbral Depths** | 50 generated floors in five biomes (Mossy Hollows, Amethyst Grotto, Webbed Catacombs, Haunted Crypts, Abyssal Rift), Rune Gates every 5 floors, the Broodmother on floor 25 and Vesper, the Umbral Archon on floor 50. |

## Core loop
1. Till, plant and water crops (moonpetal, glowcap, mandrake, frostmint, emberroot, duskberry,
   starbloom, wispvine) and the rare **potion vines**, which ripen straight into bottled potions.
2. Brew 2–3 ingredients in a cauldron. Eleven recipes; unknown ones can be discovered by experimenting.
3. Sell potions and crops (offering box overnight, or to shopkeepers), and drink them in the Depths.
4. Mine ore and gems, fight monsters, upgrade tools at the forge.
5. Complete the five offerings at the Moon Altar to restore the Sanctum and open the Archon's door.
6. Befriend nine villagers (talk daily, give gifts they love) to unlock their heart scenes and rewards.

The moon runs on an 8-day cycle: full moons speed up crops and wake the fairy ring; new moons make
the Depths richer and more dangerous.

## Code map
Plain JavaScript and HTML5 canvas, no build step needed for development. Everything visual and
audible is generated procedurally in code: there are no image or audio files.

| Path | Contents |
|---|---|
| `js/core.js`, `js/input.js`, `js/render.js`, `js/main.js` | engine: utilities, input, renderer with dynamic lighting, main loop |
| `js/art/` | procedural pixel art: terrain, nature, buildings, characters and portraits, monsters, items and crops |
| `js/audio.js` | procedural music (six generative pieces and a music director), ambience and sound effects |
| `js/world/` | maps, entities, villagers and schedules, monsters and AI, the dungeon generator |
| `js/systems/` | inventory, farming, fishing, saving, objectives |
| `js/ui/` | HUD, dialogue, menus, title screen and character creator |
| `js/data/` | item, crop, recipe and shop tables, and all dialogue and lore (`text.js`) |
| `tools/build.py` | bundles everything into `dist/nightvale.html` |
| `audio-test.html` | audition page for every track, sound and jingle |
