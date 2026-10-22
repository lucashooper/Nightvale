# NIGHTVALE — design addendum 2 (expansion)

Read DESIGN.md first; everything there still holds (palette, tech conventions, ids). This adds:
a walk-in mystical tavern, a clothing shop, a Gothic cathedral landmark, four new villagers, a
clothing system, new drinks/items/relics, forest creatures and explorables, and random encounters
in the spirit of *For the King* (occasional, mysterious, never clutter). The user's bar: everything
should feel more sophisticated, Gothic and magical; **no jarring sounds**.

## 1. New places
- **The Gilded Owl, inside** (`tavern` interior). Sable still owns it and works the room (she sings
  on the little stage in the evening); **Elvis** tends the bar. A mystical tavern: shelves of
  glowing bottles behind a long dark-wood bar, a hearth with violet-green magic fire, a
  chandelier of floating candles, round tables with candles, a big moon window, a small stage.
  Elvis sells drinks (below) and potions.
- **Quillon's Threads & Tomes** (`boutique` interior), a new shop in Hollowmere. A rusty old
  bookshop that sells clothes: tall bookshelves with rolling iron ladders, clothing racks and dress
  forms, a brass till, stacks of books, a long mirror, dust motes, warm orange lamp light against
  purple shadows. Owner **Isolde**.
- **The Cathedral of the Silver Veil** — a Gothic landmark on the north-east edge of Hollowmere.
  Inside (`cathedral` interior): a tall nave, huge stained-glass windows throwing coloured light
  across the floor, long reflecting pools glowing with those colours, pillars and arches, candles,
  a potted tree, and the **Veil Altar**: pray once a day for a blessing (luck for a few hours).
  Keeper: **Seraphine**.
- **Whisperwood, deeper**: forest creatures (mostly at dusk/night and in the deep woods) and
  explorables — hollow logs to search, a ring of standing stones, a ruined watchtower with a sealed
  chest, a wishing well, an abandoned campsite, an Elder Tree, buried-treasure dig sites.

## 2. New villagers (expressions: neutral, happy, sad, surprised, angry; same formats as before)
10. **Elvis Marrowgold** (`elvis`) — bartender at the Gilded Owl. About 40. **Red and white hair**:
    a swept-back crimson quiff with a bold white streak and silvering white temples; **striking
    ice-blue eyes**; neat short red stubble; dark waistcoat with brass buttons over a white shirt,
    sleeves rolled, a black bow tie, a tiny silver star earring. Theatrical, warm, a natural host:
    croons old ballads while he mixes, tells outrageous (mostly true) stories about every drink,
    calls people "stardust". Once a celebrated potion-duelist in the capital who left after a
    scandal he jokes about but never explains; fiercely loyal to Sable, who gave him a home; writes
    love songs he never sings. Voice: pitch 0.8, timbre 'soft' (smooth baritone).
11. **Isolde Quillon** (`isolde`) — owner of Quillon's Threads & Tomes. Mid-50s. Sharp
    silver-lavender bob, cat-eye spectacles on a beaded chain, plum lipstick, high-collared aubergine
    coat with a moth brooch, tape measure around her neck, pincushion bracelet. Sharp-tongued,
    theatrical fashion critic with a soft centre; reads gothic novels; used to make costumes for a
    travelling opera; keeps a crow named Quill on the shop ladder. Comments on your outfit.
    Voice: pitch 1.05, timbre 'bright'.
12. **Seraphine Vell** (`seraphine`) — glassmaker and keeper of the Cathedral of the Silver Veil.
    About 30. Short silver-violet hair, freckles dusted with rainbow glass-glitter that catches the
    light, soft grey eyes, a jeweller's loupe on a chain, a leather apron over a white robe.
    Serene, poetic about light and colour, gently funny, endlessly patient; restores one window pane
    a year; believes the windows remember the Lunar Order's prayers. Voice: pitch 1.15, 'airy'.
13. **Tobias Fennick** (`fennick`) — wandering merchant who turns up somewhere random every few
    days with a laden backpack. 50s, bushy brown beard, monocle, patched feathered hat covered in
    pins, a long striped scarf. A cheerful huckster who talks in sales pitches, mostly honest, loves
    a wager (dice). Voice: pitch 1.1, 'bright'.

Gift tastes:
| npc | love | like | dislike | hate |
|---|---|---|---|---|
| elvis | drink_fizz, pot_starlight, emberroot, relic_star | honey, duskberry, frostmint, food_mead, pearl | glowcap, stone | sludge, bone_dust |
| isolde | relic_locket, moonstone, spider_silk, cl_hat_tophat | feather, amethyst, relic_coin, food_tea, wolfsbane | slime_gel, fish_glimmerfin | sludge, spore_sac |
| seraphine | quartz, amethyst, relic_star, moonlily | moonpetal, starshard, emerald, pearl, food_tea | bat_wing, sludge | void_essence, bone_dust |
| fennick | relic_coin, relic_idol, golden_acorn, bog_amber | pearl, honey, driftwood, food_mead, ore_starsilver | fiber, stone | sludge, ectoplasm |

## 3. Clothing (sold by Isolde; equip by using the item, or at the shop mirror)
Player `look` gains `hat`, `cloak`, `outfit` (each an item id or null). Outfits replace the robe.
| id | slot | name | look |
|---|---|---|---|
| cl_hat_wizard | hat | Starry Wizard Hat | tall indigo pointed hat, gold stars, slightly bent tip |
| cl_hat_witch | hat | Wide-Brim Witch Hat | black-plum, crooked tip, purple band, buckle |
| cl_hat_tricorn | hat | Raven Tricorn | black tricorn with a raven feather |
| cl_hat_beret | hat | Velvet Beret | plum velvet beret with a gold pin |
| cl_hat_hood | hat | Mossweave Hood | deep green cowl hood |
| cl_hat_crown | hat | Flower Crown | violet and white flowers |
| cl_hat_tophat | hat | Moonlit Top Hat | tall black top hat, silver crescent band |
| cl_hat_circlet | hat | Crescent Circlet | thin silver circlet with a moonstone |
| cl_cloak_midnight | cloak | Midnight Cloak | deep blue, tiny white stars, silver clasp |
| cl_cloak_ember | cloak | Ember Cape | crimson to orange, gold clasp |
| cl_cloak_moss | cloak | Moss Mantle | green, ragged leafy hem |
| cl_cloak_raven | cloak | Raven Feather Cloak | black layered feathers, violet sheen |
| cl_cloak_silver | cloak | Silver Veil Mantle | pale silver-lavender, shimmering |
| cl_outfit_scholar | outfit | Scholar's Robes | black robes, violet-and-silver trim and scarf |
| cl_outfit_alchemist | outfit | Alchemist's Coat | brown leather coat, brass buttons, apron |
| cl_outfit_bard | outfit | Bard's Doublet | wine-red doublet with gold trim |
| cl_outfit_duelist | outfit | Duelist's Waistcoat | charcoal waistcoat, white shirt, red sash |
| cl_outfit_moonweave | outfit | Moonweave Robes | pale lavender robes that glimmer |
| cl_outfit_ranger | outfit | Ranger's Garb | forest-green tunic, leather belt and bracers |
Prices: hats 300–900, cloaks 800–1500, outfits 600–1200.

## 4. New items
Drinks (cat food; Elvis's bar):
| id | name | effect | buy |
|---|---|---|---|
| drink_fizz | Stardust Fizz | +20% move speed for 3 minutes, +15 energy (sparkly violet-gold, it fizzes) | 140 |
| drink_moonmilk | Moonmilk Nog | +80 energy | 110 |
| drink_dragon | Dragonbreath Cider | +20 health, stronger attacks for 2 minutes | 160 |
| drink_frostberry | Frostberry Spritz | +40 health, +40 energy | 130 |
| drink_mistwine | Mistwine | luck until the evening | 220 |
| drink_hollow | Hollowroot Stout | take less damage for 2 minutes, +30 energy | 120 |

Relics & curios (found through encounters and exploring; sellable, some are quest items):
treasure_map (Tattered Treasure Map — marks a dig site), old_key (Rusted Skeleton Key — opens the
sealed chest in the watchtower ruin), relic_coin (Ancient Lunar Coin, 300), relic_idol
(Moth-Winged Idol, 450), relic_star (Star Fragment, 800, glows), relic_locket (Silver Locket, 350),
relic_bell (Fairy Bell, 380), relic_feather (Phoenix Feather, 1200), golden_acorn (Golden Acorn, 500).

Forest creature loot: thorn_bramble (Living Bramble, 25), wisp_essence (Wisp Light, 55),
wolf_fang (Moss-Wolf Fang, 40), antler_shard (Spectral Antler, 600).

New potions: pot_wisplight (Wisplight Tonic = wisp_essence + glowcap; your light reaches further in
the Depths for 3 minutes; sells 260), pot_thornhide (Thornhide Draught = thorn_bramble + frostmint;
take less damage for 4 minutes; sells 320).

## 5. Forest creatures (Whisperwood)
thornling (walking bramble knot, slow, spiky), wisp (floating will-o'-the-wisp, glows, flits and
leads you astray), mosswolf (fast moss-backed wolf, hunts in twos at night), bogling (frog-goblin of
the bog, hops and spits), mimic (a treasure chest that bites — appears in encounters), hollowstag
(rare spectral stag with glowing antlers, a mini-boss on full-moon nights in the deep woods).

## 6. Random encounters (one to three per day, scattered across the overworld; each glows faintly)
wandering merchant (Fennick with his pack: four rare items for the day, and dice for anyone brave),
mysterious chest (loot — or a mimic), shrine of chance (offer glimmer, roll for a blessing or a
small curse), fallen star (starshards, rarely a Star Fragment), lost spirit (asks for a specific item
in exchange for a reward), riddle stone (answer a riddle), treasure map (dig at the ✕), wounded
traveller (give a healing potion; a thank-you gift arrives later), wishing well (toss a coin).
Outcomes use *For the King*-style luck rolls shown as a row of coins flipping.

## 7. The forest becomes a biome (three connected maps)
- **Whisperwood** (`woods`, existing, near the village): the friendly edge. Foraging, Elowen, the
  fairy ring, Grizelda's bog. A few creatures at dusk and night (wisps, thornlings, boglings in the bog).
- **The Deepwood** (`deepwood`, new, larger, reached from Whisperwood's west side): it gets spookier
  the further in you go. Outer part: mossy giants, ruins, standing stones, the watchtower ruin.
  Inner part ("the Hollows"): dead and webbed trees, drifting fog, bones, giant webs, glowing eyes in
  the dark. Creatures: **webweaver** (big woodland spider, drops from the canopy and spins webs),
  **gloombeetle** (armoured beetle with a glowing violet carapace, charges), **hornbeetle**
  (bronze rhinoceros beetle, tough, rams), plus thornlings, wisps and moss wolves (in pairs at
  night). At the very heart, on full-moon nights: the **hollowstag**. The Elder Tree landmark.
- **Hushwillow Glade** (`glade`, new, small and peaceful, a hidden pocket reached through a mossy
  tunnel from Whisperwood's east side): soft grass, a pond with lily pads and frogs, willow trees,
  fireflies, flowers, and a few **sleeping animals** — a curled-up **fox**, a **deer** lying in
  the grass, **rabbits**, an **owl** dozing on a branch, a **hedgehog**. You can gently pet them
  (once a day each: a little heart and a small bit of energy back). No monsters ever come here.
Critters (non-hostile): fox, deer, rabbit, owl, hedgehog — each with a sleeping animation (slow
breathing, an ear twitch, a little "z") and an awake idle; the rabbits occasionally hop.

## 8. Food buffs (Stardew-style stat buffs) and new foods
Foods and drinks can grant timed stat buffs (one food buff and one drink buff active at a time; a
new one replaces the old). Stats: **Speed** (+5% move speed each), **Luck** (better drops, finds and
luck rolls), **Farming** (+10% chance of an extra crop at harvest each, cheaper tool use), **Fishing**
(bigger catch bar), **Mining** (extra ore chance, stronger pickaxe), **Attack** (+2 damage each),
**Defense** (−1 damage taken each), **Magnetism** (pick items up from further away).
| id | name | gives | buff (≈4 min) | sold by |
|---|---|---|---|---|
| snack_sweets | Bag of Moonsweets | +20 energy | +1 Speed, +1 Luck | Mirabel, Fennick |
| snack_toffee | Cauldron Toffee | +20 energy | +2 Mining | Mirabel |
| snack_jellies | Jumping Jellies (fizzy jelly creatures that wriggle) | +30 energy | +2 Speed | Fennick, Elvis |
| food_honeycake | Honeymoon Cake | +45 energy, +10 health | +1 Speed, +1 Luck, +1 Farming | Mirabel |
| food_pasty | Pumpkin Pasty | +50 energy | +2 Farming, +1 Defense | Sable |
| food_gazypie | Starry-Gazy Pie (fish heads peeking out at the stars) | +60 energy | +3 Fishing | Sable |
| food_chili | Dragonfire Chili | +40 energy, +20 health | +3 Attack | Sable |
| food_gingerghost | Ghostly Gingerbread | +30 energy | +1 Luck, +2 Magnetism | Fennick |
| food_glowtoast | Glowcap Toast | +40 energy | +1 Luck, +1 Mining | Sable |
| food_moonpudding | Moon Pudding | +60 energy, +15 health | +2 Defense, +1 Luck | Elvis |
| food_spellscroll | Cinnamon Spellscroll (a rolled pastry with glowing icing runes) | +35 energy | +1 Speed, +2 Magnetism | Mirabel |
| food_starbun | Starlight Bun (rare) | +50 energy | +1 Speed, +1 Luck, +1 Farming, +1 Fishing, +1 Mining | Fennick |
The Stardust Fizz drink is +4 Speed (= +20%) for 3 minutes.

## 9. Building styles (chosen: mixed by building, see game/js/art/gothic.js)
Houses and shops: *Hogsmeade Crooked* (leaning timber-and-plaster, indigo fish-scale roofs). The
cathedral and chapels: *Cathedral Gothic* (dark stone, buttresses, gargoyles, stained glass). The
observatory: *Moonstone Gothic*. Grizelda's hut and the Deepwood ruins: *Witchwood Gothic*.

## 10. Familiars
At the **Bonding Stone** in Hushwillow Glade (Elowen explains it the first time) you choose one
familiar, name it, and it follows you everywhere (you can swap later). Pet it daily to grow its bond.
- **Owl** (`fam_owl`): flies after you, perches when you stop. Once a day brings you a forage find;
  in the Depths it hoots when you are near the rock hiding the ladder.
- **Fox** (`fam_fox`): trots at your heels, curls up to nap when you stand still. Sometimes digs up a
  relic or glimmer; in fights it nips enemies.
- **Luna moth** (`fam_moth`): a big pale-green glowing moth fluttering around you. Lights the dark
  (night, Deepwood, Depths) and gives +1 Luck while it's out.

## 11. Full-moon festival: the Lantern Moon
Every full moon, 6pm to midnight, Hollowmere's plaza fills with strings of lanterns, stalls and
music; the villagers gather there. Activities:
1. **Lantern release**: buy a sky lantern (or make one) and release it at the moonwell for a wish
   (a random blessing for tomorrow). At 10pm all the lanterns rise together.
2. **Potion judging**: enter your finest potion; Orvyn and Mirabel judge (prize by rarity and value).
3. **Wisp catching**: catch as many glowing wisps around the plaza as you can in 60 seconds (prizes).
4. **Moonlight dance**: invite a villager you have at least 4 hearts with (big friendship boost).
5. **Grizelda's fortune tent**: a fortune with a real hint about the coming days.
6. **Festival stalls**: festival treats, decorations and rare seeds sold only that night.

## 12. Spellbook (kept simple)
Orvyn gives you a spellbook once you have reached floor 5 of the Depths. **Mana** is a third bar
(max 50) that refills slowly and with Mana Draughts (new recipe: moonpetal + arcane_dust → pot_mana).
Spells (learned from Orvyn's scrolls): **Lumen** (8 mana: a floating light orb follows you for two
minutes), **Verdance** (20 mana: crops within two tiles grow a day, once per tile per day),
**Blink** (10 mana: short teleport forward), **Frostbolt** (6 mana: a frost bolt that slows).
Q casts the selected spell; Tab cycles spells (or click the spell bar).

## 13. Your cottage (walk-in, decoratable)
The keeper's cottage becomes a cosy room you can walk into: bed, hearth, Morwenna's desk, shelves.
Furniture is an item category (`furn_*`), bought from shops or found in the Depths, and placed on a
grid inside the cottage in **decorate mode** (place, pick up). See the furniture list in
game/js/art/furniture.js once it exists.
