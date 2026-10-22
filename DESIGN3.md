# NIGHTVALE — design addendum 3 (the Guild, romance, the Runesmithy, the Menagerie, rare floors)

Read DESIGN.md and DESIGN2.md first; everything there still holds (palette "Twilight Hollow", ids, formats).
The user's bar for this round: **"very polished, clean and fun"**, and the game should feel **dynamic and
full of mysteries**. No jarring sounds. Cute characters people want to romance.

## 1. New villagers (portraits: neutral, happy, sad, surprised, angry + blink/talk; sprites 20x32, anchor 10,31)
Romanceable ones are marked ♥. Each girl gets **two look variants (A and B)** so the user can pick.
1. **Laura Vex** (`laura`) ♥ — ~24, the Guild's sharpest monster hunter. Alt girl.
   A: black hair with a deep-violet split dye in a messy wolf cut with bangs, pale skin, winged eyeliner,
   plum lipstick, silver septum ring + ear cuffs, spiked choker, cropped black leather jacket over a band tee
   (a moon-skull logo), plaid skirt, fishnets, chunky boots.
   B: platinum-and-black "skunk stripe" hair in a sharp bob, grey eyes, dark lips, bat-wing hair clips,
   oversized black hoodie with violet sleeves, chained belt, ripped tights, platform boots.
   Personality: harsh, sarcastic and witty at first ("Don't get eaten, farmer."); hides a soft heart —
   feeds stray cats, writes bad poetry about the moon, gets flustered by kindness. Softer as hearts grow.
   Home: house_a (west of the shop) — a dark, cosy alt bedroom (see §9).
2. **Jasmine Honeywell** (`jasmine`) ♥ — ~22, beekeeper and baker. Soft, shy village girl.
   A: strawberry-blonde wavy hair in two low pigtails with pink ribbons, freckles, rosy cheeks, big hazel eyes,
   pastel pink dress with a cream cardigan, apron with a little bee embroidery, a bee hair clip.
   B: honey-brown curls in a loose bun with a flower, soft brown eyes, lilac puff-sleeve blouse, sage pinafore,
   knitted bear-ear beret, tiny gold bee earrings.
   Personality: shy, stammers a little, apologises a lot, adores teddy bears, honey, baking and flowers;
   grows braver and warmer as you become close. Home: house_c (south-west cottage) — a pastel cutesy
   cottage full of teddy bears (§9). Sells honey treats from a plaza stall on Moondays and Thornsdays.
3. **Amara Starling** (`amara`) ♥ — ~23, star-cartographer and alchemy nerd who apprentices with Orvyn.
   A: warm brown skin, dark curly hair in a big puff bun with a pencil through it, round gold glasses,
   mustard cardigan over a white collar, star-print teal skirt, satchel of books, little star earrings.
   B: dark-brown skin, long box braids with gold cuffs, thick-rimmed violet glasses, cosy teal sweater
   vest with a constellation pin, tartan skirt, an astrolabe on a cord.
   Personality: bubbly, talks fast about comets, runes and potion theory, socially a bit awkward, very
   sweet, fiercely competitive at board games. Home: house_b (the teal turret house) — a nerdy study (§9).
4. **Ronan Ashvale** (`ronan`) ♥ — ~30, the mystical blacksmith of the new **Ashvale Runesmithy** in town.
   Tall, broad, tanned, dark-auburn hair in a short ponytail, short beard, glowing teal rune tattoos on his
   forearms, leather apron over a dark sleeveless shirt, soot smudges, amber eyes. Gruff, few words, dry
   humour, gentle with you once you're friends; obsessed with rare ores and his collection cabinet.
5. **Caspian Drake** (`caspian`) ♥ — ~27, keeper of **Drake's Menagerie & Stables**, a dragon tamer.
   Wind-swept chestnut hair, scar through one eyebrow, aviator cap with goggles pushed up, green flight jacket
   with a fur collar, a tiny baby dragon on his shoulder (in portraits). Charming, cocky, adventurous,
   secretly lonely; dreams of flying past the mountains.
6. **Gideon Grimm** (`gideon`) — ~60, the Guildmaster of the **Silver Crescent Guild**. Not romanceable.
   Grizzled, eyepatch, white braided beard, scars, heavy fur-trimmed coat with the guild emblem (crossed
   blades over a crescent), a pipe. Stern, fair, dry humour, war stories.

Gift tastes (love / like / dislike / hate):
| npc | love | like | dislike | hate |
|---|---|---|---|---|
| laura | bat_wing, void_essence, wolf_fang, drink_dragon, cl_cloak_raven | spider_silk, emberroot, duskberry, relic_coin, food_chili, ectoplasm | moonlily, food_honeycake, snack_sweets, cl_hat_crown | food_tea, sludge |
| jasmine | honey, food_honeycake, moonlily, snack_sweets, starbloom | moonpetal, feather, food_pie, food_tea, fairycap, cl_hat_crown | bat_wing, slime_gel, bone_dust | spider_silk, void_essence |
| amara | starshard, relic_star, quartz, pot_starlight, min_comet_glass | moonstone, arcane_dust, food_tea, food_coffee, feather, amethyst | slime_gel, stone, fiber | sludge, spore_sac |
| ronan | ore_starsilver, voidcrystal, golem_core, food_stew, min_meteorite | ore_shadow, emerald, amethyst, food_coffee, drink_hollow | moonlily, honey, cl_hat_crown | sludge, snack_jellies |
| caspian | relic_feather, wisp_essence, golden_acorn, drink_fizz | pet_treat, honey, food_chili, feather, pearl | bone_dust, stone | sludge, spider_silk |
| gideon | food_stew, drink_hollow, wolf_fang, antler_shard | food_mead, ore_shadow, bone_dust, golem_core | moonlily, snack_sweets | sludge, fairycap |

## 2. Romance (Stardew-style)
Hearts 0–10 (100 points each). For romanceable villagers hearts cap at **8** until you give a
**Moonflower Bouquet** (`bouquet`, sold by Jasmine and Mirabel once you have 8 hearts with anyone) — then
you are **dating** and can reach 10. Heart scenes at 2, 4, 6, 8 (and 10 when dating). At 10 hearts while dating,
give a **Moonstone Pendant** (`pendant`, sold by Ronan) to become **partners**: they move into your cottage —
they're there in the evenings and mornings, greet you, and sometimes leave a small gift or water a few crops.

## 3. The Silver Crescent Guild — bounties and contracts (Witcher-style)
A Guild hall in Hollowmere's new **south quarter**. Gideon runs it; Laura hunts for it. A **contract board**
(parchment notices with a sketch of the target, a difficulty of 1–5 skulls, the reward and where to look)
offers 4–6 contracts that **refresh every 3 days**. Accept up to 3 at a time; turn in to Gideon for coin and
**guild rank** (Copper → Silver → Gold → Moonsteel; higher ranks unlock harder contracts and rank rewards).
Kinds:
- **Hunt**: slay N of a creature (slimes in the Depths, thornlings, mosswolves at night, webweavers, bats...).
- **Gather**: bring N of something (spider silk, wisp light, amethysts, healing draughts, frostmint...).
- **Bounty** (unique monsters, they only appear while their contract is active):
  - **Gloopgarr the Slime Ogre** (2–3 skulls) in Whisperwood's bog: a huge ogre-shaped slime with a crude
    club and a dented crown. Slow, stomps (shockwave ring). Each time it's struck below 80/60/40/20% health,
    **little slimes break off** — faster than him. When he dies he **splits into 3 medium slimes**, and each of
    those splits into **2 small fast slimes**, like Minecraft slimes.
  - **Old Grimjaw** (3 skulls): a scarred alpha moss-wolf, twice the size, hunting the Deepwood at night with
    two wolves; howls and charges.
  - **The Lantern Thief** (2 skulls): a wisp king stealing the dock lanterns at Glimmermere after midnight;
    blinks around, leaves decoy wisps.
  - **Vorrakh, the Deep Wyrm** (5 skulls) on **floor 20** of the Umbral Depths: a crystal-scaled cave wyrm in
    its own lair. Burrows and resurfaces under you (a dust ring warns you), sprays crystal shards, roars.
- **Rewards**: 200–6,000 ✦, guild rank points, sometimes items (blueprints, geodes, trophies for the cottage).

## 4. The Ashvale Runesmithy — ores, geodes and the Collection Cabinet
Ronan's forge in the south quarter. He **buys ores, gems, minerals and relics**, sells a few tools/materials,
and **cracks geodes** (25–150 ✦): a geode shakes, cracks and bursts open on his anvil.
Geodes come from breaking rocks in the Depths (more often deeper) and from bounties:
`geode_moon` (any floor), `geode_ember` (floor 10+), `geode_void` (floor 25+), `geode_star` (rare, anywhere).
Each holds ores/gems or one of **24 collectible minerals** (6 per geode):
- Moon: `min_lunarite`, `min_moonglass`, `min_silvervein`, `min_moth_fossil`, `min_tidestone`, `min_crescent_agate`
- Ember: `min_emberstone`, `min_phoenix_tear`, `min_lava_opal`, `min_salamander_fossil`, `min_cinnabar`, `min_smokequartz`
- Void: `min_void_eye`, `min_obsidian`, `min_nightglass`, `min_ammonite`, `min_wraith_opal`, `min_hollow_heart`
- Star: `min_starheart`, `min_comet_glass`, `min_meteorite`, `min_celestite`, `min_aurora`, `min_wishing_stone`
The **Collection Cabinet** in the Runesmithy shows every slot (a silhouette until you donate one). Milestones:
3 → 300 ✦; 6 → **Lucky Rune** (+1 Luck forever); 10 → **Geode Hammer** (crack geodes yourself);
14 → **Mineral Cabinet** furniture; 18 → **Crystal Fox** pet; 24 (all) → **Starforged Blade** (best sword)
and the title "Runesmith's Friend".

## 5. Drake's Menagerie & Stables — pets and mounts
Caspian's shop with a fenced paddock in the south quarter.
- **Mounts** (press **R** outdoors to call / ride; R again to dismount):
  - **Horse** (5,000 ✦; coats: midnight, silver dapple, chestnut): gallops at 1.7× speed.
  - **Dragon** (18,000 ✦, Silver guild rank; colours: amethyst, emerald, ember): **flies** at 2.3× speed over
    trees, water and rooftops at a good height (a big shadow below, the view pulls back a little), lands where
    there's room. Not indoors or in the Depths.
  - Upgrades: **Saddle of Swiftness** (+15%), **Starlit Saddle** (+30%), **Dragon Harness** (flies higher and
    faster), **Silver Whistle** (call your mount from anywhere outdoors).
- **Pets** (collectibles; one can follow you, the rest live at your cottage and garden, pet them daily):
  `pet_kitten` (moon kitten), `pet_puppy` (shadow pup), `pet_bunny` (lop bunny), `pet_hatchling` (baby dragon),
  `pet_crystalfox` (Collection reward only). Items: `pet_treat`, `pet_toy`, `pet_bed` (furniture).

## 6. Rare floors in the Umbral Depths (about 1 floor in 10; never gate or boss floors)
Each announces itself ("You've found: The Forgotten Library") and hides something:
- **The Forgotten Library**: towering shelves, floating books, glittering motes, **ink bats** (fast, papery),
  a reading desk with lore, and a **blueprint pedestal**.
- **The Witch's Hollow**: an abandoned giant cauldron (stir once for a random brew), shelves of jars to search,
  a broom, drying herbs, the witch's diary page, bog toads.
- **The Sunken Observatory**: a brass orrery (spin it to reveal the way down), a great telescope, star charts
  on the floor, starshard nodes, a blueprint.
- **The Crystal Garden**: crystal flowers you can harvest for gems, luminous fungi, a fairy fountain that heals.

## 7. Blueprints & crafting (new "Crafting" tab in the satchel)
Blueprints come from rare floors and some contracts; each teaches a recipe:
`bp_sprinkler` Dew Sprinkler (waters the 8 tiles around it each morning) · `bp_warp` Warp Rune (teleport home)
· `bp_charm` Lucky Charm (+2 Luck for the day) · `bp_lamp` Moonlit Lamp (furniture) · `bp_hammer` Geode
Hammer · `bp_scarecrow` Moon-Scarecrow (crops grow a little faster nearby) · `bp_saddle` Saddle of Swiftness
· `bp_trophy` Bounty Trophy Case (furniture showing your slain bounties).

## 8. Quality-of-life
- **Handbook** tab in the satchel: how everything works (farming with a crop table, brewing, buffs, making
  money, shops and who buys what, the Guild, geodes, pets and mounts, magic, familiars, romance, controls).
- Crops: clear feedback — darker watered soil, a droplet over thirsty crops while holding the can, a hint line
  with days left, a morning note when crops went thirsty. A proper **watering pour** animation.
- **Admin (tester) mode** in Settings: no need to sleep, infinite energy, invincible, freeze time, teleport,
  set time, give items/gold.
- Cleaner shop menus (no character mirror; a tidy list with a details pane). A friendlier title font (user picks).
- World map: larger, readable place descriptions.

## 9. Homes with personality (walk-in; locked at night unless you have 4+ hearts)
- **Laura's room** (house_a): deep violet walls with posters (a moon-skull band poster), fairy lights, a record
  player and vinyl crate, black lace curtains, candles, a bat-plush on a dark quilt, skateboard, plants in
  skull pots, a guitar, a dressing table with spiked jewellery.
- **Jasmine's cottage** (house_c): pastel pink and cream, a quilt bed covered in teddy bears (one huge bear),
  bunting, a honey shelf with jars, a little baking corner with cupcakes, flower vases, a bee-shaped rug, a tea set.
- **Amara's study** (house_b): teal and gold, towering book stacks, a chalkboard with equations and runes,
  an orrery, a brass telescope at the window, star charts pinned up, a cosy beanbag, potted ferns, a cat bed,
  an alchemy desk with bubbling flasks.
- **The Runesmithy**: a glowing forge, anvils, rune-etched quench trough, weapon racks, ore crates, and the
  **Collection Cabinet** (24 slots) along the wall.
- **The Menagerie**: pet beds, perches, hay bales, saddles on the wall, an egg incubator with a glowing dragon
  egg, a little aquarium, a feed counter; outside, a fenced paddock with a horse and a dragon perch.
- **The Guild hall**: the contract board, trophy heads (a wolf, a stag skull, a slime in a jar), banners with the
  guild crest, long feast tables, a map table, weapon racks, a roaring fireplace, Gideon's desk.
