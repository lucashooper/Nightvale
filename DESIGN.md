# NIGHTVALE — design bible

A cozy-mystical 2D pixel-art life sim (Stardew Valley structure, its own look).
You inherit a ruined moon temple, grow magical plants, brew potions, befriend villagers,
and descend into a monster-filled dungeon beneath the mountain.

---------------------------------------------------------------------------------------
## 1. Tech conventions (everyone)
- Plain browser JS, classic `<script>` tags, no modules/bundler, must run from file://.
- Each file is an IIFE that defines exactly ONE global (named in its spec). No other globals.
- World is rendered at 1x "world pixels" into a small buffer (16x16 px tiles) and upscaled
  with nearest-neighbour, so ALL art is true pixel art at 1x (no anti-aliasing, no sub-pixels,
  no canvas arc()/ellipse() anti-aliased shapes — set pixels yourself).
- Art modules draw into their own tiny RGBA pixel buffers (Uint8ClampedArray) so the same code
  runs in node for verification (export PNG contact sheets with node's zlib and look at them
  with the Read tool). In the browser, buffers are converted to <canvas> and cached.
- Light source: top-left. Outlines: 1px, use the darkest tone of the local material or the
  global outline colour #120c1c (never pure black). Selective outlining is welcome.
- The game adds dynamic lighting/glow on top at runtime; glowing things should be drawn with
  their bright core pixels (the engine adds the halo).

## 2. Palette — "Twilight Hollow"
Storybook dusk: emerald foliage, violet shadows, slate roofs, warm amber windows, wisteria trees.
Readable in the day, magical at night. Prefer these; derive extra shades by hue-shifting toward
violet in shadows and toward warm/yellow-green in highlights.

| role | dark → light |
|---|---|
| outline | #120c1c |
| shadow violets | #1b1429 #231b38 #362a52 #4a3b6d #604e88 |
| magic violet | #4a2f7a #6a47a8 #8f6cd1 #b99aee #e4d2ff |
| foliage greens | #10302a #1a4434 #245a40 #337450 #4c9061 #74b46e |
| grass | #163a30 #1f4e3c #296246 #377a53 #589c64 |
| emerald glow | #2fbf7f #5dffb0 #b4ffd9 |
| moon / pale | #9fb0d8 #c8d4f0 #e8eeff #ffffff |
| warm accents | amber #ffbc62, gold #f2c45a, candle #fff1c8, orange #e8843c, ember red #c44a3a |
| rose / pink | #8c3a62 #c4648e #e89ab8 |
| water | #17224c #213479 #2e4f9f #69a1db #c4e6ff |
| stone (cool) | #2d2c3e #45445a #605f78 #7e7d97 #a09fb6 #c4c3d6 |
| wood | #281d21 #3e2d2b #574039 #7a5a48 #9c7a5e |
| path cobble | #3a3450 #534a6d #6e648f #8c81ac |
| soil | #22182c #31233d #43324d #56425f |

Skin ramps (shadow, base, light): pale #c9a9b8/#ecd3d9/#fbeef0 · fair #c98e74/#ebb79a/#f8d6c0 ·
tan #a86e4f/#cf9670/#e8b892 · brown #7a4a32/#9e6646/#c08560 · deep #4e2e20/#6e4630/#8e6044 ·
witch-green #566e45/#7a9562/#a2bd86.
Hair: silver #b8b4cc/#d8d4e8/#f4f2fb · black #120c1c/#2a2238/#46395c · ginger #a8441e/#e07a3a/#f6a868 ·
auburn #6e2a22/#a8442e/#cc6a4a · brown #3e2a20/#6a4630/#8e6448 · moss #2f5a36/#4f8a52/#7ab878 ·
white #c4c0d4/#eceaf4/#ffffff · plum #3e1c42/#6a2e6a/#9a4e94.

## 3. World & lore
Nightvale is a valley where the moon hangs a little too close. Centuries ago the Lunar Order
built the **Verdant Sanctum**, a moon temple whose roots ("the Moonroot") carry moonlight into
the soil — that's why magical plants grow here. Long ago a sliver of the moon fell beneath
**Starfall Ridge**; the caverns around it became the **Umbral Depths**, and something there —
**the Umbral Archon** — feeds on that fallen light. The Order sealed it with the light of the
**Moon Altar** in the Sanctum.

**Morwenna Vale**, the last keeper of the Sanctum and the valley's beloved (and famously
stubborn) alchemist, grew old; the garden withered, the altar dimmed, and the seal weakened.
Monsters now prowl the Depths and the moon looks paler each month. Morwenna has just died
("passed beyond the Veil"). Her letter leaves the Sanctum to the PLAYER — her former apprentice
from the city, who hasn't visited in years — with the line:
*"The moon remembers what we forget. Wake the garden, and the garden will wake the valley."*

Goals: restore the garden, brew potions, rekindle the Moon Altar with offerings, befriend the
villagers, and descend the Depths to face the Archon.

Currency: **glimmer** (shown as "1,250 ✦").
Week: Moonday, Mistday, Wyrmsday, Thornsday, Emberday, Starday, Sunday.
Day: 6:00 → 2:00 (sleep before 2am or pass out). No seasons; instead an **8-day moon cycle**:
new moon → waxing crescent → first quarter → waxing gibbous → **full moon** → waning gibbous →
last quarter → waning crescent. Full moon: crops grow faster, the fairy ring in Whisperwood
awakens at night, Grizelda visits the ring. New moon: the Depths are more dangerous but richer.
Weather: clear, rain (waters crops), mist, starfall (rare, falling stars leave Starshards).

## 4. Locations (6)
1. **The Verdant Sanctum** (`sanctum`) — the player's home: a ruined moon temple with a walled
   garden courtyard (farm plots), an inner shrine (bed, cauldrons, storage chest, the Moon Altar),
   a reflecting pool, overgrown rubble/weeds/stumps to clear. A black cat familiar, **Inkwell**,
   lives here. Exit east → Village.
2. **Hollowmere** (`village`) — the village: Thornwick's Seeds & Sundries (Mirabel), The Gilded Owl
   tavern (Sable), cottages, a moonwell fountain square, a notice board, a river with bridges.
   Exits: west Sanctum, north Ridge, south Woods, east Lake.
3. **Whisperwood** (`woods`) — forest to the south: foraging, trees, a fairy ring, Elowen's grove,
   and deep in the misty bog to the south, Grizelda's crooked hut.
4. **Glimmermere** (`lake`) — a lake to the east: dock, Captain Lune's boathouse, fishing,
   a half-sunken moon statue, lilies and shells on the shore.
5. **Starfall Ridge** (`ridge`) — the mountain to the north: Brann's Starfall Forge, Orvyn's
   Observatory tower, the old hillside cemetery (Corvin), the Delvers' Lodge and the mouth of the
   Umbral Depths. Mining rocks, Starshards.
6. **The Umbral Depths** (`depths`) — the dungeon, 50+ floors. Rune Gates every 5 floors let you
   return to that floor. Themes: 1–9 Mossy Hollows · 10–19 Amethyst Grotto · 20–29 Webbed
   Catacombs · 30–39 Haunted Crypts · 40–49 Abyssal Rift · 50 the Archon's Throne (boss).

## 5. NPCs (9)
Expressions every portrait supports: neutral, happy, sad, surprised, angry.
Dialogue voice blips: {pitch, timbre}.

1. **Mirabel Thornwick** (`mirabel`) — runs Thornwick's Seeds & Sundries. ~70, warm, grandmotherly,
   practical, a little nosy, loves plant gossip and feeding people; Morwenna's oldest friend
   (and gentle rival in the annual pumpkin... er, mandrake show). Pip's grandmother.
   Look: fair skin, rosy cheeks, silver hair in a big bun with a sprig of lavender, round gold
   spectacles, kind crow's feet, lavender knitted shawl over a moss-green dress. Voice 0.9 soft.
2. **Pip Fizzlewick** (`pip`) — Mirabel's 12-year-old grandson, self-declared "apprentice alchemist",
   hyperactive, a hundred questions a minute, blows things up, desperately wants to be YOUR
   apprentice. Look: fair freckled skin, wild ginger hair, brass goggles pushed up on forehead,
   soot smudge on cheek, gap-toothed grin, oversized patched purple coat. Voice 1.6 squeaky.
3. **Sable Nightingale** (`sable`) — owner of The Gilded Owl tavern, ex-travelling bard, charming,
   wry, knows every secret and keeps most of them; adventured years ago with Captain Lune.
   Look: deep brown skin, long black braids threaded with gold cuffs and tiny violet flowers,
   gold hoop earrings, amber eyes, burgundy bodice with gold trim. Voice 1.0 bright.
4. **Brann Ironroot** (`brann`) — blacksmith & enchanter at the Starfall Forge. Gruff, short sentences,
   secretly sentimental (carves little wooden animals), bickers with Orvyn about "real work".
   Look: tan skin, huge braided ginger-red beard, bald head with a burn scar, heavy brows,
   soot, leather apron over a sleeveless shirt, broad shoulders. Voice 0.6 deep.
5. **Orvyn Starcloak** (`orvyn`) — ancient astronomer-wizard of the Observatory. Kind, cryptic,
   absent-minded, talks in star metaphors, knows the lore of the Order and the Archon, was
   Morwenna's teacher once. Look: pale wrinkled skin, very long white beard, bushy white brows,
   half-moon spectacles, tall indigo pointed hat with silver stars, deep blue robe. Voice 0.75 airy.
6. **Elowen Mossbright** (`elowen`) — druid-ranger of Whisperwood. Shy, gentle, earnest, speaks to
   animals and trees, fierce when the forest is threatened. Grizelda was once her teacher
   (they no longer speak). Look: olive/tan skin with freckles, pointed elf ears, long moss-green
   hair with a leaf-and-twig crown, leaf-green eyes, green hooded cloak with a wooden clasp.
   Voice 1.25 airy.
7. **Grizelda Hexley** (`grizelda`) — bog witch of the southern mire. Cackling, blunt, mischievous,
   trades rare seeds and curios, secretly kind and lonely; rival/friend of Morwenna.
   Look: witch-green skin, hooked nose with a wart, one gold tooth, wild grey-black hair,
   huge crooked black-purple hat with a raven feather, beady yellow eyes. Voice 0.85 raspy.
8. **Corvin Ashgrave** (`corvin`) — keeper of the old cemetery and of the Delvers' Lodge at the mouth
   of the Depths (sells weapons/supplies, buys monster loot). Gloomy, poetic, deadpan, secretly
   funny and caring; his older sister **Wren** vanished in the Depths five years ago.
   Look: pale skin, black hair swept over one eye, tired dark-violet eyes with shadows, small
   silver earring, high-collared black coat with a raven pin. Voice 0.8 deep.
9. **Captain Lune Marrow** (`lune`) — fisher at Glimmermere, retired adventurer, boisterous
   storyteller who exaggerates everything, sells rods & bait, buys fish. Sable's old partner.
   Look: weathered brown skin, short silver-blue hair, eyepatch over the left eye, scar across
   the cheek, navy captain's hat with a crescent-moon badge, teal coat. Voice 0.95 bright.

Rough schedules: Mirabel shop 9–17 (village); Pip roams village/woods edge, sometimes visits the
Sanctum gate; Sable tavern 11–24, dock mornings on Moonday/Starday; Brann forge 8–18 then tavern;
Orvyn observatory (stargazes on the balcony at night); Elowen woods, fairy ring at dusk;
Grizelda her hut (fairy ring on full-moon nights); Corvin Delvers' Lodge 10–18, cemetery evenings;
Lune dock 6–16, boathouse, tavern at night.

### Gift tastes (item ids — see §6)
| npc | love | like | dislike | hate |
|---|---|---|---|---|
| mirabel | moonpetal, starbloom, pot_healing, food_pie | frostmint, wolfsbane, moonlily, food_tea, honey | slime_gel, bone_dust, bat_wing | sludge, void_essence |
| pip | sludge, glowcap, spider_silk, golem_core, pot_ember | slime_gel, amethyst, bat_wing, food_pie, fish_glimmerfin | frostmint, moonlily, food_tea | wolfsbane, bone_dust |
| sable | emberroot, pot_starlight, pearl, food_mead | duskberry, emerald, moonstone, fish_mooncarp, honey | glowcap, spore_sac | sludge, ectoplasm |
| brann | ore_starsilver, emberroot, food_stew, golem_core | ore_shadow, ore_glimmer, wood, amethyst, food_mead | moonpetal, moonlily, starbloom | sludge, spider_silk |
| orvyn | starbloom, starshard, moonstone, pot_moon | moonpetal, quartz, arcane_dust, pot_starlight, food_tea | mandrake, slime_gel | sludge, bone_dust |
| elowen | fairycap, moonlily, frostmint, feather | wolfsbane, moonpetal, duskberry, wispbloom, honey | ore_glimmer, ore_shadow, stone | bone_dust, void_essence |
| grizelda | sludge, mandrake, spider_silk, ectoplasm, bog_amber | bat_wing, duskberry, spore_sac, fish_ghosteel | moonpetal, pot_healing, food_tea | starbloom, honey |
| corvin | duskberry, ectoplasm, food_coffee, bat_wing | bone_dust, moonstone, pot_shadow, fish_ghosteel | emberroot, honey, food_pie | starbloom, sludge |
| lune | fish_lanternpike, fish_ghosteel, pot_starlight, food_mead | fish_mooncarp, pearl, driftwood, shell, emberroot | moonpetal, spore_sac | sludge, frostmint |

## 6. Items (id — name — notes)
Tools: hoe (Rune Hoe), can (Dew Can), pickaxe, axe, sword_rusty (Rusty Moonblade),
sword_silver (Silverthorn Saber), sword_star (Starsteel Blade), sword_umbral (Umbral Edge),
wand_apprentice (Apprentice Wand), wand_ember (Ember Wand), wand_astral (Astral Staff), rod (Fishing Rod).
Tool upgrade tiers: basic → glimmer → shadowiron → starsilver.

Seeds: seed_moonpetal, seed_glowcap (spores), seed_mandrake, seed_frostmint, seed_emberroot,
seed_duskberry, seed_starbloom, seed_wispvine (cutting), seed_phialvine (potion vine),
seed_starflask (potion vine bulb).

Crops / ingredients: moonpetal (pale-blue glowing flower), glowcap (luminous cyan-violet mushroom),
mandrake (root with a grumpy face), frostmint (icy pale-cyan leaves), emberroot (glowing red-orange
root/pepper), duskberry (cluster of deep-purple berries), starbloom (golden five-point star flower),
wispbloom (ghostly white-teal flower).

Forage: fairycap (violet-spotted forest mushroom), wolfsbane (purple hooded flower), moonlily
(white lake lily), feather (owl feather), starshard (glowing crystal shard), bog_amber, driftwood,
shell (mooncockle shell), pearl (moon pearl), honey (wild honeycomb).

Resources: wood, stone, fiber, ore_glimmer, ore_shadow (shadowiron), ore_starsilver,
amethyst, emerald, moonstone, quartz (arcane quartz), voidcrystal.

Monster loot: slime_gel, bat_wing, spider_silk, bone_dust, ectoplasm, arcane_dust, golem_core,
void_essence, spore_sac.

Fish: fish_glimmerfin, fish_mooncarp, fish_mistperch, fish_ghosteel (night), fish_lanternpike
(rare, night), fish_crownjaw (legendary).

Potions: pot_healing (Healing Draught), pot_vigor (Vigor Tonic), pot_swift (Swiftstep Brew),
pot_ember (Emberheart Elixir), pot_mandrake (Mandrake Restorative), pot_frostward (Frostward Philter),
pot_starlight (Starlight Philter), pot_shadow (Shadowveil Draught), pot_fairy (Fairy Draught),
pot_tide (Tidecaller Tonic), pot_moon (Elixir of the Moon), sludge (Murky Sludge — failed brew).

Food: food_bread (Lavender Loaf), food_stew (Hearty Mushroom Stew), food_pie (Duskberry Pie),
food_mead (Honeymoon Mead), food_tea (Starleaf Tea), food_coffee (Midnight Brew).

Placeables: cauldron (Copper Cauldron), dewcrystal (Dew Crystal sprinkler), moonmulch (fertilizer).

## 7. Crops
| crop | days | regrow | seed ✦ | sells ✦ | look |
|---|---|---|---|---|---|
| moonpetal | 4 | – | 20 | 45 | slender stem, pale-blue petals with a glowing white core |
| glowcap | 3 | – | 15 | 32 | cluster of small luminous cyan-violet mushrooms |
| mandrake | 6 | – | 45 | 110 | broad dark leaves; harvest pulls a root with a face |
| frostmint | 5 | 3 | 70 | 55 | frosty pale-cyan mint leaves with sparkles |
| emberroot | 7 | – | 60 | 150 | dark red leaves, glowing orange root/pepper |
| duskberry | 8 | 4 | 90 | 70 | bush with clusters of deep-purple berries |
| starbloom | 10 | – | 140 | 360 | tall stalk, golden star-shaped flower that glimmers |
| wispvine | 9 | 3 | 220 | 160 | pale ghostly vine on a little trellis, white-teal bells |
| phialvine | 8 | 4 | 300 | → pot_healing ×1–2 | trellis vine whose fruits are little glass phials of red healing liquid |
| starflask | 10 | 5 | 450 | → pot_vigor ×2 | lily whose bulbs are round glass flasks of glowing green tonic |
5 growth stages: 0 seed/sprout, 1 small, 2 medium, 3 budding, 4 ripe.

## 8. Potions (brewed in cauldrons; 2–3 ingredients, order-free)
| potion | recipe | effect | sells |
|---|---|---|---|
| pot_healing | moonpetal + moonpetal | +50 HP | 120 |
| pot_vigor | glowcap + frostmint | +60 energy | 130 |
| pot_fairy | fairycap + wolfsbane | +30 HP +30 energy | 95 |
| pot_swift | duskberry + spider_silk | +speed 3 min | 240 |
| pot_ember | emberroot + slime_gel | +attack 3 min | 280 |
| pot_frostward | frostmint + amethyst | +defense 3 min | 300 |
| pot_tide | fish_mooncarp + moonlily | easier fishing for the day | 240 |
| pot_mandrake | mandrake + moonpetal + glowcap | full heal + full energy | 450 |
| pot_shadow | duskberry + bat_wing + ectoplasm | monsters ignore you 45 s | 520 |
| pot_starlight | starbloom + moonpetal + starshard | luck: better drops & gems for the day | 900 |
| pot_moon | wispbloom + starbloom + moonstone | permanently +10 max HP | 2200 |
Wrong combinations make Murky Sludge (sells for 1; Grizelda and Pip love it).

## 9. Monsters (Umbral Depths)
slime (moss / amethyst / void / ember variants), bat (gloom / frost), shroomling (spore-puffing
walking mushroom), spider (cave / crystal) + broodmother (big), skeleton (+ skeleton mage),
golem (crystal), hexmage (rogue wizard: violet / emerald / crimson — keeps distance, casts bolts),
wraith (ghost, drifts through walls), voideye (floating eye), and the boss: **Vesper, the Umbral Archon**.

## 10. Player character
Customisable: name; skin (6 ramps above, excluding witch-green → use pale, fair, tan, brown, deep,
plus "moon-pale" #b9bcd8/#d9dcef/#f2f3fb); hair style (6: messy short, long, braid, bun, curls,
crop); hair colour (8 hair ramps); robe colour (8: indigo, plum, forest, teal, wine, slate, ochre,
midnight); eye colour (5: green, violet, amber, blue, brown). The player wears an apprentice
alchemist's robe with a belt pouch.
