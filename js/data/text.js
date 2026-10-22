// Nightvale — narrative text: dialogue, flavour, tooltips, requests, altar, lore, ending.
// Defines exactly one global: window.GAMETEXT. Pure data, no functions.
// Pages are <= 150 chars. Optional portrait tag at page start: [happy] [sad] [surprised] [angry] [neutral].
// Placeholders: {player}, {item}, {cat} (= Inkwell).
(function () {
  'use strict';
  var T = {};

  // ---------------------------------------------------------------- opening sequence
  T.intro = [
    "The coach rattles over the last hill at dusk. Below, Nightvale glows like a lantern someone set down and forgot. The moon hangs low. Far too low.",
    "In your pocket is a letter you've read a hundred times on the road. The envelope smells of lavender, ink, and something faintly singed.",
    "'My dear {player}. If you're reading this, I've gone beyond the Veil. You haven't visited in years. I've forgiven you for half of them.'",
    "'I've left you the Sanctum. Yes, the ruin. Yes, the roof. It leaks in exactly three places, and I've named all three. You'll get on.'",
    "'The garden has gone to sleep and the Moon Altar has gone dim. I was too old and too stubborn to fix it. You're only one of those things.'",
    "'Feed Inkwell. Breakfast, supper, and whenever that look comes out. The look will come out. It always comes out.'",
    "'The moon remembers what we forget. Wake the garden, and the garden will wake the valley. I always believed in you. Don't make me haunt you. M.'",
    "Hollowmere's lamps flicker on as the coach rolls in. West of the village, behind crumbling walls, an old temple waits. A black cat watches the road."
  ];

  T.npcs = {};

  // ================================================================ MIRABEL
  T.npcs.mirabel = {
    name: 'Mirabel Thornwick', short: 'Mirabel', title: 'Seedkeeper of Hollowmere',
    bio: "Runs Thornwick's Seeds & Sundries, feeds anyone who stands still, and was Morwenna's oldest friend and fiercest mandrake rival.",
    intro: [
      "[surprised] Oh! Oh, look at you. {player}! You've grown! Well, you were grown before, but you've grown more. Around the eyes.",
      "[happy] Mirabel Thornwick, dearie. Seeds and Sundries. I knew Morwenna longer than anyone alive, and I'm not about to let you starve.",
      "[sad] She talked about you constantly, you know. 'My apprentice this, my apprentice that.' Never once wrote to you, the stubborn old stick.",
      "[happy] Now. You'll be wanting seeds. Moonpetals to start, they're forgiving. Come by the shop and I'll set you up. And EAT something."
    ],
    talk: [
      { text: "[happy] Morning, noon or midnight, dearie, the answer is always the same: water it first and fret about it after." },
      { text: "Soil's like a grudge, petal. Turn it over often or it sets hard." },
      { text: "[happy] You've got Morwenna's hands, you know. Green to the knuckle. She'd never admit she taught you well, so I'll say it for her." },
      { text: "Have you eaten? Don't answer, I can see you haven't. Come by the shop and I'll find you a heel of Lavender Loaf." },
      { text: "Moonpetals sulk if you plant them too close together. Give them a hand's width and a kind word. They're like Pip, really." },
      { text: "[surprised] Oh! You startled me, petal. I was miles away. Thinking about mulch. One does, at my age." },
      { text: "Mandrakes scream when you pull them, dearie. Just scream back. It confuses them and they come up easier." },
      { text: "[sad] The Sanctum garden used to glow so bright you could read by it. Morwenna and I did, once. Terrible novels, mostly." },
      { text: "If a seed won't sprout, it isn't being stubborn. It's waiting. There's a difference. Took me fifty years to learn it." },
      { text: "[happy] The lavender in my bun is for luck. And the smell. And because I lost my last hairpin in the compost and I'm not going in after it." },
      { text: "Weeds are only flowers nobody asked for. Pull them anyway, mind. Nobody asked for them." },
      { text: "Don't you go overwatering, petal. Roots need to want something, same as people." },
      { text: "I hear everything in this shop. Not because I listen, mind. People just talk louder near the seed bins." },
      { text: "[happy] A full belly and clean fingernails, that's my advice for life. You can skip the fingernails if you garden." },
      { text: "[sad] I still set out two teacups some mornings. Old habits. Morwenna took hers with three sugars and a complaint." },
      { text: "[happy] Up with the larks! Good. Seeds don't buy themselves, and I don't sell them before my second cup of tea.", when: { time: 'morning', loc: 'village' } },
      { text: "Afternoons are for deadheading and gossip, dearie. I've already done the deadheading.", when: { time: 'afternoon' } },
      { text: "Shop's shut, but my kettle isn't. Never is. Pip says it's a fire hazard. Pip IS a fire hazard.", when: { time: 'evening' } },
      { text: "[surprised] Getting dark, dearie! Home and to bed with you. Plants grow in the dark, and so do the bags under your eyes.", when: { time: 'evening', loc: 'village' } },
      { text: "[happy] Rain! Free water and an excuse to sit down. The two best gifts the sky ever gives.", when: { weather: 'rain' } },
      { text: "Mist like this brings the slugs out in parades. Salt round your seedlings, dearie, and give them a stern look.", when: { weather: 'mist' } },
      { text: "[surprised] Stars falling like seeds! Morwenna used to say every starshard was the moon dropping a stitch.", when: { weather: 'starfall' } },
      { text: "[happy] Full moon tonight! Everything grows faster, including the gossip. I've heard three new rumours already. One's about you.", when: { moon: 'full' } },
      { text: "[sad] New moon. The Ridge looks hungry on nights like this. You stay out of those Depths tonight, d'you hear me?", when: { moon: 'new' } },
      { text: "Pip wants to be your apprentice. Do say yes, dearie. If he's blowing up your cauldron, he isn't blowing up mine." },
      { text: "[angry] Pip came home with no eyebrows again. AGAIN. I've half a mind to knit him spares." },
      { text: "Sable keeps the tavern warm and the secrets warmer. Never tell her anything you don't want sung back to you in a minor key." },
      { text: "[happy] Brann eats my stew on the forge steps every Thornsday and pretends he doesn't. I pretend I don't see him wipe the bowl clean." },
      { text: "Orvyn taught Morwenna her letters and her stars. Now he can't find his own hat. It's on his head, dearie. It's always on his head." },
      { text: "That Grizelda. Mud on her boots and vinegar on her tongue. She and Morwenna fought for sixty years. Best friends I ever saw." },
      { text: "[sad] Corvin's been so quiet since his sister went into the Depths. I leave a pie on the Lodge step. He hates pie. It's always gone by morning." },
      { text: "Elowen came in for seeds last week and apologised to every packet. Lovely girl. My cabbages have never been happier." },
      { text: "[happy] Captain Lune told me the eyepatch was from a duel with a mermaid. Last week it was a sea serpent. Next week, a very angry duck." },
      { text: "[happy] You're becoming a regular, petal. I've started saving you the good seeds. Don't tell the others. They'll want the good seeds too.", when: { minHearts: 3 } },
      { text: "[sad] Morwenna and I planted our first gardens at twelve. Hers glowed. Mine got eaten by a goat. I've been jealous for sixty years.", when: { minHearts: 5 } },
      { text: "I worried about you before you came, dearie. Thought the city might've made you hard. It didn't. You just needed some soil.", when: { minHearts: 7 } },
      { text: "[happy] When I'm gone, don't let Pip sell the shop. Or blow it up. The second's more likely. Keep an eye on him for me, petal.", when: { minHearts: 9 } },
      { text: "[surprised] Your first potion! Morwenna's first one turned her hair green for a fortnight. Yours seems... fine. Lucky thing.", when: { flag: 'firstBrew' } },
      { text: "[angry] Pip tells me you've been down past the tenth floor of those Depths. Wear a scarf. Monsters can't bite what's well wrapped.", when: { flag: 'depths10' } },
      { text: "[happy] Is it my imagination, or is the Sanctum glowing again at night? I saw it from my window and cried into my cocoa a bit.", when: { flag: 'altar1' } },
      { text: "The whole valley feels lighter, dearie. Even my knees. I don't know exactly what you did up there, but keep doing it.", when: { flag: 'altar5' } },
      { text: "[happy] You did it! The moon's bright as a new coin. Morwenna would pretend she knew you'd manage. I'll pretend I didn't cry.", when: { flag: 'archonDefeated' } },
      { text: "Met everyone now, have you? Good. Now you know who's who, I can tell you who's who to whom. Pull up a stool, dearie.", when: { flag: 'metAll' } },
      { text: "Isolde says my shawl is 'a crime against wool.' Well, it's MY crime, and it's warm. She can measure me all she likes." },
      { text: "[happy] That Elvis at the Owl calls me 'stardust.' At my age! I pretended to be cross. I was not cross." },
      { text: "Seraphine buys my moonpetals to grind for her blue glass. She says they make the palest blue in the world. Of course they do, dearie." },
      { text: "[happy] Try my Honeymoon Cake, dearie. Honey, lavender and a secret. The secret is more honey." },
      { text: "A bag of Moonsweets, petal? Pip's favourite. I hide them on the top shelf. He's learned to climb." },
      { text: "[happy] Lantern Moon tonight, dearie! Orvyn and I are judging the potions. I'm told I'm 'too kind.' I'm told that every year.", when: { moon: 'full', time: 'evening' } },
      { text: "[happy] Jasmine bakes for my shop now. Her crusts are nearly as good as mine, dearie. Nearly. Don't tell her I said nearly." }
    ],
    repeat: [
      "Still here, petal? Shoo, the garden's waiting.",
      "[happy] Twice in one day! People will talk. I'll make sure of it.",
      "Go on, dearie. The sun won't wait, and neither will the weeds.",
      "Did you eat? You didn't. I can always tell.",
      "[happy] I'd chat all day, but these seed packets won't count themselves."
    ],
    gift: {
      love: [
        "[happy] {item}! Oh, dearie, you shouldn't have. You absolutely should have. Come here, let me pinch your cheek.",
        "[surprised] Is that {item}? For me? Oh, I'm all aflutter. I haven't been this pleased since I beat Morwenna at cards. Once.",
        "[happy] You remembered I love {item}! Morwenna never remembered anything I liked. Except to beat me at the mandrake show.",
        "[happy] Well, aren't you a treasure. {item}, and the good kind too. I'll be telling everyone. Everyone."
      ],
      like: [
        "[happy] {item}! How thoughtful, petal. That'll come in handy.",
        "Oh, {item}. Lovely. I know exactly where that goes.",
        "[happy] Thank you, dearie. {item} is always welcome in this house."
      ],
      neutral: [
        "{item}? Well. It's the thought that counts, and you did think. A bit.",
        "Oh, thank you, dearie. I'll find a use for {item}. Somewhere. Eventually.",
        "{item}. Hm! I'll put it on the shelf with the other mysteries."
      ],
      dislike: [
        "[sad] Oh. {item}. That's the sort of thing Pip leaves in my teapot.",
        "{item}? I'll take it, petal, but I'll be holding it at arm's length.",
        "[sad] Goodness. {item}. I'll put it somewhere the customers can't see it."
      ],
      hate: [
        "[angry] {item}! In my shop! Take that outside before it curdles the seed packets!",
        "[angry] {item}? Oh, that's foul. Have you been taking gift advice from Grizelda?"
      ]
    },
    giftDone: [
      "You've already spoiled me today, dearie. Save something for tomorrow.",
      "[happy] One gift a day, petal, or I'll start getting ideas about my own importance."
    ],
    hearts: {
      2: {
        pages: [
          "[surprised] {player}, you look like a scarecrow that's been rained on. Sit. No, SIT. There. I'll put the kettle on.",
          "[happy] Lavender Loaf, fresh this morning. Morwenna used to steal the crusts off mine and swear blind it was mice.",
          "[sad] Big mice. With spectacles and a sweet tooth. I do miss those mice.",
          "[happy] Take the rest home. No arguments! Nobody ever woke a garden on an empty stomach."
        ],
        reward: { item: 'food_bread', qty: 3 }
      },
      4: {
        pages: [
          "[happy] Come here, dearie, I've something to show you. Mind the seed trays. Mind the cat. That's not a cat, that's a hat. Mind it anyway.",
          "This is a moonpetal Morwenna and I pressed at sixteen. The same day we both got our hearts broken by the same travelling tinker.",
          "[happy] We buried his love letters in her garden. Best compost we ever made. This flower grew right out of that bed. Glowed for a month.",
          "[sad] Silly, keeping it all these years. But it's the only thing from that garden still here. Besides me. And I'm hardly a flower.",
          "[happy] Here, have some of my special mulch. Same recipe. Minus the love letters."
        ],
        reward: { item: 'moonmulch', qty: 5 }
      },
      6: {
        pages: [
          "[angry] Twenty-three years, {player}. Twenty-three years I lost the Hollowmere Mandrake Show to that woman.",
          "One year she put a little knitted hat on hers. A HAT. The judges wept. I called it showboating. Then I knitted a hat for mine.",
          "[sad] It bit the judge. I lost again. Morwenna laughed so hard she had to lie down in the onion bed.",
          "[happy] I knew her restorative recipe all along. She made me swear on my trowel never to share it. Well. She isn't here to scold me.",
          "[happy] Mandrake, moonpetal and glowcap. Brew it for the Depths. And enter the show this year, dearie. Bring a hat."
        ],
        reward: { recipe: 'pot_mandrake' }
      },
      8: {
        pages: [
          "[sad] Sit with me a moment, dearie. I'm worried about Pip. He's all fizz and sparks, and the Ridge gets darker every month.",
          "His parents are off cataloguing ferns in the southern isles, bless them. So it's me and him, and I'm not as quick as I was.",
          "[happy] But he's calmer since you came. He wants to be like you. Careful, clever, kind. Slightly singed. We can't have everything.",
          "[happy] Take these Dew Crystals. Morwenna gave them to me years ago. Never used them. I like watering. It's when I do my best thinking."
        ],
        reward: { item: 'dewcrystal', qty: 2 }
      },
      10: {
        pages: [
          "[happy] {player}, close your eyes. Hold out your hands. Gently! It's glass.",
          "A jar of seeds. See the label? Half my writing, half Morwenna's. 'Phialvine. Attempt Forty.' We tried for years. It never took.",
          "[sad] We said we'd try once more when we were old. Then we were old, and she was tired, and I was busy, and...",
          "[happy] But the garden's awake now. Your garden. If anyone can make these grow, you can. Tell me the very moment they fruit.",
          "[happy] And dearie? Call me Gran, if you like. Pip won't mind sharing. He's been telling everyone you're his cousin anyway."
        ],
        reward: { item: 'seed_phialvine', qty: 5 }
      }
    },
    shop: {
      greet: [
        "[happy] Welcome to Thornwick's! Seeds on the left, sundries on the right, gossip at the counter.",
        "Come in, come in! Fresh packets today. The moonpetals are practically humming.",
        "[happy] There's my favourite customer. Don't tell Brann. He thinks it's him, and he only ever buys twine."
      ],
      bye: [
        "Plant them pointy end up, dearie! Or is it down? You'll work it out.",
        "[happy] Come back soon. And EAT something!"
      ]
    }
  };

  // ================================================================ PIP
  T.npcs.pip = {
    name: 'Pip Fizzlewick', short: 'Pip', title: 'Apprentice Alchemist (Self-Declared)',
    bio: "Mirabel's twelve-year-old grandson: goggles, soot, a hundred questions a minute, and a burning wish to be your apprentice.",
    intro: [
      "[surprised] YOU'RE HERE! You're the apprentice! Morwenna's apprentice! From the CITY! Is it big? Do the buildings explode? Mine do!",
      "[happy] I'm Pip! Pip Fizzlewick! Apprentice alchemist! Self-taught! Self-declared! Self-singed, a bit. Gran says I need a teacher.",
      "And YOU need an apprentice! Obviously! I can carry things! I can count to ten thousand! I've only exploded seven things this month!",
      "[happy] Don't answer now! Think about it! Think about it really hard! I'll be over here! Waiting! Scientifically!"
    ],
    talk: [
      { text: "[happy] Did you know glowcap and slime gel fizzes AND glows AND smells like feet? I know because I did it. Twice. For science." },
      { text: "[surprised] Is it true city alchemists have cauldrons that don't explode? How? What's the trick? Is it less fire? I bet it's less fire." },
      { text: "[happy] When I'm your apprentice I'll sweep the floors and label the jars and only explode things on Sundays! Just Sundays! Mostly!" },
      { text: "Question! Why do mandrakes have faces? Do they have brains? If you plant two together, do they talk? Can I try? Can I? Please?" },
      { text: "[happy] I'm writing a book! Pip's Big Book of Experiments! Chapter one is 'Things That Exploded.' It's the longest chapter. By a lot." },
      { text: "Gran says I have 'more questions than sense.' Is that bad? How much sense do YOU have? Can sense be brewed? I'd buy loads." },
      { text: "[happy] I found a beetle that glows green when you sing at it! Or maybe it glows anyway! I need a control beetle! For SCIENCE!" },
      { text: "[surprised] Your robe has a belt pouch! Real apprentices have pouches! What's in it? Ingredients? A frog? I hope it's a frog." },
      { text: "[sad] I tried to brew a potion to make me taller. Now my HAT is taller. Just the hat. Nobody knows how. Not even me." },
      { text: "[happy] My goggles are called Gerald. Gerald has saved my eyes eleven times! Gerald is my best friend who is goggles. You're the other one." },
      { text: "[angry] Corvin won't let me into the Depths! He says I'm 'too short to be a ghost yet.' What does that even MEAN? Actually, don't tell me." },
      { text: "Can {cat} talk? Does {cat} know spells? I asked and {cat} looked at me exactly like Gran does when I've been sooty." },
      { text: "[surprised] Wait, wait, wait. A failed potion is sludge. So what if you mix TWO sludges? Double sludge? Super sludge? ANTI-sludge?!" },
      { text: "[happy] I counted all the stars last night! There are... a lot. I fell asleep at four thousand and twelve. Orvyn says it's a good start." },
      { text: "[happy] I wasn't peeking over your wall! I was OBSERVING. From a respectful distance. On a ladder.", when: { loc: 'sanctum' } },
      { text: "Afternoon! I brought you a present! It's a rock! It might be a meteorite! It might just be a rock! Let's find out together!", when: { loc: 'sanctum', time: 'afternoon' } },
      { text: "[surprised] Shh! The Captain says fish come if you're quiet. I've been quiet for ELEVEN WHOLE MINUTES. Hardest experiment I've ever done!", when: { loc: 'lake' } },
      { text: "I'm meant to be sorting seed packets for Gran, but I sorted them by how they'd sound if they exploded and now she's cross.", when: { loc: 'village', time: 'afternoon' } },
      { text: "[happy] Morning! I've been up since five! I made toast! It's a little bit on fire, but that's just extra crunch!", when: { loc: 'village', time: 'morning' } },
      { text: "[sad] Gran says I have to be home by dark because of the Ridge monsters. I'm not scared. I'm just going home early. Bravely.", when: { time: 'evening' } },
      { text: "[angry] Gran won't let me out in the rain. She says I'll rust. I'm not METAL, Gran! ...Am I? I should test that.", when: { weather: 'rain', loc: 'village' } },
      { text: "[happy] Rain is just the sky doing an experiment on us! I put buckets out to measure it. Gran says the buckets were her good pots.", when: { weather: 'rain' } },
      { text: "In the mist I pretend I'm a ghost and jump out at Corvin. He never jumps. He just says 'Good evening, Pip.' It's SO annoying.", when: { weather: 'mist' } },
      { text: "[surprised] STARFALL! If I put a starshard under my pillow will I dream in constellations? I'm going to find out the scientific way!", when: { weather: 'starfall' } },
      { text: "[happy] Full moon! I measured Gran's mandrakes and they grew AND swore at me! Two results! Great day for science!", when: { moon: 'full' } },
      { text: "[sad] New moon's the scary one. Corvin says the Depths get grumpy. Can a cave have feelings? I'd be nice to it. Just in case.", when: { moon: 'new' } },
      { text: "[happy] Gran knows EVERYTHING about plants! She grew a cabbage so big we lived in it for a week! She says that's not true. I remember it." },
      { text: "Brann says I'm 'a spark with legs.' I think it's a compliment! He let me work the bellows once! Once. There was an incident." },
      { text: "[happy] Orvyn showed me a comet! He forgot what it was called halfway through, so I named it Pip. It's Pip now. Officially. Sort of." },
      { text: "Sable gives me cider if I tell her a secret. I told her Gran snores like a rusty bellows. She already knew. She knows EVERYTHING." },
      { text: "[surprised] Grizelda gave me a jar of bog water and said 'Don't drink it.' So I didn't! I'm not a fool! I tested it. It GLOWS." },
      { text: "Elowen taught me to whistle like a nightjar! Now birds follow me everywhere. Some of them seem quite cross about it." },
      { text: "Captain Lune says there's a fish in the lake as big as a boat! I'm going to catch it with SCIENCE. And a really big worm." },
      { text: "[sad] Corvin's sister went into the Depths and never came back. He doesn't talk about it. I make him nearly laugh, though. Nearly." },
      { text: "[sad] Morwenna let me stir her cauldron once. I added a pinecone. She said 'Bold choice.' Then it exploded and she laughed and laughed." },
      { text: "[happy] Have you thought about it? The apprentice thing? You don't have to say yes. You could say YES! Or YESSS! All valid answers!", when: { minHearts: 3 } },
      { text: "I keep a list of everything you teach me. It's very long. Some of it's just 'don't touch that.' But that's important too!", when: { minHearts: 5 } },
      { text: "[sad] Some kids say I'm too much. Too loud. Too many questions. You never say that. Thanks. That's all. Bye! I mean, hi!", when: { minHearts: 7 } },
      { text: "[happy] When I grow up I want to be a real alchemist. Exactly like you. Except with more explosions. A few. Tasteful ones.", when: { minHearts: 9 } },
      { text: "[surprised] You BREWED something?! And it didn't explode?! Teach me! Teach me now! Teach me yesterday! Can you learn yesterday?!", when: { flag: 'firstBrew' } },
      { text: "[happy] You reached a Rune Gate!! Does it hum? Does it bite? Did you lick it? I'd lick it. For science. I wouldn't actually. Maybe.", when: { flag: 'depths5' } },
      { text: "You've been to the Webbed Catacombs! Bring me spider silk! Lots! I'm building a rope ladder to the moon. Don't tell Gran.", when: { flag: 'depths25' } },
      { text: "[happy] I saw the Sanctum glowing from the bridge! Everybody says it's you! I said it first, though! Write that down!", when: { flag: 'altar3' } },
      { text: "[happy] YOU BEAT THE ARCHON! I told everyone you would! Eleven times! Can I write a book about it? Chapter one: Me. Chapter two: You!", when: { flag: 'archonDefeated' } },
      { text: "You've met everyone in Nightvale! I made a chart of who likes who. It's very complicated. There's string involved. Lots of string.", when: { flag: 'metAll' } },
      { text: "[happy] Elvis made me a Stardust Fizzlewick! Lemonade and glitter! He says a real Fizz would make me 'too fast for the laws of nature'!" },
      { text: "[surprised] Seraphine has rainbow glitter on her freckles! Is it science? It's science. I'm going to grind up a window. Kidding! Mostly!" },
      { text: "Fennick let me roll his dice and I won THREE TIMES and he looked at me like I was a wizard! I'm not a wizard. Yet." },
      { text: "[surprised] LANTERN MOON! I'm entering the potion judging! Mine's purple! It hums! Gran says it's 'technically a soup'!", when: { moon: 'full', time: 'evening' } },
      { text: "[surprised] Caspian has a REAL DRAGON! Her name's Pebble! She bit Gerald! My goggles have DRAGON TOOTH MARKS! Best day ever!" }
    ],
    repeat: [
      "[happy] Hi again! Hi! Did you miss me? It's been minutes!",
      "Are you back because you've decided? About the apprentice thing? No? Okay! Tomorrow!",
      "[surprised] Oh! You again! Best surprise today! Second best. Something exploded earlier.",
      "I'd talk more but I've got a jar of something bubbling and I'm not sure what it's going to do!",
      "[happy] Two visits! I'm writing this down! Notable event!"
    ],
    gift: {
      love: [
        "[surprised] {item}!!! FOR ME?! This is the best day of my whole life! I'm going to do SO MANY experiments with this!",
        "[happy] Oh WOW. {item}! Gran's going to be so worried! I mean proud! I mean worried! THANK YOU!",
        "[happy] {item}! You know me SO well! I'm labelling it 'Gift from my Teacher.' Not officially teacher. Yet.",
        "[surprised] Is this real {item}?! Can I keep it?! I'm keeping it! It's going in the special box! The one that doesn't explode!"
      ],
      like: [
        "[happy] {item}! Ooh! I can use this! Probably! Somehow! Thanks!",
        "Neat! {item} goes straight in my collection. Right next to the mystery jar.",
        "[happy] Thanks! {item} is EXCELLENT experiment material!"
      ],
      neutral: [
        "Oh. {item}. Okay! I'll think of something to do with it. Maybe set it on fire? Kidding! Mostly!",
        "{item}? Hmm. Not very explodey. But thanks!",
        "Thanks! I'll study it. {item} might surprise me. Things usually do."
      ],
      dislike: [
        "[sad] {item}? That's... Gran stuff. It's fine. It's really fine. It's a bit boring.",
        "[angry] Bleh! {item}! That's what Gran gives me when I've been 'excitable'!",
        "[sad] Oh. {item}. Do I have to keep it? I'm keeping it. Politely. Far away."
      ],
      hate: [
        "[angry] Ew ew EW! {item}! Get it away! It's the worst thing I've ever smelled, and I LIKE the smell of sludge!",
        "[angry] {item}?! That's not science, that's just mean!"
      ]
    },
    giftDone: [
      "[happy] You already gave me something today! Any more and I'll explode! From happiness! Not actually!",
      "One present a day is the rule! I made the rule! Just now! To protect your purse!"
    ],
    hearts: {
      2: {
        pages: [
          "[happy] {player}! Come see! Come see come see come see! This is my laboratory! It's a crate. Behind Gran's shop. It's a VERY GOOD crate.",
          "This is my notebook. 'Experiments, Volume Nine.' Volumes one to eight exploded. Not the experiments. The books. Long story.",
          "[happy] And THIS is Sludge Number Forty-Seven. My finest failure. It hums a little when you're sad. I want you to have it.",
          "[surprised] Grizelda says sludge is 'a fine vintage.' Maybe she'll trade you something for it! Or it'll just hum at you. Both good!"
        ],
        reward: { item: 'sludge', qty: 1 }
      },
      4: {
        pages: [
          "[surprised] {player}! Don't look at my face! Okay, you can look. But don't look where my eyebrows used to be.",
          "It was a VERY SMALL explosion. Medium. Medium-small. The cauldron's fine! The cauldron's on the roof, but it's fine!",
          "[sad] If Gran finds out I'll be sorting seed packets for a month. Can you help me get it down? Please? I'll give you my glowcap spores!",
          "[happy] ...Thanks for not telling. And for not laughing. Much. You laughed a bit. It's fine. It WAS funny."
        ],
        reward: { item: 'seed_glowcap', qty: 5 }
      },
      6: {
        pages: [
          "[sad] Can I ask a real question? Not a science one. Does it hurt? When somebody's gone? Like Morwenna?",
          "She gave me this spoon. All black with soot. She said 'For when you're ready, Fizzlewick. Not before.' I don't know when ready is.",
          "[happy] ...Okay. I feel better. Hey! I found a real recipe by accident! Emberroot and slime gel! It went BOOM and then it was a POTION!",
          "[happy] I want you to have it. You're ready. I'm... nearly ready. I'll keep the spoon a bit longer."
        ],
        reward: { recipe: 'pot_ember' }
      },
      8: {
        pages: [
          "[surprised] {player}! I made an exam! An Apprentice Exam! You have to be the examiner! I've been studying for WEEKS!",
          "Question one! What do two moonpetals make? A Healing Draught! Question two! What do you NEVER add? A pinecone! I wrote my own answers!",
          "[happy] Now the practical! I brewed three Vigor Tonics in case two exploded! NONE exploded! Not one! Do I pass?! Do I?!",
          "[surprised] I PASS?! I'm a REAL APPRENTICE?! GRAN! I'm telling Gran! Keep the tonics! They're my apprentice fee! Is that how it works?!"
        ],
        reward: { item: 'pot_vigor', qty: 3 }
      },
      10: {
        pages: [
          "[happy] Teacher? Can I call you Teacher? I've been practising. Teacher. Teacher! Okay, it's weird. {player}. I made you something.",
          "It's the last page of my notebook. 'Experiment One: Friendship. Hypothesis: might work. Result: worked. Did not explode.'",
          "[sad] I started it the day you moved in. I just didn't write the result till now. You have to be sure, in science.",
          "[happy] And this is my golem core. It's my best thing in the whole world. That's why it's yours. Don't argue. Apprentices are stubborn too."
        ],
        reward: { item: 'golem_core', qty: 1 }
      }
    }
  };

  // ================================================================ SABLE
  T.npcs.sable = {
    name: 'Sable Nightingale', short: 'Sable', title: 'Keeper of the Gilded Owl',
    bio: "A retired travelling bard who runs The Gilded Owl, knows every secret in Hollowmere, and keeps most of them.",
    intro: [
      "[happy] Well, well. The famous apprentice. Come in, darling, let me look at you. Hm. Taller than the rumours. Kinder around the eyes.",
      "Sable Nightingale. I own The Gilded Owl and sing on its little stage. Elvis pours the drinks. I keep the secrets. Only the good ones get sung.",
      "[sad] Morwenna sat right there every Emberday. If you ever want her seat, darling, it's yours. It's been cold long enough."
    ],
    talk: [
      { text: "[happy] Darling, everyone in this valley has a secret. Most are boring. The interesting ones I keep in a little box behind my smile." },
      { text: "I sang in forty-two towns before I came here. Thirty-eight asked for an encore. Four asked me to leave. Those were the best nights." },
      { text: "[happy] A good tavern is like a good song, darling. Warm, a little sad, and it ends with someone happier than they came in." },
      { text: "You have that look, darling. The 'I'm fine' look. I invented that look. I could teach you a much better one." },
      { text: "Every stranger walks in with a story. Elvis pours, I listen, and between us it comes out. It isn't magic, darling. Mostly patience." },
      { text: "Gossip is a currency, darling, and I'm very, very rich. Lucky for this valley, I'm also generous with my silence." },
      { text: "[happy] If you ever want a song about you, darling, do something foolish and brave. Foolish is easy. Brave costs extra." },
      { text: "I keep a lute by the stage for emergencies. A brawl stops very quickly once someone starts singing about their mother." },
      { text: "[happy] Never trust a bard who says 'This one's a true story.' I say it every night. Draw your own conclusions." },
      { text: "The owl above the bar is gilded oak, not gold. Don't tell anyone, darling. The legend is much better for business." },
      { text: "[sad] Some nights after closing, the room's so quiet I can hear every song ever sung in it. Then I sweep." },
      { text: "You're new, darling, and new is delicious. Everyone will want to know everything. Tell them nothing. Let them guess. It's kinder." },
      { text: "[happy] I've heard three versions of how you came to Nightvale. In one, you rode in on a stag. I'm keeping that one." },
      { text: "There's a corner booth that's always empty. Don't sit in it, darling. Not because it's cursed. Because it wobbles." },
      { text: "A bard learns two things: how to read a room, and when to leave it. I seem to have forgotten the second. This valley does that." },
      { text: "Morning, darling. I come down to the dock to buy fish, and to watch a certain captain pretend not to see me. My favourite show.", when: { loc: 'lake', time: 'morning' } },
      { text: "[happy] Starday at the dock. The Captain always saves me the best mooncarp, and always calls it 'just leftovers.' Every single week.", when: { loc: 'lake', day: 'Starday' } },
      { text: "[surprised] You're up early. Before noon, darling, I'm mostly rumour and coffee. Mostly coffee.", when: { time: 'morning', loc: 'tavern' } },
      { text: "Afternoons are slow. Elvis croons to the glasses, and I think about the places I never went. Then the ones I did, and stop.", when: { time: 'afternoon', loc: 'tavern' } },
      { text: "[happy] Evening, darling! Sit, sit. I'm on stage in five minutes, Elvis is crooning, and Brann's already grumbling at Orvyn.", when: { time: 'evening', loc: 'tavern' } },
      { text: "The late crowd's my favourite. Truths come out after midnight. So does the Captain's singing, sadly.", when: { time: 'night' } },
      { text: "[happy] Rain's good for business, darling. Everyone comes in to dry off and stays for the stories.", when: { weather: 'rain' } },
      { text: "Mist always makes me want to write ballads. Sad ones, with ghosts. Corvin's the only one who ever requests them.", when: { weather: 'mist' } },
      { text: "[surprised] A starfall! I used to wish on these. Then I got the things I wished for, and learned to be more careful.", when: { weather: 'starfall' } },
      { text: "[happy] Full moon, darling. The Captain will be in tonight telling the kraken story. Again. Bring a cushion.", when: { moon: 'full' } },
      { text: "On new moon nights the delvers drink quieter. I leave a lamp in the window for anyone coming back late from the Ridge.", when: { moon: 'new' } },
      { text: "Captain Lune and I adventured together, once upon a time. Swords, sea-wyrms, terrible inns. I tell it better than Lune does." },
      { text: "[happy] Lune's eyepatch has a new story every week. I know the real one. No, darling, I'm not telling. Some songs aren't mine to sing." },
      { text: "Brann and Orvyn have argued about 'real work' at my bar every night for twenty years. I think it's how they say they love each other." },
      { text: "[sad] Corvin sits by the window, orders black coffee, and doesn't drink it. He's waiting. I never tell him to stop." },
      { text: "[happy] Mirabel brings me pies and asks after everyone's business. I give her tea and a crumb of truth. We're both satisfied." },
      { text: "Grizelda came in once and ordered a bowl of hot water. Added something from her pocket. Drank it. I've never dared ask what it was." },
      { text: "[sad] Morwenna came in every Emberday for one glass of mead and to beat me at cards. Twenty years. I never won. Not once." },
      { text: "Elowen comes in when it storms, sits by the hearth, and talks to the fire. The fire seems to like her. So do I." },
      { text: "Pip trades me secrets for cider. Last week: his grandmother snores like a rusty bellows. I already knew, darling. Everyone knows." },
      { text: "[happy] You're becoming a regular, darling. Regulars get the good mugs. The ones without chips. I own four.", when: { minHearts: 3 } },
      { text: "I was a bard for twenty years. The hardest song is the one you sing when nobody's listening. That's why I stopped.", when: { minHearts: 5 } },
      { text: "[sad] I keep a stool polished at the end of the bar. Nobody sits there. I polish it anyway. Don't ask, darling. You'll make me honest.", when: { minHearts: 7 } },
      { text: "[happy] I used to think home was a thing you sang about. Then I bought this place. Then you came along and made it louder. Thank you.", when: { minHearts: 9 } },
      { text: "[happy] I hear you've brewed your first potion. Put one on my shelf, darling. 'Bottled by the new keeper.' People will pay double.", when: { flag: 'firstBrew' } },
      { text: "The delvers say you're past the Amethyst Grotto. I've written your first verse. It rhymes 'cavern' with 'tavern.' Forgive me.", when: { flag: 'depths10' } },
      { text: "[sad] The Abyssal Rift. Lune and I turned back at that edge, once. The only time I've ever seen the Captain go quiet.", when: { flag: 'depths40' } },
      { text: "[happy] The Sanctum glows again at night. Mirabel cried into her stew. Brann claimed it was soot in his eye. I wrote a song.", when: { flag: 'altar1' } },
      { text: "[happy] The moon's brighter than I've ever seen it, darling. Half the songs I know are out of date. I'll have to write new ones.", when: { flag: 'archonDefeated' } },
      { text: "You've met everyone now. Good. Next you'll notice who sits where, and who never sits together. That's where the stories are.", when: { flag: 'metAll' } },
      { text: "[happy] Elvis washed up on my doorstep in the rain, years ago. One boot, a broken heart, a voice like warm honey. Best thing that ever washed in." },
      { text: "Isolde says my bodice is from twelve years ago. It is. I take that as a compliment to the bodice." },
      { text: "[happy] Starry-Gazy Pie tonight, darling. The fish heads peek out at the stars. Lune insists they're just admiring the view." },
      { text: "[happy] Lantern Moon, darling! I sing at ten, when the lanterns go up. Elvis harmonises. Badly. Gloriously.", when: { moon: 'full', time: 'evening' } },
      { text: "Gideon tells the Siege of Thornwall at my bar every Emberday. The troll gets bigger each time. So does the spoon." }
    ],
    repeat: [
      "[happy] Back so soon, darling? People will think we're conspiring.",
      "Twice in a day. I'm flattered. Or suspicious. Possibly both.",
      "[happy] Looking for a new story? Come back tomorrow, darling. I'm still writing today's.",
      "Go on, darling. The night's not getting any younger. Neither am I."
    ],
    gift: {
      love: [
        "[surprised] {item}? Oh, darling. You've been listening. Nobody listens. It's the most romantic thing a person can do.",
        "[happy] {item}! I'll have to write you a verse. A whole song, perhaps. With a key change.",
        "[happy] For me? {item}? Darling, you've made an old bard very happy. Don't tell anyone. It ruins the mystique.",
        "[happy] {item}. Exquisite taste. I'd expect nothing less from someone I like this much."
      ],
      like: [
        "[happy] {item}! How lovely. You do know the way to a bard's heart.",
        "Ooh, {item}. I'll put it somewhere special. Somewhere people will ask about.",
        "[happy] Thank you, darling. {item} suits me, don't you think?"
      ],
      neutral: [
        "{item}. Hm. Every gift's a story, darling. This one's a short story.",
        "Thank you, darling. I'll find a place for {item}. Behind the bar, probably.",
        "{item}? Charming. In its way."
      ],
      dislike: [
        "{item}. Darling. I'm going to pretend this was a joke, and laugh, and we'll never speak of it again.",
        "[sad] Oh. {item}. Well. It's the thought that counts, and I'm counting very carefully.",
        "{item}? I'll put it in the cellar. With the other things I've chosen to forget."
      ],
      hate: [
        "[angry] {item}?! Darling, I run a tavern, not a bog. Take it outside before the customers smell it.",
        "[angry] No. Absolutely not. {item} is a crime against taste, and I've sung for pirates."
      ]
    },
    giftDone: [
      "[happy] One gift a day, darling. Any more and people will write songs about us. I'd hate to be scooped.",
      "You've spoiled me enough for one day. Come back tomorrow and spoil me again."
    ],
    hearts: {
      2: {
        pages: [
          "[happy] Come here, darling. Closer. See the gilded owl above the bar? Press its left wing. Gently.",
          "[surprised] A little drawer! Villagers leave notes in it. Confessions, apologies, love letters too shy to send. I never read the names.",
          "I just... nudge things. A word here, a song there. Three weddings and one very happy goat so far. Don't ask about the goat.",
          "[happy] Now you know my secret, which makes you dangerous. Have a mead on the house. Dangerous people should be kept sweet."
        ],
        reward: { item: 'food_mead', qty: 1 }
      },
      4: {
        pages: [
          "[happy] A little bard's wisdom, darling. When an audience turns on you, you need two things: good shoes and a better potion.",
          "Swiftstep Brew. Duskberry and spider silk. I escaped six angry towns and one very angry duke on that recipe.",
          "[happy] Take it. Use it in the Depths. If anyone asks, you learned it from a very respectable tavern keeper."
        ],
        reward: { recipe: 'pot_swift' }
      },
      6: {
        pages: [
          "[sad] It's Morwenna's night. Every Emberday I still pour her a glass and set it at her seat. At closing, I drink it myself.",
          "She'd come in grumbling about her knees and 'that wretched cat,' then beat everyone at cards and leave smiling.",
          "[happy] Sit in her seat tonight, darling. Go on. It's been empty long enough. She'd want someone there who'd argue with the dealer.",
          "[happy] And take some stew home. Extra pepper. Her usual. You look like you could use a little Morwenna in you."
        ],
        reward: { item: 'food_stew', qty: 2 }
      },
      8: {
        pages: [
          "[sad] You've noticed the stool at the end of the bar. Of course you have. You notice everything now. I've been a bad influence.",
          "It's Lune's. I had the name carved when I built this place. We were going to settle down. Lune wanted one more voyage.",
          "[sad] Lune came back two years later. Saw the stool. Sat at the other end of the bar. Has sat there ever since. Twenty years, darling.",
          "[happy] Here. A moon pearl. Lune gave it to me the night we met. Keep it for me? In case I'm ever tempted to throw it in the lake."
        ],
        reward: { item: 'pearl', qty: 1 }
      },
      10: {
        pages: [
          "[happy] Quiet a moment, darling. I've written something. About you. Don't make that face. Everyone's heard it already except you.",
          "'Came a keeper from the city, with soil beneath their nails, and woke a sleeping moon...' It goes on. There's a key change. Brann cried.",
          "[sad] I stopped writing songs when I stopped wandering. I thought I'd run out of things to say. You gave me something new to sing.",
          "[happy] Take this. My last Starlight Philter from the road. A bard trades luck like coin, darling. I have all the luck I need now."
        ],
        reward: { item: 'pot_starlight', qty: 1 }
      }
    },
    shop: {
      greet: [
        "[happy] Welcome to The Gilded Owl, darling. Hot food, warm fire, cold stares from Corvin in the corner. All included.",
        "What'll I get you? The stew's hearty, the pie's sinful, Elvis has the drinks, and the gossip's on the house.",
        "[happy] Ah, my favourite customer. Tonight. You're my favourite tonight. Ask me again tomorrow."
      ],
      bye: [
        "[happy] Mind the step, darling. And the Captain. Both trip people up.",
        "Come back soon. The fire's always lit, and the door's always open."
      ]
    }
  };

  // ================================================================ BRANN
  T.npcs.brann = {
    name: 'Brann Ironroot', short: 'Brann', title: 'Smith of the Starfall Forge',
    bio: "The Ridge's gruff blacksmith and enchanter: few words, strong opinions on 'real work', and a shelf of secret wooden animals.",
    intro: [
      "You're the apprentice. Brann. Ironroot. Smith.",
      "Bring me ore, I'll make your tools better. Bring me nonsense, I'll make you leave.",
      "[sad] ...Sorry about Morwenna. Good woman. Stubborn. Paid in pie. ...That's all."
    ],
    talk: [
      { text: "Hm. Tools sharp? Good. A dull tool's worse than none. Lies to you." },
      { text: "Iron's honest. Hit it right, it listens. Hit it wrong, it tells you. Loudly." },
      { text: "Need something fixed? Bring it. Need something talked about? Bring Mirabel." },
      { text: "[happy] Good day. Forge is hot. Coffee's terrible. Life's fine." },
      { text: "Don't touch the anvil. Not cursed. Just hot. Same thing, really." },
      { text: "Starsilver. Best ore there is. Light as a promise. Harder to keep." },
      { text: "You talk a lot. That's fine. Someone has to." },
      { text: "Wood's for handles. Stone's for walls. Ore's for blades. Everything has a job." },
      { text: "[angry] Somebody left a mandrake on my anvil. Screamed all morning. Know who? Small. Ginger. Goggles." },
      { text: "The scar? Old. Don't ask. ...You'll ask later. Everyone does." },
      { text: "[happy] Mirabel's stew. Best thing in the valley. Don't tell her. She'll get ideas." },
      { text: "Forge was my father's. His father's before that. Before that, a goat shed. Still smells like one when it rains." },
      { text: "Picks break. Hands heal. Tempers don't. Mind yours." },
      { text: "Don't swing a sword like a broom. Swing it like you mean it. Then stop meaning it." },
      { text: "[sad] Morwenna paid for her cauldron in pies. Forty years. Never once in coin. Never minded." },
      { text: "Morning. Forge takes an hour to wake up. So do I.", when: { loc: 'ridge', time: 'morning' } },
      { text: "Busy. Talk while I hammer. I can hear fine. Mostly.", when: { loc: 'ridge', time: 'afternoon' } },
      { text: "Banking the coals. Come back tomorrow. Bring ore.", when: { loc: 'ridge', time: 'evening' } },
      { text: "[happy] Off the clock. One mead. One bowl of stew. One argument with Orvyn. Then bed.", when: { loc: 'village', time: 'evening' } },
      { text: "Late. Should be home. Sable won't let me leave till I finish my mug. It's a conspiracy.", when: { loc: 'village', time: 'night' } },
      { text: "Rain. Good for crops. Bad for bellows. Everything's a trade.", when: { weather: 'rain' } },
      { text: "[angry] Mist off the Ridge. Can't see the anvil. Hit my thumb twice. Third time, I'm going home.", when: { weather: 'mist' } },
      { text: "[surprised] Starfall. Bring me any shards you find. Starsilver sings with a shard in it.", when: { weather: 'starfall' } },
      { text: "Full moon. Metal's brighter tonight. Don't know why. Don't need to.", when: { moon: 'full' } },
      { text: "[sad] New moon. Depths get mean. Check your gear twice. Then once more.", when: { moon: 'new' } },
      { text: "Still here? Most folk leave after the second grunt. I've got more.", when: { maxHearts: 1 } },
      { text: "[angry] Orvyn. Stares at stars all night. Calls it work. Real work leaves blisters." },
      { text: "Orvyn says a smith 'lacks poetry.' I say a poet lacks a roof. I fixed his roof. He's welcome." },
      { text: "Mirabel feeds me every Thornsday. I eat on the forge steps. She watches from the path. Thinks I don't see." },
      { text: "Pip. Good arm. Bad aim. Worse luck. He'll be fine. Someone's watching him. Several someones." },
      { text: "Corvin buys blades, sells them to delvers. Never smiles. Good man. Sad man. Same thing, sometimes." },
      { text: "Lune tells tales. I fix Lune's hooks. Fair trade. Hooks are real." },
      { text: "Grizelda wanted a cauldron with a face. I made it. Didn't ask why. Didn't want to know." },
      { text: "Elowen doesn't like my mining. Says the mountain feels it. I say sorry to the rock now. Don't laugh." },
      { text: "Sable's lute needs new pegs. Has for ten years. Won't let me touch it. Says it's 'tuned to memory.' Hm." },
      { text: "You're alright. Don't make it weird.", when: { minHearts: 3 } },
      { text: "[happy] Carved a bird yesterday. Was meant to be a fish. Bird's better. Happens.", when: { minHearts: 5 } },
      { text: "[sad] Had a brother. Went to the city. Writes once a year. Short letters. Runs in the family.", when: { minHearts: 7 } },
      { text: "[happy] You come up the Ridge, forge feels warmer. Not the coals. Something else. That's all I'm saying.", when: { minHearts: 9 } },
      { text: "Heard you brewed something. Good. Potions break. Swords don't. Carry both.", when: { flag: 'firstBrew' } },
      { text: "First Rune Gate. Good. Show me your pick. ...Hm. You'll want an upgrade soon.", when: { flag: 'depths5' } },
      { text: "[angry] Catacombs. Don't bring me spider silk. Hate the stuff. Sticks to everything. Sticks to the beard.", when: { flag: 'depths25' } },
      { text: "[surprised] The Rift. Few come back from there. You did. Sit. Let me look at that blade.", when: { flag: 'depths40' } },
      { text: "Sanctum's lighting up. See it from the Ridge at night. Like a forge across the valley. Good work.", when: { flag: 'altar3' } },
      { text: "[happy] Archon's gone. Moon's back. Knew you'd do it. Didn't say so. Saying it now.", when: { flag: 'archonDefeated' } },
      { text: "Elvis. Every drink comes with a speech. I want a mug. I get a mug. Get the speech anyway. ...Good speeches." },
      { text: "Isolde measured me for a waistcoat. Didn't ask. Says it'll be 'waiting.' Let it wait." },
      { text: "Fennick tried to sell me a hammer. My hammer. Lost it last week. Paid him anyway. Fair's fair." },
      { text: "Lantern Moon. Plaza full of paper and fire. I've got a bucket ready. Nobody thanks the man with the bucket.", when: { moon: 'full', time: 'evening' } },
      { text: "New smith in town. Ronan. Runes on everything. Iron doesn't need decorating. ...Good balance on his blades, though. Hm." }
    ],
    repeat: [
      "Still here?",
      "Talked already. Forge is waiting.",
      "Hm. You again. Fine.",
      "Busy. Tomorrow.",
      "[happy] Twice. Must like the smell of soot."
    ],
    gift: {
      love: [
        "[surprised] {item}. ...For me? Hm. ...Thank you. Really.",
        "[happy] {item}! Good. Very good. Best thing anyone's given me in years. Don't spread that around.",
        "[happy] Now that's a gift. {item}. You know your way around a smith."
      ],
      like: [
        "{item}. Useful. Thanks.",
        "[happy] Hm. {item}. Good choice.",
        "That'll do. {item}'s always welcome at the forge."
      ],
      neutral: [
        "{item}. ...Alright.",
        "Hm. {item}. I'll find a use. Maybe.",
        "Thanks. I think. {item}."
      ],
      dislike: [
        "{item}. Can't hammer that.",
        "{item}? At a forge? It'll wilt in a minute. Like me at a party.",
        "[sad] {item}. ...Hm. Give it to Orvyn. He likes pretty things."
      ],
      hate: [
        "[angry] {item}. No. Out. Take it out.",
        "[angry] Is this a joke? {item}? Not funny."
      ]
    },
    giftDone: [
      "Already got something today. One's enough.",
      "Keep it. Tomorrow."
    ],
    hearts: {
      2: {
        pages: [
          "Give me that. Your tool. ...Hm. Edge is a disgrace.",
          "Sit. Five minutes. ...There. Sharp enough to split a hair. Don't split hairs.",
          "[happy] Take this ore too. Had extra. Didn't want it rusting. ...Stop smiling."
        ],
        reward: { item: 'ore_glimmer', qty: 5 }
      },
      4: {
        pages: [
          "Hot work, smithing. Forge-folk drink a philter for it. Frostmint and amethyst. Keeps the heat off your skin.",
          "Works on monster claws too. Found that out the hard way. Don't find out the hard way.",
          "[happy] Here. Wrote it down. Spelling's bad. Recipe's good."
        ],
        reward: { recipe: 'pot_frostward' }
      },
      6: {
        pages: [
          "Hold out your hand. ...Not like that. Palm up.",
          "[surprised] It's a cat. Wooden. Saw yours sitting on the Sanctum wall. Had some wood. Had some time.",
          "[happy] ...Looks like {cat}? Hm. Thought so too. The ears were hard. Don't make it a thing.",
          "And take this shadowiron. You're going deeper. I want you coming back up."
        ],
        reward: { item: 'ore_shadow', qty: 5 }
      },
      8: {
        pages: [
          "[sad] The scar. You've been wanting to ask. ...Thirty years back. Observatory caught fire. Orvyn's star-lens experiment.",
          "Old fool wouldn't leave without his star charts. So I carried him. And the charts. Ninety-nine steps. He complained the whole way.",
          "[angry] Ceiling came down on the last step. Got this. He got a cough. Charts got singed. He still says I 'bent the corners.'",
          "[happy] We don't talk about it. We argue instead. Works fine. ...Here. Amethyst from the slag. Pretty. Useless to me."
        ],
        reward: { item: 'amethyst', qty: 3 }
      },
      10: {
        pages: [
          "[happy] Come in. Look. On the shelf. ...Yes. All of them.",
          "Mirabel. Pip. Sable. That one's Orvyn, with the hat. Corvin's the raven. Lune's the walrus. Don't tell Lune.",
          "[sad] Started them for Morwenna. She talked me out of leaving this valley, forty years back. Said the forge needed a stubborn heart.",
          "[happy] This one's new. It's you. ...Took me months. And this starsilver. For whatever's next. Hit it hard. Come home."
        ],
        reward: { item: 'ore_starsilver', qty: 5 }
      }
    },
    shop: {
      greet: [
        "Forge is open. Need an upgrade? Bring ore. Bring glimmer.",
        "What needs fixing?",
        "[happy] Good timing. Coals are just right."
      ],
      bye: [
        "Don't break it.",
        "Come back when it's dull."
      ]
    }
  };

  // ================================================================ ORVYN
  T.npcs.orvyn = {
    name: 'Orvyn Starcloak', short: 'Orvyn', title: 'Astronomer of the Observatory',
    bio: "An ancient, absent-minded star-wizard who once taught Morwenna, and who remembers the Lunar Order better than his own breakfast.",
    intro: [
      "[surprised] Ah! A visitor. Do mind the star charts. And the other star charts. And that teacup. It's an experiment. Or tea.",
      "[happy] Orvyn Starcloak, at your... yes. You're Morwenna's apprentice. You have her frown. She had it from me, I'm afraid.",
      "[sad] So she's gone beyond the Veil. I watched her star dim from up here. It flickered twice, as if to say 'don't fuss.'",
      "The moon is ailing, {player}. Something in the deep feeds on its fallen light. Wake the altar. I'll help where I can. When I remember."
    ],
    talk: [
      { text: ["Ah, {player}. You arrive like a comet. Unexpected, briefly dazzling, and leaving an old man to wonder what...", "[surprised] ...what was I saying? Never mind. It'll come back around. Comets do."] },
      { text: "[happy] What has a face but no mouth, waxes but never polishes, and is always falling but never lands? The moon, dear. Or a very sad hat." },
      { text: "Stars are only fires that are very far away and very patient. Be patient, dear, and you'll burn a long time too." },
      { text: "I once spent a decade charting a single star. Then I realised it was a smudge on the lens. A lovely decade, all the same." },
      { text: "The moon is closer this year. Three hairs closer, by my reckoning. I measure with my beard. It's very precise. Mostly." },
      { text: "[happy] Every night the sky tells a story. Every morning I forget the ending. It keeps things fresh." },
      { text: "Where was I? Ah, yes. The Lunar Order believed light could be planted like a seed. They were right, as it happens. Mostly right." },
      { text: "[surprised] Have you seen my spectacles? ...Ah. On my nose. They're always hiding on my nose. Cunning things." },
      { text: ["When you look at a star, you see light it sent long ago. People are like that too. We go on seeing their light after they...", "[sad] ...after they've gone beyond the Veil. Yes. That was the end of that one. I'd rather it ended differently."] },
      { text: "A riddle. The more you take, the more you leave behind. Footsteps, dear. Or teacake crumbs, if you're a messy eater." },
      { text: "Constellations are the sky's way of keeping its friends close. I've named twelve. Forgotten nine. The other three I'm fond of." },
      { text: "[happy] Tea? I have a pot somewhere. Brewing since Thornsday. Or was it the Thornsday before?" },
      { text: "The Archon is... no, no. Not today. Today is a day for gentle things. Ask me under a darker moon." },
      { text: "[sad] Morwenna was my finest pupil. And my worst. She argued with every star chart I ever drew. She was usually right. Usually." },
      { text: "[surprised] Morning already? The night went by like a shooting star. I'm not certain I was in it.", when: { loc: 'ridge', time: 'morning' } },
      { text: "Afternoons are for napping and pretending to read. I am very accomplished at both.", when: { loc: 'ridge', time: 'afternoon' } },
      { text: "[happy] Dusk. The first star's out. That's Lanthe, the Lamplighter. She's always early. Like you.", when: { loc: 'ridge', time: 'evening' } },
      { text: "[happy] Up on the balcony the sky is close enough to touch. Hold out your hand. There. You've touched it. Don't tell the stars.", when: { loc: 'ridge', time: 'night' } },
      { text: "[sad] Morwenna and I took tea in this garden every Emberday afternoon. I seem to have kept the habit. You don't mind, do you, dear?", when: { loc: 'sanctum' } },
      { text: "Night is when I'm most awake, dear. Like owls. And insomniac bakers. And you, apparently.", when: { time: 'night' } },
      { text: "[sad] Clouds. A whole night of stars, hidden behind wet wool. I'll have to remember where they are. If I can.", when: { weather: 'rain' } },
      { text: "Mist is the sky come down to visit. Be polite to it, dear. Mist remembers rudeness.", when: { weather: 'mist' } },
      { text: "[surprised] A starfall! Make a wish, dear. Make three. The sky has far more stars than it needs.", when: { weather: 'starfall' } },
      { text: "Full moon. The Moonroot drinks deep tonight. Can you feel it underfoot? Like a slow, enormous heartbeat.", when: { moon: 'full' } },
      { text: "[sad] New moon. The Archon stirs when the moon looks away. Keep a lantern lit, dear. Keep two.", when: { moon: 'new' } },
      { text: "[angry] Brann thinks stargazing isn't 'real work.' I should like to see him hammer a constellation into shape." },
      { text: "Brann fixed my roof last month. I thanked him. He said 'Hm.' A whole sermon, from Brann." },
      { text: "[happy] Young Pip asks me forty questions a night. I answer every one. Some of them correctly." },
      { text: "Mirabel brings me soup and reminds me to eat it. I would remember on my own, eventually. By then it would be cold." },
      { text: "[sad] Corvin's sister, Wren, climbed up here before she went down. She asked about the Archon. I told her too much. Or not enough." },
      { text: "[happy] Sable once sang beneath my balcony. A ballad about a lonely astronomer. The stars applauded. Or perhaps it was hail." },
      { text: "Grizelda calls me 'Old Lanternface.' I call her 'Madam Mire.' We've exchanged birthday cards for fifty years. Insulting ones." },
      { text: "Elowen once asked me whether the stars were lonely. I said no. I'm not certain I was telling the truth." },
      { text: "The Captain navigates by the stars. Badly. I've drawn Lune three charts. All three ended up wrapping fish." },
      { text: "[happy] You remind me of someone. A stubborn young woman with soot on her nose. Ah. Yes. Morwenna. You stand just as she did.", when: { minHearts: 3 } },
      { text: "The Order recorded every keeper of the Sanctum. One hundred and nine names. Morwenna was the last. Until you, dear.", when: { minHearts: 5 } },
      { text: "[sad] I forget things now. Names. Days. Whether I've eaten. But not you, dear. I've written you into the stars. In ink.", when: { minHearts: 7 } },
      { text: "[happy] When I go beyond the Veil, I shall become a small, grumpy star. Look for me on clear nights. I'll be the one blinking at you.", when: { minHearts: 9 } },
      { text: "[happy] Your first brew! Every first potion is a little star being born. Even if it smells of boiled boots.", when: { flag: 'firstBrew' } },
      { text: "The Amethyst Grotto. Its crystals remember the Starfall. Listen closely and they hum it. A very old song. A very sad one.", when: { flag: 'depths10' } },
      { text: "The Catacombs. The Order buried its keepers there, near the fallen light. I hope they rest... comfortably.", when: { flag: 'depths25' } },
      { text: "[sad] The Abyssal Rift. You're close now, dear. The Archon will know your name. See that it learns to fear it.", when: { flag: 'depths40' } },
      { text: "[happy] The altar stirs! I saw it through my telescope. A little moon down in the valley. The first in years.", when: { flag: 'altar1' } },
      { text: "All five offerings. The seal is whole, and the Archon's door stands open. Something behind it is waiting. Be brave. Be quick.", when: { flag: 'altar5' } },
      { text: "[happy] The moon is brighter than I've seen it in two hundred years. ...Did I say two hundred? I meant... a very long time.", when: { flag: 'archonDefeated' } },
      { text: "Seraphine believes the cathedral windows remember the Order's prayers. I believe she's right. Light is the most patient listener there is." },
      { text: "[happy] Isolde calls my hat 'magnificent, and a fire hazard.' I've had it sixty years. It's only caught fire twice." },
      { text: "That Fennick sold me a chart of a sky that doesn't exist. Or doesn't exist yet. I'm keeping it, just in case." },
      { text: "[happy] The Lantern Moon! Tonight I judge potions with Mirabel. She judges kindly. I judge by starlight. Bring me something that shines.", when: { moon: 'full', time: 'evening' } },
      { text: "[happy] Amara is the brightest apprentice I've had since Morwenna. She talks faster than light. I'm only a little behind." }
    ],
    repeat: [
      "Hm? Oh, we've spoken already. Or have we? Time is a river, dear, and I'm a leaky boat.",
      "[happy] Back again? Like a comet. Lovely. Exhausting.",
      "I was just thinking about... no, it's gone. Come back tomorrow. It may return.",
      "The stars aren't going anywhere, dear. Neither am I. Well. Eventually.",
      "[happy] Ah, a returning star. Good evening. Or morning. Which is it?"
    ],
    gift: {
      love: [
        "[surprised] {item}! Oh, my. You've brought me a little piece of the sky. I shall put it by the window, where the stars can see it.",
        "[happy] {item}. Why, this is the finest gift I've received in... a long while. I'd say how long, but I've happily forgotten.",
        "[happy] Oh, {item}! Morwenna gave me one of these, once. You've brought the memory back with it. Thank you, dear."
      ],
      like: [
        "[happy] {item}. How thoughtful. Like a well-placed star.",
        "Ah, {item}. Most useful to an old astronomer. Thank you.",
        "[happy] {item}! I shall study it at once. After my nap."
      ],
      neutral: [
        "{item}? How interesting. I'm sure it has a purpose somewhere. Like a moon with no planet.",
        "Thank you, dear. {item}. I'll put it somewhere. And forget where. It's tradition.",
        "Ah. {item}. Mm. Yes. Quite."
      ],
      dislike: [
        "{item}. Hm. That's the sort of thing that crawls out of the Depths, dear. Or grumbles in a pot.",
        "[sad] Oh. {item}. I'll take it. Some gifts are like clouds. They pass.",
        "{item}? I'm afraid that doesn't sing to me, dear. Not even a hum."
      ],
      hate: [
        "[angry] {item}! An insult to the heavens. Take it away before the stars see.",
        "[angry] Dear me. {item}. I'd sooner swallow a black hole. Please, take it back."
      ]
    },
    giftDone: [
      "[happy] You've already given me a gift today, dear. Any more and I'll have to name a star after you. Two stars.",
      "One gift a day is plenty. Even the sky only gives us one sun."
    ],
    hearts: {
      2: {
        pages: [
          "[happy] Come, come. Look through here. No, the other end. There! See those seven crooked stars? I named them years ago.",
          "The Stubborn Kettle. For Morwenna. She said it looked nothing like a kettle. Then she squinted, laughed, and said 'Fine. Fine.'",
          "[sad] She never admitted she liked it. But she came up every year on the night it rose highest. Just to complain about the name.",
          "[happy] Here. Two starshards that fell on my balcony. They glow brighter near people who are loved. See? Like little lamps."
        ],
        reward: { item: 'starshard', qty: 2 }
      },
      4: {
        pages: [
          "[happy] Morwenna, would you pass the... oh. Oh, dear. {player}. I'm sorry. I was somewhere else. Somewhere fifty years ago.",
          "[sad] You stand at the window just as she did. Hands in pockets, scowling at the moon as if it owed you money.",
          "Here. Her old apprentice notebook. Look, she drew me with a beard down to my boots. I was thirty. It was a very ambitious beard.",
          "[happy] Take some arcane quartz, too. She used to steal it from my desk. I always pretended not to notice."
        ],
        reward: { item: 'quartz', qty: 3 }
      },
      6: {
        pages: [
          "You've earned some of the Order's knowledge, I think. Sit. This one is old, and very bright.",
          "The Starlight Philter. Starbloom, moonpetal, and a shard of fallen star. The Order brewed it before every descent into the deep.",
          "[happy] It bends luck toward you. Gems glitter where there were none. Monsters drop what they hoarded. Use it well, dear. And sparingly."
        ],
        reward: { recipe: 'pot_starlight' }
      },
      8: {
        pages: [
          "[sad] Brann has told you about the fire, hasn't he? I can tell by how you look at my charts. As if they might ignite again.",
          "He carried me down ninety-nine steps. I counted, for something to do. He complained about my weight on every single one.",
          "[happy] I've never thanked him properly. We argue instead. It's easier. Thirty years of 'real work' and 'lacks poetry.'",
          "[happy] Take these moonstones. And if you see Brann, tell him the charts were worth it. Then duck."
        ],
        reward: { item: 'moonstone', qty: 2 }
      },
      10: {
        pages: [
          "{player}. There is one recipe the Order guarded above all others. Even Morwenna never learned it. I never thought her ready.",
          "[sad] I was wrong. I should have taught her. I was afraid she'd outshine me. She would have. She did anyway.",
          "The Elixir of the Moon. Wispbloom, starbloom, moonstone. It does not heal. It strengthens. It leaves a little moon inside you.",
          "[happy] Take it, dear. And when you brew it, look up. Somewhere a small, grumpy star will be very proud of you. Two of them."
        ],
        reward: { recipe: 'pot_moon' }
      }
    },
    shop: {
      greet: [
        "[happy] Recipes, dear! Copied from the Order's own scrolls. Mostly legible. Some of the stains are tea.",
        "Knowledge is the only treasure that grows when you spend it. Though I do still charge for it. Telescopes are dear.",
        "[surprised] A customer! How lovely. Mind the star charts. The scrolls are on the shelf. Which shelf? Ah. That is the question."
      ],
      bye: [
        "Read slowly, dear. Brew slower. Explode never.",
        "[happy] Clear skies to you. And if they're cloudy, clear thoughts."
      ]
    }
  };

  // ================================================================ ELOWEN
  T.npcs.elowen = {
    name: 'Elowen Mossbright', short: 'Elowen', title: 'Warden of Whisperwood',
    bio: "A shy druid-ranger who talks to trees and animals more easily than to people, and turns fierce when the forest is threatened.",
    intro: [
      "[surprised] Oh! I-I'm sorry. I didn't hear you coming. The forest didn't warn me. It... usually does. It must like you.",
      "I'm Elowen. Elowen Mossbright. I look after Whisperwood. Or... it looks after me. We take turns.",
      "[sad] Morwenna was... kind to me. She'd want me to be kind to you. So... um. Welcome. Please don't step on the mushrooms."
    ],
    talk: [
      { text: "Oh... h-hello. Sorry. I was listening to the moss. It's been a... a quiet day, for moss." },
      { text: "[happy] The birch by the river says you walk softly. That's... that's a very high compliment. From a birch." },
      { text: "Um. If you're foraging, please leave one of everything behind. So the forest can... try again." },
      { text: "A wolfsbane flower closes when it's frightened. I think... I think I do that too. Sometimes." },
      { text: "The owls are arguing again. About the stars, I think. Or mice. With owls it's... usually mice." },
      { text: "[happy] A hedgehog named Bramble lives under my porch. He doesn't know he has a name. I haven't told him. It might... overwhelm him." },
      { text: "Fairycaps grow where something kind happened. That's what I was taught, anyway. I... still believe it." },
      { text: "[sad] Some trees near the Ridge have gone grey. Like they're holding their breath. Something under the mountain is... wrong." },
      { text: "Sorry. I'm not very good at talking. To people. Trees are easier. They wait for you to finish." },
      { text: "[happy] If you hum while you garden, the roots grow toward the sound. I promise. Well... I think so. Will you try it?" },
      { text: "The forest remembers footsteps. Yours are new. But it's getting used to them. Slowly. Like I am." },
      { text: "Owls only leave feathers for someone they trust. I have forty-two. I counted. Twice." },
      { text: "Um... do you think plants get lonely? I think the moonlilies do. They grow so far apart." },
      { text: "[surprised] Oh! You're very quiet. Like a deer. That's good. I'm not scared. Just... surprised. Mostly." },
      { text: "Please be gentle when you clear the old stumps. Thank them, if you can. They held up the sky for a long time." },
      { text: "[sad] Morwenna used to bring me tea and sit on a log without talking. She was the only person who knew how to be quiet with me." },
      { text: "Mornings in Whisperwood smell like wet bark and... beginnings. I like beginnings. Endings are harder.", when: { loc: 'woods', time: 'morning' } },
      { text: "[happy] The sunlight's coming through the leaves in little coins today. The forest is... rich.", when: { loc: 'woods', time: 'afternoon' } },
      { text: "Dusk is when the fairy ring wakes a little. Not fully. It just... stretches. I like to be there when it yawns.", when: { loc: 'woods', time: 'evening' } },
      { text: "At night the forest talks more. Not louder. Just... more honestly.", when: { time: 'night' } },
      { text: "The mist is thick near the bog today. Please... don't go too far south. Not unless you know the way.", when: { loc: 'woods', weather: 'mist' } },
      { text: "[sad] The village is so... square. Too many corners. But the rain was loud on the leaves, and Sable's hearth is warm.", when: { loc: 'village', weather: 'rain' } },
      { text: "[happy] Rain! The ferns are so happy. Can you hear them? It's... um, it's a very small sound.", when: { weather: 'rain' } },
      { text: "In mist the forest feels closer. Like a blanket. Or a held breath.", when: { weather: 'mist' } },
      { text: "[surprised] Stars falling... all the animals are looking up. Even the beetles. Everyone's... wondering.", when: { weather: 'starfall' } },
      { text: "[happy] Full moon tonight. The fairy ring opens all the way. If you go... bring something to share. They like good manners.", when: { moon: 'full' } },
      { text: "[sad] The new moon makes the animals restless. The foxes keep looking toward the Ridge. I... don't like it either.", when: { moon: 'new' } },
      { text: "[sad] Grizelda taught me everything I know. Roots, remedies, how to listen. And then we... stopped speaking. It's a long story." },
      { text: "If you see Grizelda, please don't... don't mention me. Or... do. I don't know. I don't know what I want." },
      { text: "[happy] Pip came into the woods to 'study frogs.' The frogs studied him. I think the frogs learned more." },
      { text: "Mirabel gives me seeds and tells me to eat more. I do eat. I just eat like a sparrow. Sparrows are very healthy." },
      { text: "Corvin walks the edge of the woods some nights, looking toward the Ridge. The crows follow him. I think they keep him company." },
      { text: "Brann's ore carts frighten the deer. But he carved me a wooden fox once. To say sorry. Without saying it." },
      { text: "[happy] Orvyn says every tree is a little observatory, always looking up. I like that. I like him." },
      { text: "Sable lets me sit by her fire when it storms. She doesn't make me talk. She just... hums. It's nice." },
      { text: "The Captain says there's a fish in the lake older than the forest. I asked the trees. They said that's... probably not true." },
      { text: "[happy] The forest likes you. I can tell. The brambles lean aside when you walk past. They don't do that for most people.", when: { minHearts: 3 } },
      { text: "I'm less shy around you. I noticed today. I said three whole sentences without looking at my boots. That's four now.", when: { minHearts: 5 } },
      { text: "[sad] When I was small I got lost in the bog. Grizelda found me. Carried me home and pretended she'd been 'out for toads.'", when: { minHearts: 7 } },
      { text: "[happy] You're the first person I've wanted to show the old places to. The secret ones. Even the deer don't know some of them.", when: { minHearts: 9 } },
      { text: "[happy] You brewed something... I could smell it from the grove. Um. In a good way. Mostly good.", when: { flag: 'firstBrew' } },
      { text: "[sad] You went deep. Past the purple crystals. Please be careful. The things down there don't belong to any forest.", when: { flag: 'depths10' } },
      { text: "[happy] The Moonroot is waking! I felt it in the soil this morning. Like... like the whole valley stretched.", when: { flag: 'altar1' } },
      { text: "[happy] The roots are singing, {player}. All the way to the lake. I've never heard them so... so loud.", when: { flag: 'altar5' } },
      { text: "[happy] The grey trees are turning green again. All of them. I sat with one and cried a little. It was a good cry.", when: { flag: 'archonDefeated' } },
      { text: "[happy] Seraphine keeps a little tree in the cathedral. A Sanctum cutting. I sing to it when nobody's there. ...Seraphine is always there." },
      { text: "Fennick sells golden acorns. The squirrels are... very upset about it. I asked him to stop. He gave one back. That was kind." },
      { text: "[sad] The Deepwood is older than Whisperwood. Some of the things in it are older than kindness. Please... not at night." },
      { text: "[happy] Lantern Moon... the wisps come to the plaza to play. Please catch them gently. They're only visiting.", when: { moon: 'full', time: 'evening' } },
      { text: "Caspian's animals are so loved. His dragons purr when he hums. I didn't know dragons purred. I've learned something." }
    ],
    repeat: [
      "Oh... hello again. The squirrel says you're very persistent.",
      "[happy] Twice in one day... the forest will think we're friends. Um. We are. Aren't we?",
      "I'm still here. The trees and I were just... thinking.",
      "Sorry, I'm out of words for today. I'll grow some more by tomorrow."
    ],
    gift: {
      love: [
        "[surprised] {item}... for me? Oh. Oh, thank you. I'll... I'll treasure it. Truly.",
        "[happy] {item}! It's perfect. You carried it so gently... I can tell. The forest can tell too.",
        "[happy] Oh... {item}. I don't know what to say. Um. Thank you. That's what I'll say. Thank you."
      ],
      like: [
        "[happy] {item}. That's... that's lovely. Thank you.",
        "Oh, {item}. The forest will be glad to see it. So am I.",
        "[happy] Thank you... {item} is a kind gift. You're kind."
      ],
      neutral: [
        "{item}? Um... thank you. I'll find somewhere for it.",
        "Oh. {item}. That's... nice. Thank you.",
        "Thank you... I think the squirrels will be very curious about {item}."
      ],
      dislike: [
        "[sad] {item}... it's from deep in the mountain, isn't it? The mountain... misses it.",
        "[sad] Oh. Um. {item}. I'll... put it back where it belongs. Somewhere.",
        "{item}... I'm sorry. I don't really know what to do with this."
      ],
      hate: [
        "[angry] {item}... no. That's wrong. Please take it away from the trees.",
        "[sad] Please... don't bring {item} here. It makes the whole forest go quiet."
      ]
    },
    giftDone: [
      "You already gave me something today. Um... the forest says that's plenty.",
      "[happy] Thank you, but... one is enough. I'd feel greedy. Like a magpie."
    ],
    hearts: {
      2: {
        pages: [
          "[happy] Come... quietly. This is Old Hollow, the oldest oak in Whisperwood. Put your hand on her bark. Gently.",
          "[surprised] Can you feel it? A little hum? She's saying hello. She doesn't say hello to everyone. Just you, and me, and the bees.",
          "[happy] The bees! Right. They left this for you. Honey. They've decided you're... acceptable. That's high praise, from bees."
        ],
        reward: { item: 'honey', qty: 2 }
      },
      4: {
        pages: [
          "I want to show you something I learned when I was small. A Fairy Draught. Fairycap and wolfsbane.",
          "[sad] Grizelda taught it to me. In her hut, with my feet not touching the floor. She said I had good hands. I never forgot.",
          "[happy] I want you to have it. It's... it's the first thing anyone ever taught me that worked."
        ],
        reward: { recipe: 'pot_fairy' }
      },
      6: {
        pages: [
          "[surprised] {player}! Stay back! Something's by the fawn... something from the Depths. A void slime. It came up through the roots.",
          "[angry] Leave her alone. LEAVE HER ALONE. This is MY forest. Go back to the dark where you belong!",
          "[sad] ...It's gone. It's gone. I'm shaking. I'm not brave. I just... I couldn't let it hurt her.",
          "[happy] You stayed. You didn't run. ...The lake sent these lilies down the stream this morning. I think they were for you."
        ],
        reward: { item: 'moonlily', qty: 3 }
      },
      8: {
        pages: [
          "[sad] You asked about Grizelda once. I'll tell you. Years ago a blight crept into the eastern grove. Grey, spreading. From the Ridge.",
          "She burned it. The whole grove. To save the rest. I screamed at her. I called her a monster. I left, and... I never went back.",
          "[sad] I know now she was right. The forest told me. It took me years to listen. She was saving it. And me.",
          "[happy] I don't know how to say sorry to her. Maybe one day. Here. Owl feathers. They dropped them for you. Owls don't do that."
        ],
        reward: { item: 'feather', qty: 3 }
      },
      10: {
        pages: [
          "[happy] {player}, close your eyes. Listen. ...That's the whole forest. Saying your name. Well. Saying it in leaf.",
          "It means 'the one who woke the roots.' Or possibly 'tall mushroom.' Leaf is very hard to translate.",
          "[happy] These are cuttings from the oldest wispvine in Whisperwood. It's never let anyone take a cutting. Not even me.",
          "[happy] And... I wrote a letter to Grizelda. I haven't sent it yet. But I wrote it. That's brave, isn't it? For me?"
        ],
        reward: { item: 'seed_wispvine', qty: 5 }
      }
    }
  };

  // ================================================================ GRIZELDA
  T.npcs.grizelda = {
    name: 'Grizelda Hexley', short: 'Grizelda', title: 'Witch of the Southern Mire',
    bio: "A cackling bog witch who trades rare seeds and stranger curios, insults everyone she likes, and was Morwenna's oldest rival.",
    intro: [
      "[happy] Kehehe! Well, well, well! Morwenna's little apprentice! You've grown! Like a mushroom! In the dark! Pale and lumpy!",
      "Grizelda Hexley. Witch of the southern mire. Trader of curios, rare seeds, and very bad advice. Hee hee!",
      "[sad] ...She went and died before me, the old crow. Cheated me out of winning. Typical. ...Well? Don't just drip there. Buy something."
    ],
    talk: [
      { text: "[happy] Kehehe! Look what the bog dragged in! Wipe your feet, you soggy little turnip. Actually, don't. I like the mud." },
      { text: "A good bog is like a good grudge, dearie. Deep, warm, and full of things best left buried. Hee hee!" },
      { text: "[angry] Stop staring at my wart! It's a family heirloom! My grandmother had it first!" },
      { text: "Want a secret? Frogs know everything. They just won't tell you unless you're a frog. Keep trying." },
      { text: "[happy] My cauldron's been bubbling for forty years. Never once cleaned it. That's where the flavour lives!" },
      { text: "You've got moon-dust in your hair and dirt under your nails. Disgusting. You'll make a fine witch someday." },
      { text: "Don't touch the jars. Not the red ones. Not the blue ones. The green ones you can touch. Once." },
      { text: "Mandrakes are the only honest vegetable. They scream when they're unhappy. More of us should." },
      { text: "[happy] Hee hee! I hexed the mayor once. Made him hiccup in rhyme for a week. Best week of his life. Of mine, anyway." },
      { text: "Sludge, they call it. Failed brew. Pah! Sludge is just a potion that hasn't found its purpose yet. Like you, dearie." },
      { text: "The bog keeps everything. Boots, bones, secrets, lost rings. It's not greedy, mind. Just sentimental." },
      { text: "My raven feather? Plucked it off a raven who insulted my hat. We're friends now. He still insults my hat." },
      { text: "[happy] You're looking peaky! Good! Peaky's the first stage of becoming interesting!" },
      { text: "Every witch needs three things: a cauldron, a cat, and someone to scare. I've got two. Your cat looks tempted." },
      { text: "[sad] Nobody comes down to the bog any more. Not that I care! Good riddance! ...Stay for tea, though. If you must." },
      { text: "[angry] Morwenna owes me eleven glimmer from a card game when we were girls. I'll collect it from you. With interest. Kehehe!" },
      { text: "Morning? Bah! The bog doesn't do mornings. The bog does damp, and then more damp.", when: { loc: 'woods', time: 'morning' } },
      { text: "[happy] Afternoon tea! Newt-leaf and bog myrtle. Want some? It'll put hair on your... somewhere.", when: { loc: 'woods', time: 'afternoon' } },
      { text: "The bog-lights are coming out. Don't follow them, dearie. They lead to more bog. It's bogs all the way down.", when: { loc: 'woods', time: 'evening' } },
      { text: "[happy] Night! When the frogs sing and the witches cackle! Hee hee hee! See? I'm practising.", when: { loc: 'woods', time: 'night' } },
      { text: "[happy] Full moon! The ring's awake! I come every month to dance. Badly. The fairies are too polite to say.", when: { loc: 'woods', moon: 'full' } },
      { text: "[happy] Rain! Wonderful! The bog gets deeper and everyone else gets miserable! Hee hee!", when: { weather: 'rain' } },
      { text: "Mist's my favourite weather. Can't see anyone, and nobody can see me. Perfect for creeping.", when: { weather: 'mist' } },
      { text: "[angry] Starfall! Ugh! Sparkly rubbish everywhere! It gets in the cauldron and makes everything taste of wishes.", when: { weather: 'starfall' } },
      { text: "New moon. The Depths get hungrier. Going down tonight? Take a sludge. Throw it at things. Kehehe!", when: { moon: 'new' } },
      { text: "Still poking about, are you? Most folk run after the first cackle. Kehehe! I like a slow learner.", when: { maxHearts: 2 } },
      { text: "[angry] That girl. Elowen. Haven't spoken in years. Don't ask. ...She still eating enough? Not that I care. Just asking." },
      { text: "[sad] I taught Elowen everything. Roots, remedies, which toads to kiss. Kidding! None! Kiss none! ...Best student I ever had." },
      { text: "Mirabel's pies? Too sweet. I eat three, to make sure they're too sweet. Every time. Thorough, me." },
      { text: "[happy] That little Pip brought me a sludge once. Called it 'Experiment Forty-One.' I called it lunch. We get on, him and me." },
      { text: "Orvyn! Old Lanternface! Still talking to the stars, is he? At least they can't walk away. Kehehe!" },
      { text: "Brann made me a cauldron with a face. I asked for that. Didn't ask for it to look like me. Didn't complain, either." },
      { text: "Corvin buys my salve 'for the ghosts.' Ha! A gravekeeper with ghost trouble! ...Nice boy. Sad eyes. Feed him something." },
      { text: "Sable tried to put me in a song once. I put her lute in the bog. She fished it out. We've been friends ever since." },
      { text: "[happy] The Captain swears I turned a pirate into a cod. I did not. I turned him into a halibut. Facts matter." },
      { text: "[sad] Morwenna and I wrote each other insults every week for sixty years. Every week. Now my letterbox just sits there. Ugly thing." },
      { text: "[happy] You keep coming back! Must like the smell. Or me. Probably the smell. Kehehe!", when: { minHearts: 3 } },
      { text: "Hmph. You're alright, for a garden-grubber. Don't tell anyone I said so. I'll deny it. Loudly.", when: { minHearts: 5 } },
      { text: "[sad] Every full moon I leave a basket of fairycaps by Elowen's grove. She thinks it's the fairies. Let her. Fairies deserve the credit.", when: { minHearts: 7 } },
      { text: "[happy] You know what, dearie? You're the second person I've ever liked. The first went beyond the Veil. Don't you dare follow her.", when: { minHearts: 9 } },
      { text: "[happy] Your first brew! Did it smoke? Did it scream? No? Pfft. You'll get there. Hee hee!", when: { flag: 'firstBrew' } },
      { text: "[happy] Been down to the Catacombs, eh? Bring me spider silk! I'm knitting a shawl. For spooking.", when: { flag: 'depths25' } },
      { text: "The altar's glowing again. Morwenna always said it'd take someone with even less sense than her. Kehehe! That's you!", when: { flag: 'altar1' } },
      { text: "[happy] You flattened that shadow-guzzling lump! Ha! I'll brew a celebration sludge! You'll hate it! That's the point!", when: { flag: 'archonDefeated' } },
      { text: "[angry] Isolde wants to put me in a 'proper' hat. This IS a proper hat! It's the properest hat in the whole bog!" },
      { text: "[happy] That Elvis calls me 'stardust.' Me! I turned his bow tie into a moth. Turned it back, too. Mostly." },
      { text: "Fennick bet me his monocle I couldn't hex a frog into a teapot. The teapot hops now. Pay up, Fennick!" },
      { text: "[happy] Lantern Moon! My fortune tent's open, dearie! Real fortunes! Real hints! Real cheap! Well. Two out of three. Kehehe!", when: { moon: 'full', time: 'evening' } },
      { text: "[happy] That spiky Laura girl! I hexed her boots and she hexed me back with a LOOK. Kehehe! I like her!" },
      { text: "Gideon owes me a bottle of bog wine from the war. Some debts age like good bog water. Kehehe!" }
    ],
    repeat: [
      "[angry] You again! Go on, shoo! ...Or stay. The frogs like you.",
      "Back so soon? The bog must be growing on you. Literally. Check your boots.",
      "[happy] Kehehe! Can't stay away, can you? Nobody can. That's the bog.",
      "I'm busy cackling. Come back later.",
      "Twice in a day? People will think I'm popular. Ruin my reputation, why don't you."
    ],
    gift: {
      love: [
        "[surprised] {item}?! For me?! Oh, you rotten little darling! Kehehe! It's going on the mantel next to the skulls!",
        "[happy] Ooh! {item}! Gorgeous! Ghastly! Perfect! You're a menace, and I adore you for it!",
        "[happy] {item}! You beautiful bog-rat! Haven't had a gift this good since Morwenna sent me a jar of slugs!"
      ],
      like: [
        "[happy] {item}! Not bad, toadstool. Not bad at all.",
        "Hee hee! {item}. That'll go nicely in the stew. Or the hex. One of those.",
        "[happy] {item}, eh? You've got taste. Bad taste. My favourite kind."
      ],
      neutral: [
        "{item}? Pfft. I suppose I can use it. To prop up a table.",
        "Hmph. {item}. I've had worse. I've had better. I've had frogs.",
        "{item}. Boring. But it's from you, so it's slightly less boring."
      ],
      dislike: [
        "[angry] {item}? Ugh! Too clean! Too pretty! Take it somewhere sunny!",
        "[angry] What's this? {item}? Did Mirabel put you up to this?",
        "{item}. Bleh. Smells like a meadow. I hate meadows."
      ],
      hate: [
        "[angry] {item}! Get it out! OUT! It's sparkling at me! I can feel it being cheerful!",
        "[angry] Bah! {item}! Trying to curse me, dearie? That's MY job!"
      ]
    },
    giftDone: [
      "[angry] Greedy, are we? One gift a day! Even witches have rules! Two rules. That's one of them.",
      "You've already given me something. Save the rest for the bog. It's hungry too. Kehehe!"
    ],
    hearts: {
      2: {
        pages: [
          "[happy] Sit down, sit down. Have some tea. Don't mind the colour. Or the smell. Or the little bubbles that look like faces.",
          "[surprised] ...You drank it! All of it! Ha! Most people run screaming! It's bog-mint, you silly newt. Perfectly harmless.",
          "[happy] You've got guts, dearie. Morwenna drank it too, the first time. Then threw the cup at me. Here. Mandrake seeds. Grow me screamers."
        ],
        reward: { item: 'seed_mandrake', qty: 5 }
      },
      4: {
        pages: [
          "[sad] See this box? Sixty years of letters. Morwenna and me. 'Dear Toad.' 'Dear Crow.' Every week. Every single week.",
          "This one came after she died. Must have written it ahead, the sly old crow. I haven't opened it. Read it to me. Go on.",
          "[sad] 'Dear Toad. If you're reading this, I've won. Don't sulk. You owe me a cup of tea. Collect it from my apprentice.'",
          "[happy] ...Kehehe. Hee... Well? Don't just stand there! Make the tea! And take this amber. Don't let me see you cry. I'm not."
        ],
        reward: { item: 'bog_amber', qty: 2 }
      },
      6: {
        pages: [
          "[angry] Take these. Go on. Starbloom seeds. Disgusting things. All sparkle and cheer. They make my teeth itch.",
          "A trader swapped them for a jar of eyes. Glass eyes! Calm down. I won't grow them. The bog would be insulted.",
          "[happy] You'll grow them, though. Up in your shiny garden. Morwenna always grew the shiny things. I grew the useful ones."
        ],
        reward: { item: 'seed_starbloom', qty: 2 }
      },
      8: {
        pages: [
          "Listen close, dearie. I'm teaching you a recipe I swore I'd take into the bog with me. The Shadowveil Draught.",
          "Duskberry, bat wing and ectoplasm. Drink it and monsters look straight through you. Like you're furniture. Or a ghost's ghost.",
          "[happy] Don't make that face. I'm not going soft. I just don't want to dig you out of the Depths. My back's bad. Kehehe!"
        ],
        reward: { recipe: 'pot_shadow' }
      },
      10: {
        pages: [
          "[sad] ...Don't laugh. I've been lonely. Sixty years of letters, and then nothing but frogs and my own cackling.",
          "Then you came along. Tracking mud. Asking questions. Eating my biscuits. Annoying. Like her. Exactly like her.",
          "[happy] Visit on full moons. Dance at the ring with me. Badly. And take these. My rarest seeds. Don't waste them, you lovely toad.",
          "[happy] And if a certain shy girl in the woods ever asks after me... tell her the door's open. It always was. Kehehe. Now shoo!"
        ],
        reward: { item: 'seed_starflask', qty: 3 }
      }
    },
    shop: {
      greet: [
        "[happy] Kehehe! Come in, come in! Curios, seeds, and jars of things you won't ask about!",
        "Rare seeds for rare fools. Have a look, dearie. Touch nothing that blinks.",
        "[happy] A customer! Well, don't just drip there. Buy something!"
      ],
      bye: [
        "[happy] Off you go! Mind the bog! It minds you! Kehehe!",
        "No refunds! No exchanges! No crying! ...Come back soon."
      ]
    }
  };

  // ================================================================ CORVIN
  T.npcs.corvin = {
    name: 'Corvin Ashgrave', short: 'Corvin', title: 'Gravekeeper & Lodgemaster',
    bio: "Keeper of the Ridge cemetery and the Delvers' Lodge: deadpan, poetic, secretly kind, and still waiting for his sister Wren to come home.",
    intro: [
      "Ah. The new keeper. Welcome to Starfall Ridge. Population: a handful living, three hundred and twelve resting. I'm the in-between.",
      "Corvin Ashgrave. I keep the graves, and I keep the Delvers' Lodge. Swords go out, monster bits come in. Very cheerful work.",
      "[sad] I'm sorry about Morwenna. She's resting by the old willow. She'd hate the willow. Too droopy. I'll plant something rude."
    ],
    talk: [
      { text: "Good day. Or as good as days get up here, among the dead and the nearly dead. That's the delvers, not the graves." },
      { text: "The dead make excellent neighbours. Quiet. Tidy. Never borrow anything. I'd recommend them, if I recommended things." },
      { text: "I sell swords to people who walk into the dark, and buy what they carry back. Some days I get both. Some days, neither." },
      { text: "[happy] That was almost a smile. Don't tell anyone. I have a reputation for gloom to maintain." },
      { text: "Every grave up here has a story. Most of them end the same way. The interesting part is always the middle." },
      { text: "Coffee. Black. Like my coat, my mood, and the inside of most caves. Want some? It's terrible." },
      { text: "The ravens know my name. I never told them. I assume they read it on a headstone. Mine isn't carved yet. They're patient." },
      { text: "Poetry is just grief that learned to dress well. ...Forget I said that. It sounded better in my head." },
      { text: "Delvers' rule one: never go down without a healing draught. Rule two: never go down alone. Rule three: everyone breaks rule two." },
      { text: "[sad] The Depths take more than they give. But they do give. That's the cruel part." },
      { text: "I keep a ledger of everyone who goes down. And a second ledger of everyone who comes back up. I prefer the second one." },
      { text: "My earring? A gift. From someone who's very late coming home. Five years late, so far." },
      { text: "[happy] You're tracking mud through my lodge. Delightful. It goes with the stains. Monster stains. Mostly." },
      { text: "[sad] Morwenna used to bring me coffee on bad days. Didn't ask. Didn't talk. Just coffee, a nod, and a horrible biscuit." },
      { text: "Morning. The Lodge opens at ten. I open at eleven. Emotionally.", when: { loc: 'ridge', time: 'morning' } },
      { text: "Afternoon. Prime delving hours. The monsters are napping, allegedly. Nobody's asked them.", when: { loc: 'ridge', time: 'afternoon' } },
      { text: "[sad] Evening rounds. I sweep the leaves off the graves. The dead don't mind them. I do.", when: { loc: 'ridge', time: 'evening' } },
      { text: "The cemetery at dusk is peaceful. The first stars on one side, the graves on the other. Hard to say which are older.", when: { loc: 'ridge', time: 'evening' } },
      { text: "Yes, I come to the tavern. I sit in the corner and look mysterious. It's my one hobby.", when: { loc: 'village', time: 'night' } },
      { text: "Rain. The headstones look freshly washed. Small mercies. Very small. Damp ones.", when: { weather: 'rain' } },
      { text: "Mist on the Ridge. The headstones look like people waiting. I always say good evening, just in case.", when: { weather: 'mist' } },
      { text: "[sad] Starfall. Wren used to run out and collect them. Pockets full of light. She never could leave pretty things alone.", when: { weather: 'starfall' } },
      { text: "Full moon. The ghosts get restless. So do I. We take turns pacing.", when: { moon: 'full' } },
      { text: "[sad] New moon. The Depths are richer tonight, and hungrier. If you go down, go carefully. I'd rather not carve your name.", when: { moon: 'new' } },
      { text: "Still here? Most people leave after the first gloomy remark. I have others. Many others.", when: { maxHearts: 2 } },
      { text: "[sad] My sister Wren went into the Depths five years ago, looking for the Archon. She found it, or it found her. I don't know which." },
      { text: "Wren called me 'Cor.' Nobody else is allowed to. You can try. You'll hear a very cold silence." },
      { text: "Mirabel leaves pie on my doorstep. I don't like pie. It's always gone by morning. I'm not sure who eats it. Me. It's me." },
      { text: "Pip jumps out of bushes at me. I say 'Good evening, Pip.' He hates that. I intend to keep doing it until he's thirty." },
      { text: "Brann forges my blades. Best in the valley. He hands them over like he's apologising. Maybe he is." },
      { text: "Sable lets me sit in the corner for hours with a cold coffee. She never asks why. That's a kind of friendship." },
      { text: "Orvyn told Wren about the Archon. He thinks I blame him. I don't. Wren would have gone anyway. She always did." },
      { text: "Grizelda sells me a salve 'for the ghosts.' It doesn't work on ghosts. It works on blisters. I keep buying it." },
      { text: "The Captain says there's a monster in the lake. I've never seen it. But I've seen Lune's face when the water goes very still." },
      { text: "You visit the graves. Most people hurry past. You read the names. ...I noticed, that's all.", when: { minHearts: 3 } },
      { text: "[happy] I wrote a poem about you. It's terrible. You'll never see it. It rhymes 'delver' with 'silver.' Unforgivable.", when: { minHearts: 5 } },
      { text: "[sad] Wren and I fought the night she left. I said she cared more about maps than people. She said 'Someone has to care about both.'", when: { minHearts: 7 } },
      { text: "[happy] I laughed yesterday. Properly. Something Pip said. First time in five years. Like opening a window in a tomb.", when: { minHearts: 9 } },
      { text: "Heard you brewed your first potion. Bring the Lodge a few. The delvers always need more. They're careless that way.", when: { flag: 'firstBrew' } },
      { text: "Floor five. A Rune Gate. It'll remember you now. Wren called them 'doors that remember you.'", when: { flag: 'depths5' } },
      { text: "The Amethyst Grotto. Beautiful, isn't it? The beautiful things down there are usually trying to eat you.", when: { flag: 'depths10' } },
      { text: "[sad] The Webbed Catacombs. Wren's last letter came from near there. If you see a red scarf... no. Never mind. Be careful.", when: { flag: 'depths25' } },
      { text: "[surprised] The Abyssal Rift. Further than anyone's been in years. Further than anyone who came back. So come back.", when: { flag: 'depths40' } },
      { text: "The Sanctum's lights are visible from the Ridge now. Even the graves look warmer. Don't tell them. They'll get ideas.", when: { flag: 'altar3' } },
      { text: "[sad] The Archon's gone. No sign of Wren down there. No bones. No goodbye. ...Then I'll keep a lamp lit. She was always late.", when: { flag: 'archonDefeated' } },
      { text: "[sad] Seraphine keeps a candle burning in the cathedral for Wren. I never asked her to. I sit with it on Stardays." },
      { text: "Elvis brings me a fresh coffee every hour and never says a word. Best conversation I have all week." },
      { text: "Isolde calls my coat 'nearly adequate.' I bought it from a stranger at a fair. The stranger wore cat-eye spectacles. I'm starting to suspect." },
      { text: "Lantern Moon. I'll send up a lantern at ten. Same wish as every year. Hasn't worked yet. Lanterns are very slow readers.", when: { moon: 'full', time: 'evening' } },
      { text: "Laura and I have the same coat. We nod at each other in the street. It's the closest thing Hollowmere has to a club." }
    ],
    repeat: [
      "Back again. The dead are less persistent. I find that restful.",
      "We've spoken today. I'm out of brooding. Come back tomorrow, I'll have restocked.",
      "[happy] Twice. Careful. People will think I have a friend.",
      "Still here? The ravens are starting to talk."
    ],
    gift: {
      love: [
        "[surprised] {item}. ...You remembered. Nobody remembers. I'm... touched. Don't look at me like that.",
        "[happy] {item}. That's actually perfect. I may write a poem about it. You've been warned.",
        "[happy] Ah. {item}. My heart, such as it is, does a small and gloomy dance."
      ],
      like: [
        "{item}. Thoughtful. I'll put it to good, grim use.",
        "{item}. Hm. You have good instincts. For someone so cheerful.",
        "[happy] Thank you. {item} suits the Lodge. Dark and useful."
      ],
      neutral: [
        "{item}. Thank you. I'll add it to the pile of things I'm meant to feel something about.",
        "Ah. {item}. Well. Everything ends up in the ground eventually.",
        "{item}? ...Thank you. I think."
      ],
      dislike: [
        "{item}. It's very... cheerful. I'll keep it somewhere dark until it learns.",
        "[sad] {item}. Mirabel's been giving you ideas, hasn't she?",
        "{item}? I'll pass it on to someone who smiles more. Which is practically everyone."
      ],
      hate: [
        "[angry] {item}. No. Some things are too bright to bear. Take it away.",
        "[angry] {item}? I'd rather be buried with it than keep it. Don't test me."
      ]
    },
    giftDone: [
      "One gift is generous. Two would be suspicious. I'm a suspicious man.",
      "Already had something from you today. I'm still recovering from the joy."
    ],
    hearts: {
      2: {
        pages: [
          "You look like you've been fighting slimes all morning. Sit. I've made coffee. It's terrible. That's how you know it's honest.",
          "Wren made it like this. Strong enough to wake the dead. Up here, that's a genuine risk. I've had complaints.",
          "[happy] Take a couple. For the Depths. If you drink one at the bottom of a cave, think of me. Gloomily."
        ],
        reward: { item: 'food_coffee', qty: 2 }
      },
      4: {
        pages: [
          "[sad] Follow me. Mind the ivy. This one. No body. Just a name. Wren Ashgrave. I carved it the year she didn't come back.",
          "I don't leave flowers. She'd hate flowers. She'd want a map. So every year I leave her a new map of the floors people have charted.",
          "[sad] I don't know why I'm showing you this. ...Here. Healing draughts. Delvers' rule one. Never go down without three."
        ],
        reward: { item: 'pot_healing', qty: 3 }
      },
      6: {
        pages: [
          "[surprised] Is that my notebook? Where did you... Pip. Of course. Give that back. ...You read it, didn't you.",
          "[angry] 'Ode to My Coat.' 'Elegy for a Lost Sock.' 'Raven, You Are a Smug Bird.' Those are private, {player}. Deeply private.",
          "[happy] ...Fine. You laughed at the sock one. Everyone would. Here. Hush money. Not a word to Sable. She'd set them to music."
        ],
        reward: { glimmer: 400 }
      },
      8: {
        pages: [
          "[sad] The night Wren left, I told her she cared more about maps than about me. It was the last thing I ever said to her.",
          "She said 'Someone has to care about both, Cor.' Then she shut the door. Softly. She never slammed doors. I always did.",
          "These were hers. Shadowveil Draughts. Monsters walk right past you. She never used them. I'd like you to walk past them. And come back."
        ],
        reward: { item: 'pot_shadow', qty: 2 }
      },
      10: {
        pages: [
          "[happy] ...Ha. Ha ha. Sorry. That was a laugh. A real one. I'd forgotten the shape of it.",
          "You did that. Five grey years, and you walked in with mud on your boots and terrible jokes and... I'm grateful. There. I said it.",
          "[sad] If you ever find her down there, or anything of hers... tell her I'm not angry. Tell her I kept the coffee hot.",
          "[happy] Take these. Void crystals from her collection. She'd want them used, not dusted. She'd want you to go further than she did."
        ],
        reward: { item: 'voidcrystal', qty: 2 }
      }
    },
    shop: {
      greet: [
        "Welcome to the Delvers' Lodge. Swords for the brave, potions for the wise, refunds for no one.",
        "Going down? Buy something sharp. Coming up? Sell me something strange.",
        "[happy] Ah, a customer who's still breathing. My favourite kind."
      ],
      bye: [
        "Come back up. That isn't a farewell. It's an order.",
        "Mind the dark. It minds you."
      ]
    }
  };

  // ================================================================ LUNE
  T.npcs.lune = {
    name: 'Captain Lune Marrow', short: 'Lune', title: 'Captain of Glimmermere',
    bio: "A retired adventurer turned fisher who sells rods and bait, buys fish, and never tells the same story about that eyepatch twice.",
    intro: [
      "[happy] AHOY! A new face on my dock! Captain Lune Marrow: retired adventurer, master angler, teller of entirely true stories!",
      "Morwenna's apprentice, eh? HAH! She bought my ghosteels 'for the cat.' Never saw a cat so round, or an alchemist so sly.",
      "[happy] Need a rod? Bait? A tale about a three-headed sea serpent with a lisp? I've got all three! Step aboard, sprat!"
    ],
    talk: [
      { text: "[happy] HAH! Shipmate! Did I ever tell you I wrestled a lake-wyrm with one hand and ate breakfast with the other? Toast. Buttered." },
      { text: "This eyepatch? Lost the eye duelling a pirate queen. Or a sea serpent. Or a very rude gull. Depends on the weather." },
      { text: "[happy] The fish in Glimmermere are smarter than fish anywhere else. Some can count. One of 'em owes me money." },
      { text: "Patience, sprat! A good catch is like a good story. Wait for the bite, reel it in slow, and add a few feet to it after." },
      { text: "[happy] I've sailed nine seas! Well. Three seas, two lakes, and a very ambitious pond. Rounding up is a sailor's right!" },
      { text: "A rod, a worm, and a lie about the one that got away. That's all anyone needs in this life. HAH!" },
      { text: "Weather's turning. I can feel it in my knee. The one a shark bit. Lake shark. Small. Extremely angry." },
      { text: "Mooncarp bite best at dawn. Ghosteels at midnight. Lanternpike whenever they feel like being legends." },
      { text: "[happy] My hat? Won it at cards off a ghost captain! He cheated, I cheated better. He haunted me a week. Worth it!" },
      { text: "Never whistle on the dock, sprat. It calls the wind. Or the gulls. Or Pip. All three are trouble." },
      { text: "[sad] The lake's quieter than it used to be. Fewer lilies. The moonlight doesn't reach the bottom like it once did." },
      { text: "The statue in the lake? The Order's moon-lady. I tip my hat to her every morning. She's never tipped back. Rude." },
      { text: "[happy] Good grip on that rod! Natural angler! Takes after me! We're not related! Doesn't matter! HAH!" },
      { text: "Ever heard of the Crownjaw? Biggest fish in Glimmermere. Took my best hat and half my pride. I want both back." },
      { text: "Fishing teaches you two things, sprat. Patience. And how to tell a story about patience while you're being patient." },
      { text: "[sad] Morwenna bought one ghosteel a week. 'For the cat,' she said. That cat was round as a barrel. I know where those eels went." },
      { text: "[happy] Morning, sprat! Fish are biting, the mist's lifting, and I've already lied about three catches! Grand day!", when: { loc: 'lake', time: 'morning' } },
      { text: "Afternoon lull. The fish nap. So do I. With one eye open. It's the only one I've got! HAH!", when: { loc: 'lake', time: 'afternoon' } },
      { text: "Packing up the bait. Sunset on the lake's prettier than any treasure I ever stole. Er. Found. Legally.", when: { loc: 'lake', time: 'evening' } },
      { text: "Boathouse hours! Mending nets, sharpening hooks, and polishing an old sword I swear I'll never draw again. HAH! Probably.", when: { loc: 'lake', time: 'evening' } },
      { text: "[happy] Tavern time! I tell tales, Sable rolls her eyes, and everyone buys me a drink to make me stop! Works every time!", when: { loc: 'village', time: 'night' } },
      { text: "[happy] Rain! Fish come up to see what all the fuss is about! Best fishing weather there is. Worst for my hat!", when: { weather: 'rain' } },
      { text: "Mist on the water, sprat. Sailors say the dead row in the mist. Never seen 'em myself. I wave anyway. Manners.", when: { weather: 'mist' } },
      { text: "[surprised] Starfall! Some land in the lake, you know. Fish swallow 'em and glow for a week. Ask me how I know! HAH!", when: { weather: 'starfall' } },
      { text: "[happy] Full moon on Glimmermere! Water silver as a coin. Even the frogs look handsome tonight.", when: { moon: 'full' } },
      { text: "New moon. The lake goes black as ink. Something big moves down deep on nights like this. Could be the Crownjaw. Could be worse.", when: { moon: 'new' } },
      { text: "[happy] Sable and I sailed together back in the day! Sea-wyrms, tombs, terrible songs. She sang the good ones." },
      { text: "[sad] Sable built that tavern while I was off on one more voyage. One more. Always one more. Should've come home sooner." },
      { text: "Sable buys my best mooncarp every Starday. I tell her it's leftovers. She tells me she knows. Neither of us stops." },
      { text: "[happy] Brann fixes my hooks and calls my stories 'nonsense.' Then he asks how they end. Every single time!" },
      { text: "Orvyn drew me three star charts. One for navigating, one for kindling, one to wrap a mooncarp. The mooncarp got lost." },
      { text: "[happy] Pip asked if I'd ever seen a mermaid. Dozens, I said! He asked for proof. I showed him a fish. He wrote it down!" },
      { text: "Grizelda turned a pirate into a cod once! She'll tell you it was a halibut. It was a cod. He's still in the lake. Sulking." },
      { text: "Corvin comes down some nights and just stares at the water. I hand him a rod. He never catches anything. Never puts it down, either." },
      { text: "[happy] Mirabel feeds me like I'm a stray cat. I accept like one. Grateful, and slightly suspicious." },
      { text: "Elowen asked me not to fish the reed-beds where the frogs nest. I don't. She's small, but she's got a glare like a harbour storm." },
      { text: "[happy] You're alright, sprat! Most landlubbers tire of my stories by now. You just nod and ask for more! Good crew!", when: { minHearts: 3 } },
      { text: "Sometimes I tell tales so big that folk forget to ask the small questions. The small questions are the dangerous ones.", when: { minHearts: 5 } },
      { text: "[sad] Getting old, sprat. My hands shake on the line some mornings. Don't tell Sable. She'll fuss. ...She'd fuss nicely, though.", when: { minHearts: 7 } },
      { text: "[happy] You know what? Best crew I've had since Sable. And I've had parrots. Several parrots. Terrible crew, parrots.", when: { minHearts: 9 } },
      { text: "[happy] A potion-brewer! Brew me something that makes fish jump into the boat! I'll pay in stories! And glimmer! Mostly stories!", when: { flag: 'firstBrew' } },
      { text: "The Amethyst Grotto! Sable and I went there, years back. I punched a crystal golem! It punched back. We called it a draw.", when: { flag: 'depths10' } },
      { text: "[sad] The Rift. Sable and I stood at its edge once, and turned back. Best decision I ever made. And the worst.", when: { flag: 'depths40' } },
      { text: "[surprised] The lady in the lake! Her eyes are glowing, sprat! First time since I was a nipper! Nearly fell off the dock!", when: { flag: 'altar5' } },
      { text: "[happy] The Archon's sunk! HAH! Now THAT'S a tale! And for once I won't have to exaggerate a single word of it!", when: { flag: 'archonDefeated' } },
      { text: "[happy] That Elvis tells taller tales than me! Says he duelled a kraken in a teacup. A TEACUP! I've been trying to top it all week." },
      { text: "Fennick sold me a genuine kraken tooth! Pulled out by hand, mid-battle. My hand. That's how I tell it now. HAH!" },
      { text: "Seraphine's making me a window of the Crownjaw. I keep saying 'bigger.' She says it's already the biggest fish she's ever drawn." },
      { text: "[happy] Lantern Moon! I'll dance with anyone who asks! Nobody asks! Sable might. Sable won't. ...You ask me, sprat. Go on!", when: { moon: 'full', time: 'evening' } },
      { text: "Two eyepatches in one village! Gideon and I agreed never to stand side by side. It confuses the gulls. HAH!" }
    ],
    repeat: [
      "[happy] Back for another tale? I've got hundreds! Some of them even happened!",
      "HAH! Can't get enough of the Captain! Understandable!",
      "Still here, sprat? The fish won't catch themselves. Believe me, I've asked.",
      "Hush now, I'm waiting for a bite. A big one. I can feel it. ...No, that was my stomach.",
      "Twice in one day! Careful, sprat. Stories are catching."
    ],
    gift: {
      love: [
        "[surprised] {item}?! For ME? Sink me sideways! You've made an old salt very happy! HAH!",
        "[happy] Now THAT'S a gift! {item}! I'll tell everyone you wrestled it off a kraken. You did, didn't you? You did now!",
        "[happy] {item}! Shipmate, you're a treasure! A real one! Not like the fake ones I definitely never sold!"
      ],
      like: [
        "[happy] {item}! Good haul, sprat! Thank you kindly!",
        "Ah, {item}. A fine thing for a fine captain. That's me. Thanks!",
        "[happy] {item}! Going on my shelf of curiosities, right next to the mermaid's comb. It's a fork."
      ],
      neutral: [
        "{item}? Well! It's not a fish, but I'll take it! HAH!",
        "Hm, {item}. I'll trade it for a story someday. Thanks, sprat.",
        "{item}! ...What's it for? Don't tell me. I'll make something up."
      ],
      dislike: [
        "{item}? Bit dainty for an old sea-dog, sprat.",
        "[sad] Ah. {item}. I'll... use it for bait. Fish aren't picky. I am.",
        "{item}. Hm. Give it to Mirabel. She likes the delicate stuff."
      ],
      hate: [
        "[angry] {item}?! Blast and barnacles! Get that off my dock before the fish see it!",
        "[angry] {item}?! I've met krakens with better manners! Away with it!"
      ]
    },
    giftDone: [
      "[happy] Another gift? Easy, sprat! You'll capsize me with kindness!",
      "One gift a day! Captain's orders! ...I just made that up. Still counts."
    ],
    hearts: {
      2: {
        pages: [
          "[happy] Sprat! Sit down. Gather round. You're the round. Let me tell you how I REALLY lost this eye.",
          "A kraken. Forty feet long. Eyes like lanterns. It said, 'Give me your eye or your hat.' Well, I wasn't giving up the hat!",
          "[happy] ...You don't believe me. Good! Smart crew! Here, have some mooncarp. Caught this morning. Only ten feet long each."
        ],
        reward: { item: 'fish_mooncarp', qty: 2 }
      },
      4: {
        pages: [
          "Alright, sprat. A real secret. No tall tale. The Tidecaller Tonic. Mooncarp and moonlily. Drink it, and the fish come calling.",
          "[happy] Sable and I fished our way across three countries on it when we ran out of coin. Ate like royalty. Smelled like fish.",
          "Don't tell anyone where you learned it. A captain has a reputation. As a liar! The truth would ruin it! HAH!"
        ],
        reward: { recipe: 'pot_tide' }
      },
      6: {
        pages: [
          "[sad] See out there, past the statue? That's where the Crownjaw lives. Biggest fish in Glimmermere. Older than the Order, some say.",
          "I hooked it once, twenty years back. It dragged my boat clear across the lake and took my best hat as a souvenir.",
          "[happy] If you ever catch it, sprat... no. WHEN you catch it. Bring it to me. I just want to look it in the eye. The one it left me.",
          "[happy] Here. My last lanternpike. I was saving it for a special occasion. Turns out you're the occasion."
        ],
        reward: { item: 'fish_lanternpike', qty: 1 }
      },
      8: {
        pages: [
          "[sad] There's a stool at the Gilded Owl with my name carved on it. Sable had it made when she built the place. For me. For us.",
          "I came back from my voyage, saw my name carved there, and got scared, sprat. Me! Scared of a stool!",
          "[sad] So I sat at the other end. Twenty years. Easier to tell tales from far away. Harder to tell the truth up close.",
          "[happy] Here. Two meads. I was going to take them to Sable. ...Drink them yourself. I'm not ready. Someday. Maybe."
        ],
        reward: { item: 'food_mead', qty: 2 }
      },
      10: {
        pages: [
          "Sprat. Sit. No tall tales tonight. I'm going to tell you how I really lost this eye. Never told anyone. Not properly.",
          "[sad] A tomb in the far hills. The ceiling came down, and Sable was under it. I got her out. A stone got me on the way. No kraken.",
          "[sad] I've told a hundred stories since, so nobody'd ask about that one. Didn't want her carrying it. She carries it anyway.",
          "[happy] ...HAH! Look at your face! Here. Moon pearls. One for every time I nearly told her I'd do it all again. Now, let's catch a fish!"
        ],
        reward: { item: 'pearl', qty: 3 }
      }
    },
    shop: {
      greet: [
        "[happy] Welcome aboard! Rods, bait, and the finest fishing advice this side of the moon!",
        "Selling fish or buying tackle? Either way, the Captain's got you!",
        "[happy] Step up, sprat! Today's special: a worm so fat it's practically a fish!"
      ],
      bye: [
        "[happy] Tight lines, sprat! And taller tales!",
        "Fair winds! Or fair weather! Or fair fish! HAH!"
      ]
    }
  };

  // ================================================================ ELVIS
  T.npcs.elvis = {
    name: 'Elvis Marrowgold', short: 'Elvis', title: 'Barkeep of the Gilded Owl',
    bio: "The Gilded Owl's crooning barkeep: a former potion-duelist from the capital with a crimson quiff, a story for every drink, and songs he never sings.",
    intro: [
      "[happy] Well, hello there, stardust. Come in out of the dark. Mind the step. It's older than I am, and twice as dramatic.",
      "Elvis Marrowgold. Keeper of bottles, mixer of moods, crooner of ballads nobody asked for. Sable owns the Owl. I just make it sparkle.",
      "[surprised] Morwenna's apprentice? She sat right there and told me my singing 'curdled the cream.' I've never been so flattered.",
      "[happy] First drink comes with a smile. Second comes with a story. By the third, I'm singing. Choose wisely, stardust."
    ],
    talk: [
      { text: "[happy] ~ Oh, the moon came down to Hollowmere, and asked me for a dance... ~ Don't mind me, stardust. The bottles like a tune." },
      { text: "The Stardust Fizz? Invented it the night I bet a comet I could outshine it. The comet lost. Comets are terrible gamblers." },
      { text: "[happy] Moonmilk Nog was a royal secret in the capital. I liberated it. The recipe, not the royal. The royal stayed put. Mostly." },
      { text: "Dragonbreath Cider. A real dragon was involved. A small one. It sneezed into a barrel and the brewer wept for joy. No eyebrows, mind." },
      { text: "Frostberry Spritz: for when your heart is warm and your feet are tired. Or the other way round. I don't judge, stardust." },
      { text: "Mistwine is fog from the Ridge, aged in a cellar that used to be a crypt. It's lucky. The ghosts insist, and who am I to argue?" },
      { text: "Hollowroot Stout. Brewed from a root that grew in a giant's footprint. The giant never came back for it. Their loss, stardust." },
      { text: "The capital? Lovely place. Marble fountains, gilded duelling halls. I'm not allowed within forty miles of either. Long story." },
      { text: "[happy] They called me the Crimson Duelist. Seven goblets, seven wins, one very public misunderstanding. And that's all I'm saying." },
      { text: "[surprised] The scandal? Stardust, please. There was a chandelier, a duchess, a goat and a startled orchestra. The rest is sealed by decree." },
      { text: "A good barkeep is a lighthouse with a towel over one shoulder. Stay lit, stay polished, and never ask where the ship has been." },
      { text: "[happy] Everyone who walks through that door is stardust. Some of us just take longer to remember we're shining." },
      { text: "This earring? A tiny silver star, from someone I'll tell you about in a song. A song I'll never sing. Next question!" },
      { text: "Every bottle on that shelf has a story. Half of them are true. The other half are better." },
      { text: "I carry a towel, a corkscrew and a clean handkerchief at all times. One for spills, one for corks, one for poets." },
      { text: "[sad] Morwenna came in every Emberday for one mead and one insult. I still pour the mead. Nobody does the insult like she did." },
      { text: "[happy] Morning, stardust. The bottles are still yawning. Give me a minute to wake the glasses and warm up my vowels.", when: { loc: 'tavern', time: 'morning' } },
      { text: "Quiet afternoon. I polish the glasses and croon to them. They shine brighter when serenaded. That's science. Ask Pip.", when: { loc: 'tavern', time: 'afternoon' } },
      { text: "[happy] Shh, stardust. Sable's about to sing. When she takes that stage, even the fire leans in to listen.", when: { loc: 'tavern', time: 'evening' } },
      { text: "Last orders, stardust. ~ Goodnight, moon, I'll leave the lamp on... ~ I hum that one at closing. It works on Brann.", when: { loc: 'tavern', time: 'night' } },
      { text: "[happy] Rain! Wet boots, warm hearts, full tables. On nights like this I could sing the whole songbook. Don't tempt me.", when: { weather: 'rain' } },
      { text: "Mist always reminds me of the capital harbour. Lamps like pearls, and every stranger a possible duel. I miss none of it. Almost none.", when: { weather: 'mist' } },
      { text: "[surprised] A starfall! Quick, stardust, make a wish. I'll make one too. Mine's the same every year. It's a secret.", when: { weather: 'starfall' } },
      { text: "[happy] Full moon! Mistwine sells out, the Captain tells the kraken story, and Grizelda dances at the ring. Big night, stardust.", when: { moon: 'full' } },
      { text: "[sad] New moon. Delvers come in quiet and leave quieter. I pour them something warm and don't ask. That's the job.", when: { moon: 'new' } },
      { text: "[happy] Sable found me on her doorstep in the rain. One boot, no prospects. She handed me an apron. I'd walk into the Depths for her." },
      { text: "[angry] Anyone who gives Sable trouble gets my very best smile, and then the door. I was a duelist, stardust. I still know my footwork." },
      { text: "Captain Lune claims to have wrestled a kraken. I once duelled one. In a teacup. Different scale, same principle." },
      { text: "Brann wants a mug, not a story. So I give him a mug, and the story arrives anyway. He's never once noticed." },
      { text: "Orvyn ordered a drink 'that tastes like the moon.' I gave him a glass of water and a long silence. He wept. Best review I've had." },
      { text: "[happy] Pip asked for a Stardust Fizz. I made him a Stardust Fizzlewick: lemonade, a pinch of glitter, no fizz. He swooned." },
      { text: "Mirabel feeds me like I'm a stray. I let her. A man who refuses Mirabel's pie has learned nothing from life." },
      { text: "Corvin orders black coffee and doesn't drink it. I bring him a fresh one every hour. Neither of us says a word. It's beautiful." },
      { text: "Isolde says my bow tie is 'almost forgivable.' From Isolde, stardust, that's a standing ovation." },
      { text: "Seraphine held my bottles up to the moon window and said the light 'remembered a prayer.' I gave her the whole shelf." },
      { text: "Fennick sold me a portrait of the Crimson Duelist. Of ME. 'Authentic capital memorabilia.' I bought it. Obviously." },
      { text: "[happy] Moon Pudding, stardust. Cream, starlight and a spoonful of nonsense. Eat it slowly. It's the only way it'll forgive you." },
      { text: "Jumping Jellies! Fizzy little fellows that wriggle on the plate. Catch one if you can. They're shy, but delicious." },
      { text: "[happy] You're a regular now, stardust. Regulars get my second-best smile. The best one's saved for Sable's opening number.", when: { minHearts: 3 } },
      { text: "I write songs, you know. Love songs. Pages of them. Never sung a single one. Don't look at me like that. Some things keep better unsung.", when: { minHearts: 5 } },
      { text: "[sad] I left the capital in the middle of the night with one boot and a broken heart. Got a new boot here. Still working on the heart.", when: { minHearts: 7 } },
      { text: "[happy] I've been a duelist, a scandal and a rumour. Here I'm just Elvis. You've no idea how good that is, stardust.", when: { minHearts: 9 } },
      { text: "[surprised] A fellow brewer! Careful, stardust. In the capital, brewing led to duelling, and duelling led to... well. Look at me.", when: { flag: 'firstBrew' } },
      { text: "Heading for the Catacombs? Then you want a Hollowroot Stout. Tastes like a cellar's bad mood, but your skin forgets it's soft.", when: { flag: 'depths25' } },
      { text: "[happy] The Sanctum shines again, stardust. I invented a cocktail in your honour. It glows. Nobody can drink it yet. I'm working on that.", when: { flag: 'altar3' } },
      { text: "[happy] You beat the Archon! Drinks on the house! ...Don't tell Sable I said that. Drinks on me, then. Same thing, smaller house.", when: { flag: 'archonDefeated' } },
      { text: "[happy] Lantern Moon, stardust! I've a stall in the plaza tonight. Stardust Fizz by lantern light. Dancing optional. Swooning likely.", when: { moon: 'full', time: 'evening' } },
      { text: "[happy] Laura orders a Dragonbreath, extra smoke. I call it 'the Vex.' She pretends to hate the name. She tips beautifully." },
      { text: "Gideon drinks one Hollowroot Stout a night and tells the same war story. I harmonise. He hasn't noticed yet." }
    ],
    repeat: [
      "[happy] Back so soon, stardust? The bar missed you. I told it to play it cool.",
      "Twice in a day! I'll start you a tab. Of conversations.",
      "~ Round and round the bottles go... ~ Oh, you're still here. Lovely.",
      "[happy] Another visit? Careful, stardust. I'll write a song about you, and then where will we be?",
      "Can't chat, I'm mid-pour. A great drink is like a great entrance. It's all in the timing."
    ],
    gift: {
      love: [
        "[surprised] {item}? For me? Stardust, you've stopped my heart. Briefly. Theatrically. There, it's started again. Thank you.",
        "[happy] Oh, {item}! I could kiss your hand. I won't. Sable says I do that too much. But I could.",
        "[happy] {item}! Nicest thing anyone's given me since the capital gave me a head start. Ha! Thank you. Truly.",
        "[happy] {item}... You've got taste, stardust. Exquisite, dangerous taste. Never change."
      ],
      like: [
        "[happy] {item}! Lovely. That'll end up in a drink, and the drink will end up in a song.",
        "Ooh, {item}. Thank you, stardust. I know just the bottle for it.",
        "[happy] {item}! A fine gift for a fine barkeep. Fine, fine, fine."
      ],
      neutral: [
        "{item}? Well. Every gift's a little mystery, stardust. I'll solve this one later.",
        "Thank you! {item}. It goes behind the bar, where all the best mysteries live.",
        "{item}. Hm! It's not a song, but it's not nothing."
      ],
      dislike: [
        "{item}? Oh, stardust. That's a gift with no encore.",
        "[sad] {item}. I'll keep it under the bar. Deep under. Next to my regrets.",
        "{item}... I'll smile, because I'm a professional."
      ],
      hate: [
        "[angry] {item}! Not behind my bar! The bottles are watching, and they're scandalised!",
        "[angry] Stardust, no. I have survived a scandal, but I cannot survive {item}."
      ]
    },
    giftDone: [
      "[happy] Another gift? Stardust, you'll spoil me. Save it for tomorrow's encore.",
      "One gift a day, stardust. Any more and I'll have to sing about it."
    ],
    hearts: {
      2: {
        pages: [
          "[happy] Stardust! Sit. Watch the hands. Violet, a twist of gold, a pinch of fallen star... and HUP!",
          "[surprised] There! The Stardust Fizz. It sparkles, it fizzes, and for three minutes your feet forget they were ever tired.",
          "I invented it the night I bet a comet I could outshine it. Crowd of thousands. The comet sulked for a century.",
          "[happy] ...Fine. The crowd was eleven. And one goat. Take these, stardust. Fizz responsibly. Fizz magnificently."
        ],
        reward: { item: 'drink_fizz', qty: 3 }
      },
      4: {
        pages: [
          "[surprised] Ah. You found the playbill. 'THE CRIMSON DUELIST. UNDEFEATED.' Look at that quiff. Look at that cheekbone.",
          "[happy] Seven goblets, seven duels, the capital at my feet. Then one night: a chandelier, a duchess, a goat, and an orchestra in shock.",
          "No, stardust. That's all you get. Some stories are better with the ending left in the bottle.",
          "[happy] But take this. My old duelling waistcoat. It hasn't fit me since the scandal. Or before. Wear it like you've won something."
        ],
        reward: { item: 'cl_outfit_duelist', qty: 1 }
      },
      6: {
        pages: [
          "[angry] Friend. You just called the finest voice in this valley 'too loud.' You'll apologise to the lady. Now, while I'm still smiling.",
          "[happy] ...There. Gone, and he paid. Sorry, stardust. Old reflexes. Duelists never draw first. But we do draw.",
          "[sad] Sable found me on her step in the rain, years ago. One boot. No name worth using. She gave me an apron and never asked a thing.",
          "[happy] So nobody insults her. Not in my bar. Here, a duelist's secret: the Thornhide Draught. For when the world swings first."
        ],
        reward: { recipe: 'pot_thornhide' }
      },
      8: {
        pages: [
          "[surprised] Stardust! That's... my songbook. From under the bar. You weren't meant to... no. It's alright. Sit down.",
          "[sad] Love songs. Fifteen years of them. All for someone who waited for me by a fountain in the capital. I never went back.",
          "If I sing them, they're finished. If they're finished, so is the waiting. So I write, and I pour, and I don't sing.",
          "[sad] This locket was meant for them. I can't look at it, and I can't throw it in the lake. Will you keep it? Somewhere kind?"
        ],
        reward: { item: 'relic_locket', qty: 1 }
      },
      10: {
        pages: [
          "[happy] Stardust. Tonight, sit at the front. Sable's lent me her stage. Don't ask why. I've lost my nerve twice already.",
          "[sad] ~ I left my heart by a fountain, in a city made of stone... I went looking for an ending, and I found my way home... ~",
          "[surprised] ...They're clapping. Sable's crying. Brann's crying, and swearing it's soot. Fennick's selling tickets. Ha!",
          "[happy] I won this Star Fragment in my very last duel. It's glowed for me every night since. Time it glowed for you. Thank you, stardust."
        ],
        reward: { item: 'relic_star', qty: 1 }
      }
    },
    shop: {
      greet: [
        "[happy] Welcome to the bar, stardust! Fizz, nog, cider, spritz, stout or something misty. Every glass comes with a story.",
        "What'll it be? Name your mood and I'll name your drink. Name your price and I'll name a song.",
        "[happy] Ah, a connoisseur. I can tell by the way you're looking at the shelves. Hungrily. Beautifully."
      ],
      bye: [
        "[happy] Drink slowly, stardust. Shine brightly.",
        "Off you go! Mind the step. It's dramatic."
      ]
    }
  };

  // ================================================================ ISOLDE
  T.npcs.isolde = {
    name: 'Isolde Quillon', short: 'Isolde', title: 'Proprietor of Threads & Tomes',
    bio: "Sharp-tongued owner of Quillon's Threads & Tomes and former costumer to a travelling opera, who judges your outfit and secretly adores you.",
    intro: [
      "[surprised] Stop. Don't move. Let me look at you. ...Mm. Mud, soot, and a robe that has seen things. Tragic. Promising, but tragic.",
      "[happy] Isolde Quillon. Threads and tomes. I dressed sopranos for twenty years. I can certainly dress a gardener of moons.",
      "That's Quill on the ladder. He's a crow. He steals buttons and judges posture. Stand up straight, my moth. He's watching."
    ],
    talk: [
      { text: "That robe. Is it a robe, my moth, or a cry for help? Don't answer. Clothes always tell me first." },
      { text: "[happy] A good coat is like a good novel. Dark lining, sharp collar, and a secret in the inside pocket." },
      { text: "I've just finished 'The Widow of Wyrmsday Manor.' Chapter nine: a ghost, a will and a wedding. Exquisite. I wept into my tea." },
      { text: "In the opera we had a saying: if the hem is wrong, the aria is wrong. I have been right about hems for thirty years." },
      { text: "[angry] Somebody tried on the Raven Cloak and sneezed into it. I know who. I always know who. Quill told me." },
      { text: "Black is not a colour, my moth. It's a decision." },
      { text: "[happy] Look at the dust motes in the lamplight. Little dancers who never rehearse. I adore this shop at four o'clock." },
      { text: "Books on the left, clothes on the right, judgement throughout. Do browse." },
      { text: "Hats are punctuation. A beret is a comma. A witch's hat, an exclamation mark. A top hat is a full stop with ambitions." },
      { text: "I measure everyone who walks in. I can't help it. You're a forty-one and a half, by the way. Don't ask what that means." },
      { text: "[happy] Quill brought me a brass button yesterday. He took it from Brann's apron. I'm keeping it. Don't tell Brann." },
      { text: "Gothic novels teach you everything. Check the portrait's eyes. Never read the last letter aloud. Never trust a cheerful butler." },
      { text: "[sad] The travelling opera folded ten years ago. I kept the costumes. Some nights I dress the forms and pretend it's opening night." },
      { text: "Moths eat wool. I wear a moth on my lapel to remind them who's in charge." },
      { text: "[surprised] Is that a mud stain shaped like a crescent? How very on theme. I'll allow it." },
      { text: "[sad] Morwenna bought one hat from me in ten years. A dreadful brown thing. She wore it every single day. I've never been prouder." },
      { text: "Morning, my moth. The ladders creak, the books sigh, the till sulks. A shop is an orchestra, warming up.", when: { loc: 'boutique', time: 'morning' } },
      { text: "[happy] Afternoon light is the most honest light. Come and stand by the mirror. Closer. Ah. Yes. We have work to do.", when: { loc: 'boutique', time: 'afternoon' } },
      { text: "Closing soon. I'll read by the lamp with Quill. He prefers the poetry. Crows are terrible romantics.", when: { loc: 'boutique', time: 'evening' } },
      { text: "[happy] Rain. People come in to dry off and leave with a new hat. It's practically a public service.", when: { weather: 'rain' } },
      { text: "Mist is the gothic novelist's favourite weather. Somewhere out there, a governess is opening a door she really shouldn't.", when: { weather: 'mist' } },
      { text: "[surprised] Stars falling! If one lands on my roof, I'm making a gown of it. Don't tell Seraphine. She'll want it for a window.", when: { weather: 'starfall' } },
      { text: "Full moon. The moths gather at the window to look at the coats. Window-shopping, for moths.", when: { moon: 'full' } },
      { text: "New moon. Dark nights demand dark velvet. I've put the midnight cloaks in the window.", when: { moon: 'new' } },
      { text: "Sable has the finest cheekbones in the valley and hides them behind a bodice from twelve years ago. I've told her. She laughs." },
      { text: "[happy] Elvis's bow tie is almost forgivable. His waistcoat is a triumph. His singing is a matter for his conscience." },
      { text: "Mirabel's shawl is a crime against wool. I have offered to replace it eleven times. She says it's 'perfectly good.' It is not." },
      { text: "Pip came in asking for 'a lab coat with explosion pockets.' I'm making him one. Fireproof lining. Don't tell Mirabel the price." },
      { text: "Brann won't wear a waistcoat. I've measured him anyway. It'll be waiting when he changes his mind. They always change their minds." },
      { text: "[happy] Orvyn's hat is magnificent and a fire hazard, in equal measure. I wouldn't change a thing. Except the hem. And the stars." },
      { text: "Elowen brought me Quill, years ago. A crow with a broken wing, in a basket of moss. She didn't say a word. She didn't have to." },
      { text: "Grizelda's hat is a crime and a masterpiece. I once offered to buy it. She cackled for a full minute." },
      { text: "Corvin's coat is the finest in the valley. I made it. He thinks he found it at a fair. Let him." },
      { text: "The Captain's coat is teal. TEAL. On a sea captain. It's so wrong it's right. Like a bad libretto with a perfect final act." },
      { text: "Seraphine gets glass glitter on everything. My counter sparkles for days. I've stopped minding. It suits the books." },
      { text: "Fennick sold me a 'genuine opera cape from the capital.' It was a tablecloth. A very good tablecloth. I hemmed it. I wear it on Sundays." },
      { text: "[happy] You're starting to dress like someone who knows who they are. Or someone who listens to me. It's the same thing.", when: { minHearts: 3 } },
      { text: "I read the last page of every novel first. I like to know who survives. Don't tell a soul. It's my only weakness.", when: { minHearts: 5 } },
      { text: "[sad] I made a gown for an opening night that never came. It's upstairs. Some dresses are just ghosts waiting for a stage.", when: { minHearts: 7 } },
      { text: "[happy] You're the best-dressed person in Nightvale, my moth. Second best. After me. A close second. Uncomfortably close.", when: { minHearts: 9 } },
      { text: "You've brewed a potion. Lovely. Kindly don't spill it on the merchandise. Velvet holds a grudge.", when: { flag: 'firstBrew' } },
      { text: "[surprised] You went into the Depths in THAT? Next time, wear something lined. Monsters can smell a cheap seam.", when: { flag: 'depths10' } },
      { text: "The Sanctum glows at night now. Quill sits on the sill and stares at it. I think he's in love. So are half the moths.", when: { flag: 'altar3' } },
      { text: "[happy] So, you've saved the valley. Excellent. Now you'll need something to wear to the celebration. Come here. Arms up.", when: { flag: 'archonDefeated' } },
      { text: "Lantern Moon. I've dressed half the village for the dance. The other half refused. I'll be at my stall, judging them.", when: { moon: 'full', time: 'evening' } },
      { text: "Laura's fishnets are a choice. A bold, correct choice. I've sold her three more pairs." },
      { text: "Jasmine's cardigan is cream, hand-knitted, with a tiny bee on it. I'd call it too sweet, but I haven't the heart." }
    ],
    repeat: [
      "Back again? Quill, look, they're back. He's thrilled. You can tell by the stillness.",
      "[happy] Twice in one day. Either you need a hat, or you need me. Both are acceptable.",
      "I'm in chapter twelve, my moth. Someone has just opened the tower door. Come back later.",
      "Still here? Then stand up straight. Shoulders. Chin. There."
    ],
    gift: {
      love: [
        "[surprised] {item}. For me? My moth. I'm speechless. That has happened twice in my life. Both times today.",
        "[happy] {item}! Exquisite. Gothic. Perfect. You've been paying attention, and I adore people who pay attention.",
        "[happy] Oh, {item}. That's a gift with a story inside it. I can feel it. Thank you, truly."
      ],
      like: [
        "[happy] {item}. Tasteful. I approve.",
        "Ah, {item}. That will find its way into a costume. Everything does, eventually.",
        "[happy] {item}! Thank you, my moth. Quill approves too. That's a nod. He's nodding."
      ],
      neutral: [
        "{item}. Hm. Not my colour, but the gesture is beautifully cut.",
        "Thank you. {item} can sit on the shelf and think about what it's done.",
        "{item}? How... practical. I'll find it a hat."
      ],
      dislike: [
        "[angry] {item}? Near the velvet? Have you no mercy?",
        "[sad] {item}. My moth. We need to talk about your taste.",
        "{item}. I'll put it outside for the crow. He'll be offended too."
      ],
      hate: [
        "[angry] {item}! Get it out before the books absorb the smell. Books never forget, my moth. Never.",
        "[angry] {item}?! This is a boutique, not a bog. Out. OUT."
      ]
    },
    giftDone: [
      "One gift a day, my moth. Restraint is the soul of elegance.",
      "[happy] You've already given me something. Another would be too much, and I adore too much, so stop."
    ],
    hearts: {
      2: {
        pages: [
          "[angry] Stand still. Arms out. No, don't talk. Talking changes your shoulders. I'm measuring you.",
          "Hm. Hm! Your left side is braver than your right. Interesting. Most people are the other way round.",
          "[happy] There. A Velvet Beret, plum, with a gold pin. Made for your head and nobody else's. Wear it tilted. Always tilted."
        ],
        reward: { item: 'cl_hat_beret', qty: 1 }
      },
      4: {
        pages: [
          "[happy] Come upstairs, my moth. Mind the trunk. This is the costume store of the Silver Lantern Opera. What's left of it.",
          "Twenty years of sopranos, villains and dancing moons. I sewed every sequin. My fingers still remember the stitches.",
          "[sad] The troupe broke up in the rain, in a town with no name. I kept the trunks. Somebody had to remember the music.",
          "[happy] Take this Midnight Cloak. It was the Night Queen's. She'd want it to see a real night, under a real moon."
        ],
        reward: { item: 'cl_cloak_midnight', qty: 1 }
      },
      6: {
        pages: [
          "[angry] QUILL. Give that back. That is a customer's button. ...Oh, it's yours, my moth? Then he likes you. That's how crows say it.",
          "Elowen brought him to me, years ago. Broken wing, furious, in a basket of moss. She said I needed company. She was right. Don't tell her.",
          "[happy] He insists you take something from his hoard. Crows pay their debts. An old lunar coin. He's very proud of it."
        ],
        reward: { item: 'relic_coin', qty: 1 }
      },
      8: {
        pages: [
          "[sad] Come upstairs. The gown on the form. Moonweave silk, three hundred beads. For an opening night that never came.",
          "The soprano married a fisherman and moved to the coast. A happy ending. Just not for the gown.",
          "[happy] So I made you something from the leftover silk. Robes. Try them in the mirror. ...There. That's what I meant all along.",
          "[sad] Some clothes are waiting for a stage, my moth. Those were waiting for you."
        ],
        reward: { item: 'cl_outfit_moonweave', qty: 1 }
      },
      10: {
        pages: [
          "[happy] My moth. I haven't taken a commission in ten years. I've just taken one. From myself. For you.",
          "The Silver Veil Mantle. Moonlight lining, cathedral silver, and a collar sharp enough to end an argument.",
          "[sad] Every costume I ever made walked away into someone else's story. This one I made for a story I'm part of. Do you see the difference?",
          "[happy] Now go and let the valley see you in it. And stand up straight. Quill and I will be watching from the window."
        ],
        reward: { item: 'cl_cloak_silver', qty: 1 }
      }
    },
    shop: {
      greet: [
        "[happy] Welcome to Threads and Tomes, my moth. Clothes on the racks, novels on the shelves, opinions at the till.",
        "Come in, come in. Something in plum? Something in midnight? Something that isn't THAT?",
        "[happy] Ah. A customer with potential. Try the mirror. Then try everything else."
      ],
      bye: [
        "[happy] Wear it well, my moth. Or don't. I'll know either way.",
        "Off you go. Mind the ladder, and mind your posture."
      ]
    }
  };

  // ================================================================ SERAPHINE
  T.npcs.seraphine = {
    name: 'Seraphine Vell', short: 'Seraphine', title: 'Keeper of the Silver Veil',
    bio: "Glassmaker and keeper of the Cathedral of the Silver Veil, who mends one window pane a year and believes the glass remembers the Order's prayers.",
    intro: [
      "[happy] Oh, welcome. Step into the light, there, where the blue falls. It suits you. Blue suits nearly everyone. Green is pickier.",
      "I'm Seraphine. I keep the Cathedral of the Silver Veil, and I mend its windows. One pane a year. Glass doesn't like to be hurried.",
      "Pray at the Veil Altar, if you like. Once a day. The windows remember every prayer ever said in here. I think they'll like yours."
    ],
    talk: [
      { text: "Every colour is just light that decided what it wanted to be. Red was brave. Violet took its time." },
      { text: "[happy] There's rainbow glitter on my freckles. Glass dust. It never comes off. I've stopped trying. It makes Pip happy." },
      { text: "The windows remember the Order's prayers. On still mornings, if you stand very quietly, the colours hum. Listen." },
      { text: "There are three hundred and twelve panes. I mend one a year. By my count, I'll finish when I'm three hundred and forty-two." },
      { text: "Patience is just hope that has learned to sit down." },
      { text: "Glass is sand that went through a fire and came out clear. I find that comforting. Most things do come out clear, eventually." },
      { text: "[happy] Look at the floor. The windows paint it all day. Everyone walks on the painting. It doesn't mind. It just paints again." },
      { text: "I keep a loupe on a chain. Tiny things matter, up close. A bubble in old glass is a breath someone held three hundred years ago." },
      { text: "[sad] Some panes are lost for good. I leave those clear. Not every gap should be filled. Some should let the sky in." },
      { text: "The reflecting pools double every colour. Two windows for the price of one. The Order was very thrifty with its miracles." },
      { text: "Candles are little patient suns. I light forty every evening, and I talk to them. Very good listeners. Excellent posture." },
      { text: "[happy] People come here to be quiet. Then they find out how loud quiet is. Then they come back." },
      { text: "The potted tree in the nave is a cutting from the Sanctum garden. It grew toward the windows. Toward the moon, really." },
      { text: "My old master in the south only spoke in colours. 'Amber,' he'd say, when he meant tea. 'Crimson,' when I'd broken something." },
      { text: "Lead holds the glass together, and nobody admires the lead. I admire the lead. Someone has to." },
      { text: "[sad] Morwenna came here sometimes. She'd sit by the blue window and grumble at it. She said it reminded her of someone stubborn." },
      { text: "[happy] Morning light comes through the east windows first. Gold, then rose, then everything. Like a choir tuning up.", when: { loc: 'cathedral', time: 'morning' } },
      { text: "In the afternoon the light is lazy and long. Stay a moment. Let it lie across you like a cat.", when: { loc: 'cathedral', time: 'afternoon' } },
      { text: "Evening. The windows go deep and jewelled. This is when they remember hardest. I light the candles so they're not alone.", when: { loc: 'cathedral', time: 'evening' } },
      { text: "At night the moon comes through the rose window and paints the pool silver. I sleep less than I should.", when: { loc: 'cathedral', time: 'night' } },
      { text: "[happy] Rain on the windows. Every pane becomes a little river of colour. The best show in the valley, and it's free.", when: { weather: 'rain' } },
      { text: "Mist makes the windows glow from the inside, like lanterns. As if the cathedral were thinking.", when: { weather: 'mist' } },
      { text: "[surprised] A starfall! Bring me a shard, if you find one? Starshard glass sings when the light goes through it. Truly.", when: { weather: 'starfall' } },
      { text: "[sad] New moon. The windows are dark tonight. That's alright. Glass doesn't need light to be beautiful. It only needs to wait.", when: { moon: 'new' } },
      { text: "[happy] Lantern Moon tonight! I've put a candle in every window. From the plaza, the whole cathedral looks like it's smiling.", when: { moon: 'full', time: 'evening' } },
      { text: "Orvyn says I talk about light the way he talks about stars. He's right. We're both in love with things that arrive late." },
      { text: "[happy] Pip asked if he could lick a window to taste the colours. I said no. I've since found smudges at exactly Pip height." },
      { text: "Elvis gave me a Stardust Fizz to hold up to the light. It made a little galaxy on the wall. Then I drank it. For science." },
      { text: "Isolde says my apron is 'a tragedy with pockets.' Then she sewed new pockets into it. I've never felt so understood." },
      { text: "Mirabel grinds moonpetals for me. Their dust makes the palest blue glass in the world. She won't take payment. She takes gossip." },
      { text: "[sad] Corvin lights a candle here every week. He never says for whom. I keep it burning. I know for whom." },
      { text: "Elowen sings to the potted tree when she thinks nobody's here. I'm always here. I pretend I'm not. It's a lovely song." },
      { text: "Brann made the iron frames for the new panes. He said 'Hm.' I said 'Thank you.' He went red. We understand each other." },
      { text: "Grizelda came in once, stood in the green light, and said 'Ugh. Holy.' Then she stayed for an hour." },
      { text: "Sable sings in here sometimes, after the tavern closes. The echo is kind to her. So is she, to it." },
      { text: "Fennick sold me a 'stained-glass window.' It was a painted plate. I bought it anyway. It's very cheerful." },
      { text: "The Captain wants a window of the Crownjaw. 'Bigger,' Lune keeps saying. It's already the biggest fish I've ever drawn." },
      { text: "[happy] You stand still in the light now. Most people hurry through it. You let it land. I noticed.", when: { minHearts: 3 } },
      { text: "I'm afraid of ladders, and I mend windows thirty feet up. Courage isn't not being afraid. It's bringing a very good ladder.", when: { minHearts: 5 } },
      { text: "[sad] Some nights I wonder if I'll ever finish the windows. Then I remember that cathedrals aren't finished. They're handed on.", when: { minHearts: 7 } },
      { text: "[happy] When the light comes through and finds you, it looks as if it was waiting for you specifically. I think it was.", when: { minHearts: 9 } },
      { text: "You brewed a potion! Hold it up to the window. ...Look. Your work has a colour now. It's yours.", when: { flag: 'firstBrew' } },
      { text: "[sad] The Abyssal Rift. The Order's last window shows that dark. I've never been able to mend it. Maybe once you come back.", when: { flag: 'depths40' } },
      { text: "[happy] All five offerings! The windows are brighter. All of them, even the ones I haven't mended. I don't understand it. I love it.", when: { flag: 'altar5' } },
      { text: "[happy] The moon is bright again. The rose window is so full of light I had to sit down. I think it was saying thank you.", when: { flag: 'archonDefeated' } },
      { text: "Amara and I talk about refraction for hours. She brings diagrams, I bring tea. The best friendship I've had in years." },
      { text: "Ronan made new lead for the windows, rune-etched. The glass hums differently now. Kinder." }
    ],
    repeat: [
      "[happy] Back again? The light has moved a little since you left. Come and see.",
      "Still here? Good. Cathedrals are for staying.",
      "I'm in the middle of a pane. Talk to the windows for a while. They're better company than me. Quieter.",
      "[happy] Twice in one day. The candles are pleased. So am I."
    ],
    gift: {
      love: [
        "[surprised] {item}... Oh. Look how it holds the light. You've brought me a little window. Thank you.",
        "[happy] {item}! I'll set it where the morning sun can find it. Then I'll sit and watch it for far too long.",
        "[happy] {item}. You chose this thinking of light, didn't you? I can tell. That's the kindest kind of gift."
      ],
      like: [
        "[happy] {item}. Lovely. It'll catch the evening light beautifully.",
        "Oh, {item}. Thank you, truly. I know just the windowsill.",
        "[happy] {item}! The candles approve. They flickered. That's approval."
      ],
      neutral: [
        "{item}. Thank you. Everything has a colour, if you hold it to the window long enough.",
        "Oh, {item}. How thoughtful. I'll find it a place in the light.",
        "{item}? Thank you. It isn't glass, but then, very little is."
      ],
      dislike: [
        "[sad] {item}. Oh. It's a very... shadowy gift.",
        "{item}. I'll keep it by the door. It doesn't quite belong in the light.",
        "[sad] {item}. The windows went a little dim just now. Probably a cloud. Probably."
      ],
      hate: [
        "[angry] {item}... please, not in here. The windows have seen enough darkness.",
        "[sad] I can't keep {item} in the cathedral. Some things eat light. I'm sorry."
      ]
    },
    giftDone: [
      "[happy] You've already given me a gift today. Let's not overwhelm the windowsill.",
      "One a day is perfect. Like one pane a year. Slowly, things become beautiful."
    ],
    hearts: {
      2: {
        pages: [
          "[happy] Come and sit on the step with me. I've made tea. Look at the floor. The blue window is painting your boots.",
          "I come out here every afternoon to watch the colours walk across the nave. Nobody else bothers. You did.",
          "[happy] Here, take the rest of the tea. Starleaf. It tastes better in coloured light. Most things do."
        ],
        reward: { item: 'food_tea', qty: 2 }
      },
      4: {
        pages: [
          "I want to teach you something the Order knew. Light can be carried. Bottled. Sent ahead of you into the dark.",
          "Wisp essence and a glowcap make a Wisplight Tonic. Your light reaches further, as if the dark has stepped back to look at you.",
          "[happy] I brew it before I climb the bell tower at night. You'll need it more than I do. Down there."
        ],
        reward: { recipe: 'pot_wisplight' }
      },
      6: {
        pages: [
          "[happy] Will you hold the ladder? Today's pane is ready. A small one, from the second window. A moon over water.",
          "[surprised] ...Did you hear that? When the lead set. A hum, like voices far away. The windows remember the prayers. I told you.",
          "[sad] It sounded like someone praying for a stubborn friend to rest well. I think it's new. I think it's for Morwenna.",
          "[happy] These moonstones were hidden in the old lead. The Order tucked them into the frames for luck. Take them. The luck wants to move."
        ],
        reward: { item: 'moonstone', qty: 2 }
      },
      8: {
        pages: [
          "[sad] Can I tell you something? I count the panes at night. Three hundred and twelve. I'll never finish. I know I'll never finish.",
          "Then I think: the Order never finished either. They just handed it on. Someone handed it to me.",
          "[happy] So I've stopped counting. Now I just mend. One pane, one year, one light at a time.",
          "[happy] Take these emeralds. Green glass needs real emerald dust, and I've saved these for years. I'd rather you kept them shining."
        ],
        reward: { item: 'emerald', qty: 2 }
      },
      10: {
        pages: [
          "[happy] Close your eyes and walk with me. Mind the step. ...Now look up. This year's pane.",
          "It's you. Under the moon, in the Sanctum garden, with a black cat at your feet. The windows remember. Now they'll remember you.",
          "[sad] I've never put a living person in the glass. The Order only kept saints and stars. I think they'd make an exception.",
          "[happy] And this. A phoenix feather I found in the bell tower. Something burned bright here, and came back. It made me think of you."
        ],
        reward: { item: 'relic_feather', qty: 1 }
      }
    },
    shop: {
      greet: [
        "[happy] Welcome. Candles, coloured glass, and a little light to carry home. Take your time. Light always does.",
        "Come in, come in. Everything here has spent time near the windows. It's all a little brighter for it.",
        "[happy] Hello again. The blue window has been asking after you. Well. It's been very blue at you."
      ],
      bye: [
        "[happy] Go gently. Carry the light carefully.",
        "Come back when the evening light is in. It's my favourite time to see people."
      ]
    }
  };

  // ================================================================ FENNICK
  T.npcs.fennick = {
    name: 'Tobias Fennick', short: 'Fennick', title: 'Wandering Merchant',
    bio: "A cheerful, mostly honest wandering merchant who turns up somewhere new every few days with a bulging pack, a monocle and a pair of dice.",
    intro: [
      "[surprised] Aha! A face I haven't sold anything to yet! Tobias Fennick: wandering merchant, purveyor of the rare, the odd and the slightly haunted!",
      "[happy] Everything in this pack is genuine, friend. Mostly. Ninety-four percent. Ninety-five on Sundays, when I'm feeling holy.",
      "I turn up wherever the road takes me, every few days. Look for the hat with all the pins. And if you're brave, ask about the dice!"
    ],
    talk: [
      { text: "[happy] Roll up, roll up! Rare goods for rare folk! Today's special: whatever I've got! Tomorrow's: whatever I've got left!" },
      { text: "This monocle belonged to a duke. Or a duke's butler. Or a butler's duck. The history gets wobbly around the third owner." },
      { text: "Every pin on this hat is a town I've sold something in. Some asked me back. Some have since moved the town." },
      { text: "[happy] Dice, friend? Two little cubes of fate! Win, and you laugh! Lose, and I laugh! Either way, somebody's laughing!" },
      { text: "A merchant's three rules: smile first, haggle second, and never sell anything that's still moving. Unless it's jellies." },
      { text: "'Mostly honest,' they call me. I'm proud of it. 'Mostly' is a great deal more than most." },
      { text: "This scarf is longer than some roads I've walked. My sister knitted it. 'So you'll have something warm on the way home,' she said." },
      { text: "[happy] I once sold a single sock to a king. He wanted the pair. I said 'Majesty, that's what makes it rare!' He bought two." },
      { text: "The road's been good to me, friend. Long, mostly dry, occasionally haunted. I've had worse colleagues." },
      { text: "[surprised] Is that a moth on your sleeve? No, lint. Want a lint brush? It's also a comb. And a back scratcher. And a gift!" },
      { text: "Odds, friend, are just the universe's way of keeping things interesting. I've lost to them plenty. Never once been bored." },
      { text: "[happy] Best thing I ever sold? A treasure map. Best thing I ever bought? The same map, back, for twice the price. Long story." },
      { text: "[sad] Some days nobody buys a thing. Those days I sit on my pack and watch the clouds. They do a roaring trade in shapes." },
      { text: "My grandfather's up on the Ridge. Tobias Fennick the Elder. Said the bridge would hold. It did! He tripped on the way back." },
      { text: "Never trust a merchant who says 'trust me.' Trust me on that." },
      { text: "[sad] Morwenna caught me cheating at dice thirty years ago and made me promise to play fair. Best bargain I ever made." },
      { text: "[happy] Hollowmere! Best customers in the valley. They haggle like grandmothers and pay like grandmothers. Mirabel especially.", when: { loc: 'village' } },
      { text: "Whisperwood's grand for business. The squirrels pay in acorns, and now and then an acorn is gold. Keep your eyes peeled!", when: { loc: 'woods' } },
      { text: "[surprised] The Deepwood, friend? Brave customer! Sharpen your wits and your sword. Want a whetstone? It's also a paperweight.", when: { loc: 'deepwood' } },
      { text: "Sold the Captain a 'genuine kraken tooth' last month. Now Lune tells everyone it was pulled out by hand, mid-battle. Wonderful for business!", when: { loc: 'lake' } },
      { text: "Up on the Ridge the delvers buy anything shiny and lucky. I sell them the shiny. The luck they bring themselves. Mostly.", when: { loc: 'ridge' } },
      { text: "[sad] Hushwillow Glade. I don't sell here. Can't bring myself to. Look at that fox, asleep. Some places aren't for haggling.", when: { loc: 'glade' } },
      { text: "[happy] The famous Sanctum! Mind if I set up by your gate? I'll give you a percentage. A very small one. A delightful one.", when: { loc: 'sanctum' } },
      { text: "[happy] Morning, early bird! Early birds get the worm, and early shoppers get my best prices. The worm's extra.", when: { time: 'morning' } },
      { text: "Evening's the best time for dice. The light's kind, the stakes feel smaller, and everyone's a little braver.", when: { time: 'evening' } },
      { text: "Out late, friend? Me too. The night market is just me. It's very exclusive.", when: { time: 'night' } },
      { text: "[sad] Rain. My pack weighs double and my hat's a pond. Still! Umbrella? It's also a walking stick. And a fishing rod.", when: { weather: 'rain' } },
      { text: "Mist is good for mystery goods. Everything looks rarer in the mist. Even me.", when: { weather: 'mist' } },
      { text: "[surprised] A starfall! Bring me a Star Fragment and I'll trade you anything in the pack. Anything! Within reason. Reasonable reason.", when: { weather: 'starfall' } },
      { text: "[happy] Lantern Moon! Every stall in the plaza is mine tonight. Well, one stall. But I've draped it very ambitiously.", when: { moon: 'full', time: 'evening' } },
      { text: "Mirabel haggled me down to half price on a bag of Moonsweets. Then she gave me a pie. I still don't know who won." },
      { text: "[happy] Pip beat me at dice. Fair and square. Three times. I've started to suspect science." },
      { text: "Elvis bought a portrait of the Crimson Duelist off me. Didn't haggle. Just stared at it and whispered 'Look at that cheekbone.'" },
      { text: "Isolde bought an 'opera cape' from me. It was a tablecloth. She knew. She bought it anyway, then hemmed it. Better than new." },
      { text: "Grizelda tried to buy my monocle with a jar of eyes. Glass ones, she says. I didn't look too closely. Shook on it anyway." },
      { text: "Corvin bought a compass that only points down. He didn't ask why. I didn't ask why. Some sales are like that." },
      { text: "Brann looked at my hammers and said 'No.' Just 'No.' Best review I've had in years. Honest man." },
      { text: "Seraphine buys every bit of coloured glass I find. Says each shard remembers a window. I just like her smile when she pays." },
      { text: "[happy] Starlight Buns! Rare as hen's teeth, light as a cloud, and they glitter! Only three left! There are always only three left." },
      { text: "Ghostly Gingerbread! Baked at midnight, so the ginger goes a bit see-through. Things float into your pockets after. Uncanny!" },
      { text: "[happy] You're a regular, friend! Regulars get the good dice. The ones that aren't... I mean. All my dice are good dice.", when: { minHearts: 3 } },
      { text: "Here's a secret. I haven't been home in twelve years. Home's a little inn down south. My sister runs it. She keeps my room.", when: { minHearts: 5 } },
      { text: "[sad] The road's lonely, friend. You smile at a thousand faces and sell them all something, and nobody waves when you go.", when: { minHearts: 7 } },
      { text: "[happy] My road's started bending through Nightvale more often. Purely for business. It's not for you. It's a bit for you.", when: { minHearts: 9 } },
      { text: "A potion-maker! Bottle a few for me and I'll sell them across three kingdoms. Twenty percent for me, eighty for your legend!", when: { flag: 'firstBrew' } },
      { text: "Been down to the Catacombs, eh? Find any old coins? Lunar ones? I'm not asking for me. I'm asking for my collection.", when: { flag: 'depths25' } },
      { text: "[happy] You beat the Archon! I'm making pins. 'I Was There When The Moon Came Back.' Selling them by the hundred!", when: { flag: 'archonDefeated' } },
      { text: "[happy] Caspian bought a saddle from me for a dragon that hasn't hatched yet! Optimism! I respect it!" },
      { text: "Ronan bought a 'meteorite' from me. A painted potato. He knew. He bought it anyway. I like him enormously." }
    ],
    repeat: [
      "[happy] Back again, friend? Prices haven't changed! Well, slightly. Upwards. Kidding! Mostly!",
      "Two visits in one day! You must have seen the dice.",
      "Still browsing? Excellent. Browsing's free. Leaving's also free. Buying is where the magic happens.",
      "[happy] Ah, my favourite customer! Don't tell the others. I say that to all of them. But I mean it with you."
    ],
    gift: {
      love: [
        "[surprised] {item}?! For me? Friend, that's a treasure! A real one! I'll never sell it. I'll think about selling it. I won't sell it.",
        "[happy] Oh-ho! {item}! Look at the shine on that! You've made an old merchant very happy. Very rich in spirit, too.",
        "[happy] {item}! That's going in the special pocket. The one even I don't rummage in."
      ],
      like: [
        "[happy] {item}! Very generous. Very sellable. I mean lovely. Very lovely.",
        "{item}, eh? I know a fellow three towns over who'd weep to see it. I'll keep it, though. Sentiment.",
        "[happy] Thank you, friend! {item} has excellent resale... I mean, excellent meaning."
      ],
      neutral: [
        "{item}? Well, everything's worth something to someone! I'll find the someone.",
        "Thank you! {item}. It goes in the pack. Somewhere in the middle.",
        "{item}. Hm! Not my usual line, but I've sold stranger."
      ],
      dislike: [
        "{item}? Friend, I couldn't sell that to a scarecrow. And I've sold to scarecrows.",
        "[sad] Oh. {item}. My pack's heavy enough already.",
        "{item}. Every merchant gets a few of these. I'll treasure it. At the very bottom."
      ],
      hate: [
        "[angry] {item}?! That's bad for business, friend! Customers can smell it from the road!",
        "[angry] No, no, no. {item} is the one thing nobody will ever buy. Believe me. I've tried."
      ]
    },
    giftDone: [
      "[happy] Another gift? Friend, you're out-trading me! Save some for tomorrow!",
      "One gift a day! That's a fair deal, and I know fair deals. Mostly."
    ],
    hearts: {
      2: {
        pages: [
          "[happy] Friend! Fancy a roll? One die each, highest wins. Stakes: a few glimmer. Fate: undecided. Excitement: tremendous!",
          "[surprised] Six! You rolled a six! ...Again! Well, I never. Well, occasionally. Well, here you are. Your winnings!",
          "What? No, I didn't let you win. Merchants never let anyone win. ...Alright, a little. You looked like you needed a win."
        ],
        reward: { glimmer: 250 }
      },
      4: {
        pages: [
          "Hold out your hand, friend. Shh. Listen. ...Ring-a-ling. A Fairy Bell. It rings when someone far away is thinking of you.",
          "[sad] Mine rings sometimes, out on the road. I like to think it's my sister. Or a customer wanting a refund. Probably my sister.",
          "[happy] I've got two. You have this one. When it rings, it's probably me, wondering how you're getting on."
        ],
        reward: { item: 'relic_bell', qty: 1 }
      },
      6: {
        pages: [
          "[sad] Can I tell you something? This scarf. My sister knitted it the day I left home. Twelve years ago. 'For the road home,' she said.",
          "I keep meaning to take that road. Then there's a market, or a fair, or a valley with a nice moon and nicer folk.",
          "[happy] I'll go one day, and I'll bring her moon pearls from Glimmermere. Take these two. Practice at being generous. I'm out of practice."
        ],
        reward: { item: 'pearl', qty: 2 }
      },
      8: {
        pages: [
          "A confession, friend. I've been mapping this valley for treasure for thirty years. Every dig site, every old story.",
          "[sad] I found most of it. Sold most of it. Then I'd sit on a hill with my pockets full and nobody to show.",
          "[happy] So here. My best map. I'm too old to dig, and you're too stubborn not to. Bring me back a story. Stories are the real treasure.",
          "[happy] ...The treasure's also treasure. I wouldn't want to mislead you. I'm mostly honest."
        ],
        reward: { item: 'treasure_map', qty: 1 }
      },
      10: {
        pages: [
          "[happy] Friend, I've decided something. My road's going to bend through Nightvale a great deal more. Purely for business.",
          "[sad] Thirty years on the road and I never stayed long enough to be missed. Here, folk wave when I leave. You started that.",
          "This is my lucky idol. Moth wings, moon eyes. It's never once brought me luck. But it brought me here. Close enough.",
          "[happy] Take it. A merchant who gives away his lucky charm has either gone mad or made a friend. Ninety-four percent the second."
        ],
        reward: { item: 'relic_idol', qty: 1 }
      }
    },
    shop: {
      greet: [
        "[happy] Roll up, roll up! Four rare treasures, one cheerful merchant, zero refunds! Have a look, friend!",
        "Welcome to the finest shop that fits on one back! Everything genuine! Mostly!",
        "[happy] A customer! My favourite kind of person! Browse, haggle, marvel. In any order."
      ],
      bye: [
        "[happy] Pleasure doing business! Look for the hat with the pins!",
        "Off you go, friend! And if anyone asks, you got a bargain. You did, mostly!"
      ]
    }
  };

  // ================================================================ LAURA (romanceable)
  T.npcs.laura = {
    name: 'Laura Vex', short: 'Laura', title: 'Monster Hunter of the Silver Crescent',
    bio: "The Guild's sharpest monster hunter: all spikes, sarcasm and winged eyeliner, with a secret soft spot for stray cats and bad moon poetry.",
    intro: [
      "[angry] Watch it. You nearly walked into my sword. ...Oh. You're the farmer. The one with the glowing garden.",
      "Laura Vex. I hunt things for the Guild. Big things, ugly things, things with too many teeth. I'm very good at it.",
      "Free advice, farmer: don't get eaten. It's embarrassing for everyone, and the paperwork is a nightmare."
    ],
    talk: [
      { text: "Don't get eaten, farmer. I'm not hauling you out of a bog. Not that I've done it before. Not that I would.", when: { maxHearts: 2 } },
      { text: "[angry] What? You're staring. Is it the eyeliner? It's armour. Monsters respect a sharp wing.", when: { maxHearts: 2 } },
      { text: "Cute robe. Very 'please, monsters, I am a snack.' Get some leather.", when: { maxHearts: 2 } },
      { text: "You again. Fine. Talk. I'll sharpen this and pretend to listen.", when: { maxHearts: 3 } },
      { text: "If it's about bounties, read the board. If it's about feelings, read a book. I'm busy. I'm always busy.", when: { maxHearts: 3 } },
      { text: "[surprised] You brought me... no, you didn't. You were just walking past. Right. Good. Me too.", when: { minHearts: 3 } },
      { text: "You're less useless than you look, farmer. That's a compliment. Write it down. You won't get many.", when: { minHearts: 4 } },
      { text: "[sad] Fine. I feed the strays behind the Guild. Seven cats. They all have names. Don't laugh. ...You're laughing.", when: { minHearts: 5 } },
      { text: "I write poetry. About the moon. It's terrible. 'O moon, you pale and judgy coin.' See? Don't tell Gideon.", when: { minHearts: 5 } },
      { text: "[happy] {player}. ...I used your name. Don't make it a thing. It just sounds better than 'farmer' now.", when: { minHearts: 7 } },
      { text: "[sad] My mum hunted for the Guild. She taught me to hit hard and never cry where monsters can see. Still working on part two.", when: { minHearts: 7 } },
      { text: "[happy] You know what's scarier than a moss-wolf? Feeling safe around someone. I'm getting used to it. Slowly.", when: { minHearts: 9 } },
      { text: "A moss-wolf can smell fear at forty paces. I can smell a bad sword at fifty. Yours is borderline." },
      { text: "[happy] Best sound in the world: a slime popping. Second best: Gideon admitting I was right." },
      { text: "I don't do 'nice.' I do 'alive at the end of the day.' It's more useful." },
      { text: "The choker has spikes because I like spikes. Not to keep people away. That's just a bonus." },
      { text: "[angry] Somebody left a Flower Crown on my desk. I know it was Jasmine. The note said 'sorry' four times." },
      { text: "The band on my shirt? The Moonlit Skulls. Saw them once in the capital. Lost my voice for a week. Worth it." },
      { text: "Webweavers drop from the canopy. In the Deepwood, always look up. That's not advice. That's survival." },
      { text: "Don't thank me for killing monsters. Thank me for doing it before breakfast." },
      { text: "[sad] The moon's prettier from the Deepwood. Fewer lamps. More teeth. Everything good has teeth." },
      { text: "[happy] Dragonbreath Cider, extra smoke. Elvis says it 'matches my personality.' I'll take that." },
      { text: "Morning. Coffee, contracts, crushing my enemies. In that order.", when: { loc: 'guild', time: 'morning' } },
      { text: "Gideon's telling the bear story again. It was a badger. I've seen the scar. Badger.", when: { loc: 'guild', time: 'afternoon' } },
      { text: "[surprised] You're in my room. Okay. Don't touch the records. Don't read the notebook. Sit. Not there. That's the cat's.", when: { loc: 'laura_home' } },
      { text: "The bat plush is ironic. ...It's not ironic. His name is Count Fluffington. Tell anyone and you're wolf food.", when: { loc: 'laura_home', time: 'evening' } },
      { text: "[surprised] You're out here alone? ...Stay behind me. Not because you're weak. Because I'm faster.", when: { loc: 'deepwood' } },
      { text: "Night's when the good stuff comes out. By 'good' I mean big, angry and worth a lot of glimmer.", when: { time: 'night' } },
      { text: "[happy] Rain. Perfect. Wet fur, slow wolves, empty streets. Best hunting weather there is.", when: { weather: 'rain' } },
      { text: "Mist is when the wisps get cocky. I like it when things get cocky. Makes them easier to hit.", when: { weather: 'mist' } },
      { text: "Starfall. Make a wish. Mine's always 'more monsters.' The other one's private.", when: { weather: 'starfall' } },
      { text: "New moon. The Depths get hungry, and the board pays double. Stay inside, farmer. Or come hunting. Your choice.", when: { moon: 'new' } },
      { text: "[angry] Lantern Moon. Everyone's dancing. I'm not dancing. ...Unless someone asks properly. Not that I'm waiting.", when: { moon: 'full', time: 'evening' } },
      { text: "Gideon thinks he's my dad. He's not my dad. He remembers my birthday every year, though. It's annoying." },
      { text: "Jasmine bakes me honey cakes. I hate honey cakes. I eat every one. She looks so hopeful. It's exhausting." },
      { text: "Amara can talk about comets for an hour and I don't even mind. Don't tell her. She'll go for two." },
      { text: "Ronan forged my sword. Didn't say a word the whole time. Best conversation I've ever had." },
      { text: "Caspian keeps offering me a dragon ride. I'll ride the dragon. I won't ride with him. He sings." },
      { text: "[happy] Grizelda called me 'a girl after her own heart.' Then she tried to hex my boots. We're friends now." },
      { text: "Corvin and I have the same coat. Different reasons. His is grief. Mine's fashion. ...Fine. Bit of both." },
      { text: "You brew potions? Make me something that makes wolves cry. ...Fine, a Healing Draught works too.", when: { flag: 'firstBrew' } },
      { text: "[surprised] You made it to the Catacombs? Huh. Maybe you're not a snack after all. Maybe you're a light meal.", when: { flag: 'depths25' } },
      { text: "[happy] You took down the Archon. ...Okay. I'm impressed. Don't let it go to your head. Let it go to your sword arm.", when: { flag: 'archonDefeated' } }
    ],
    repeat: [
      "[angry] Still here? Do you need a contract, or a hobby?",
      "Twice in one day. People will talk. Mostly Sable.",
      "I'm sharpening. Talk if you must. I'll nod at the right bits.",
      "[surprised] Oh. It's you again. ...Okay. That's fine. That's completely fine."
    ],
    gift: {
      love: [
        "[surprised] {item}? For me? ...This is actually perfect. Why is it perfect? Who told you? Was it Gideon?",
        "[happy] {item}! Okay. Okay, wow. That's... thanks. I'm not blushing. It's cold in here.",
        "[happy] You got me {item}. On purpose. ...I'm putting it somewhere nobody else can touch it."
      ],
      like: [
        "{item}. Not bad, farmer. Not bad at all.",
        "[happy] {item}? Huh. You've got taste. Questionable taste. My kind.",
        "{item}. Useful. I'll use it. Thanks."
      ],
      neutral: [
        "{item}. Okay. Sure. Thanks, I guess.",
        "{item}? I'll find a use for it. Probably as something to throw.",
        "Hm. {item}. It's a thing. You gave me a thing."
      ],
      dislike: [
        "[angry] {item}? Do I look like I go on picnics?",
        "{item}. That's cute. I don't do cute.",
        "[sad] {item}... Jasmine would love this. Give it to Jasmine."
      ],
      hate: [
        "[angry] {item}. No. Absolutely not. Take it back before I set it on fire.",
        "[angry] {item}?! What did I ever do to you?"
      ]
    },
    giftDone: [
      "One's plenty. Don't make me feel things twice in one day.",
      "[angry] Another one? Are you trying to be nice? Stop that."
    ],
    hearts: {
      2: {
        pages: [
          "[surprised] Shh! Don't move. ...Okay. Move slowly. They spook easily.",
          "Seven strays live behind the Guild. That's Pickles. That's Ghoul. That one bit Gideon. I like him best.",
          "[angry] Tell anyone I buy fish for cats and I'll feed you to a moss-wolf. ...Here. Hold this. Pickles likes you.",
          "[happy] Take these wolf fangs from my last hunt. Payment for your silence. And your fish-holding skills."
        ],
        reward: { item: 'wolf_fang', qty: 3 }
      },
      4: {
        pages: [
          "[angry] Don't read that. Give it back. ...You read it. Of course you read it. Out loud? Really?",
          "'O moon, you pale and judgy coin, you watch me hunt, you watch me groan...' It doesn't rhyme. I know it doesn't rhyme.",
          "[sad] ...It's bad. I know it's bad. I write them anyway. The moon doesn't care if they're good.",
          "[happy] You think the second verse is better? It's worse. ...Thanks. Here. Dragonbreath. Don't tell anyone I'm being nice."
        ],
        reward: { item: 'drink_dragon', qty: 2 }
      },
      6: {
        pages: [
          "[surprised] Farmer, DOWN! ...Moss-wolves. Three of them. Stay behind me and swing at anything that isn't me.",
          "[angry] ...That's the last one. You okay? You're okay. You actually helped. You actually HELPED.",
          "[sad] My mum died on a hunt like this. I hunt alone so nobody has to watch me be scared. Tonight I wasn't alone.",
          "[happy] ...Here. My spare raven cloak. You'll look ridiculous in it. Wear it anyway."
        ],
        reward: { item: 'cl_cloak_raven', qty: 1 }
      },
      8: {
        pages: [
          "[happy] Come up. Mind the loose tile. This is my spot. Best view of the moon in Hollowmere. No people.",
          "I've never brought anyone up here. Gideon thinks I'm on patrol. Mostly I'm just... here. Writing bad poems.",
          "[sad] I'm not good at the soft stuff. I keep waiting for it to bite me.",
          "[happy] ...It hasn't. You haven't. Here. Void essence. Rare, dark, and weirdly beautiful. Like... never mind."
        ],
        reward: { item: 'void_essence', qty: 1 }
      }
    },
    romance: {
      bouquet: [
        "[surprised] Is that... a bouquet? For me? From you? ...Give me a second. I'm recalibrating.",
        "[happy] Yes. Yes, okay. We're dating. I've fought wyrms with less adrenaline. Don't tell anyone. Tell everyone. Ugh!"
      ],
      bouquetEarly: [
        "[surprised] Flowers? For me? ...No. Not yet. I don't even own a vase.",
        "Ask me again when we know each other better. That's not a no. It's a 'later.' Big difference, farmer."
      ],
      dating: [
        "[happy] Hey, you. ...Yes, I said 'hey, you.' Softly. Shut up. It's a dating thing.",
        "Gideon gave me a day off 'for the romance.' I've never been so humiliated. Let's go hunting.",
        "[happy] I wrote you a poem. It rhymes 'farmer' with 'charmer.' I'm not reading it. Ever.",
        "The cats like you better than me now. Traitors. I'm not even mad.",
        "[surprised] Jasmine asked if we're 'courting.' I said 'hunting together.' She cried. Happy crying, I think.",
        "[happy] You make the scary stuff quieter. I don't know how. Don't stop."
      ],
      heart10: {
        pages: [
          "[happy] Sit. Don't laugh. I'm going to play something. I've practised. The cats have heard it forty times.",
          "~ O moon, you pale and judgy coin, you watched me fight, you watched me fall... ~ Okay. The next line's actually good.",
          "[sad] ~ ...and then you sent me someone kind, and now I'm not afraid at all. ~",
          "[happy] ...That's the song. It's about you. Obviously. Here. My mum's lucky coin. She'd want it with someone who makes me brave."
        ],
        reward: { item: 'relic_coin', qty: 1 }
      },
      pendant: [
        "[surprised] A moonstone pendant. That's the forever one. You know that's the forever one, right?",
        "[happy] ...Yes. Obviously yes. I'm bringing my records. And the cats. All seven. Don't argue. They're family now."
      ],
      partner: {
        morning: [
          "[happy] Morning. I made coffee. It's terrible. I made it with love, so you have to drink it.",
          "Fed the cats, sharpened two swords, wrote half a poem. You were snoring. It was cute. Don't let it happen again."
        ],
        evening: [
          "[happy] You're home. Good. I counted the hours. I didn't count the hours. I counted maybe four of them.",
          "Long day? Sit. I'll put a record on. The sad one. You like the sad one."
        ],
        gift: [
          "[happy] Found {item} on patrol. Thought of you. Don't make it weird.",
          "Here. {item}. It's for you. I'm bad at wrapping things, so it's just... handed to you.",
          "[surprised] Pickles brought in {item}. Apparently it's for you. He's a cat. Just take it."
        ]
      }
    }
  };

  // ================================================================ JASMINE (romanceable)
  T.npcs.jasmine = {
    name: 'Jasmine Honeywell', short: 'Jasmine', title: 'Beekeeper & Baker',
    bio: "A shy beekeeper and baker with a cottage full of teddy bears, who apologises to doors and grows a little braver every time you visit.",
    intro: [
      "[surprised] Oh! S-sorry! I didn't see you. I wasn't looking. I was looking at a bee. Sorry. Hello.",
      "I'm Jasmine. Jasmine Honeywell. I keep the bees, and I bake things, and I, um... apologise a lot. Sorry. See?",
      "[happy] Would you like a honey biscuit? I made too many. I always make too many. Please take one. Or two."
    ],
    talk: [
      { text: "[surprised] Oh! H-hello! Sorry. I always say sorry. Sorry for saying sorry. ...Hello.", when: { maxHearts: 2 } },
      { text: "I-I don't really talk to people much. Bees are easier. They only buzz when they mean it.", when: { maxHearts: 2 } },
      { text: "[sad] Am I in the way? I'm always a little bit in the way. I'll move. Over here. Is here alright?", when: { maxHearts: 3 } },
      { text: "[happy] I didn't stammer just then! Did you notice? I noticed. I'm very pleased with myself.", when: { minHearts: 3 } },
      { text: "I said 'no' to Fennick today. He wanted my best honey for a hat. I said NO. I'm still shaking. It was amazing.", when: { minHearts: 5 } },
      { text: "[happy] I've been dreaming of a real bakery. With a sign and everything. You make me brave enough to say it out loud.", when: { minHearts: 7 } },
      { text: "[happy] I'm not shy with you anymore. Isn't that strange? You're the bravest thing I've ever done.", when: { minHearts: 9 } },
      { text: "[happy] Bees dance to tell each other where the flowers are. I tried it once. Mirabel thought I was having a fit." },
      { text: "Every jar of honey tastes like a different week. This one's the week the clover came up. It tastes a little... hopeful." },
      { text: "I have forty-two teddy bears. Is that too many? Elowen says it's 'a healthy number.' She has forty-two owl feathers." },
      { text: "[surprised] A bee landed on my nose this morning! I didn't move for an hour. We had a lovely time." },
      { text: "Baking is like magic, except you can eat the mistakes. Most of them. The burnt ones go to Pip." },
      { text: "[sad] I tried keeping bees in the capital once. Too noisy. The bees hated it. I hated it. We came home together." },
      { text: "My biggest bear is Sir Bartholomew Honeypaw. He's a knight. He guards the cupcakes. Badly." },
      { text: "[happy] Clover honey, lavender honey, moonpetal honey... the moonpetal one glows in the dark! I'm not sure it's allowed." },
      { text: "If you're sad, eat something warm and talk to a bee. That's my whole philosophy. It works most days." },
      { text: "Sorry, is there flour on my face? There's always flour on my face. I've accepted it." },
      { text: "[happy] It's stall day! Honey cakes, Moonsweets, and one jar of something experimental. Please try it. Please.", when: { loc: 'village', day: 'Moonday' } },
      { text: "Thornsday stall! I baked at four this morning. The bees were up too. We had a nice chat.", when: { loc: 'village', day: 'Thornsday' } },
      { text: "[surprised] Oh! You're in my cottage! I didn't tidy! The bears weren't expecting company! Sit anywhere. Not on Sir Bartholomew.", when: { loc: 'jasmine_home' } },
      { text: "[happy] I'm making tea. Would you like some? I have twelve kinds. Thirteen if you count the one that's mostly honey.", when: { loc: 'jasmine_home', time: 'evening' } },
      { text: "[happy] Good morning! The hives are humming. That means a sunny day. Or a hummy day. Either is nice.", when: { time: 'morning' } },
      { text: "Evenings are for baking tomorrow's bread and telling the bees about my day. They're wonderful listeners.", when: { time: 'evening' } },
      { text: "[sad] The bees stay in when it rains. So do I. We sit and listen to it together. It's cosy, really.", when: { weather: 'rain' } },
      { text: "Mist makes the flowers smell stronger. The bees go a bit silly. So do I, honestly.", when: { weather: 'mist' } },
      { text: "[surprised] Shooting stars! I wished for... no, I can't say, or it won't come true. It's about... never mind!", when: { weather: 'starfall' } },
      { text: "The bees are restless on new moons. I sing to them. Quietly. Very quietly. Please don't listen.", when: { moon: 'new' } },
      { text: "[happy] Lantern Moon! I'm selling lantern-shaped honey cakes at my stall. They don't fly. I checked.", when: { moon: 'full', time: 'evening' } },
      { text: "Laura is so brave. She hates my honey cakes, but she eats every single one. I think that means she likes me." },
      { text: "[happy] Amara told me bees can see colours I can't. Then she drew me a diagram. Then another. I loved it." },
      { text: "Mirabel taught me to bake. She says my crusts are 'nearly as good as mine, dearie.' Nicest thing anyone's ever said." },
      { text: "Caspian said a dragon could carry my whole hive. I said the bees would be terrified. He said 'so was I, the first time.'" },
      { text: "[surprised] Ronan left a little iron bee on my door. He didn't say anything. He just left it there. I cried a tiny bit." },
      { text: "Gideon buys a honey cake every Thornsday and eats it in one bite. Then he says 'Hm. Good.' I live for it." },
      { text: "[happy] You made a potion! Could you make one that helps bees sleep? They work so hard. Sorry. That's a strange request.", when: { flag: 'firstBrew' } },
      { text: "The Sanctum flowers are glowing now. My bees fly all the way there. Your garden is in my honey!", when: { flag: 'altar3' } },
      { text: "[happy] The moon's so bright the bees think it's morning. They're very confused. And very happy. Like me!", when: { flag: 'archonDefeated' } }
    ],
    repeat: [
      "[surprised] Oh! Hello again! Sorry! I mean, not sorry. Hello!",
      "Twice in one day? Is everything alright? Do you need a biscuit? I have biscuits.",
      "[happy] I was just telling the bees about you. Only good things. Mostly how nice you are.",
      "Sorry, my hands are all sticky. Honey everywhere. It's a good kind of everywhere."
    ],
    gift: {
      love: [
        "[surprised] {item}? For me? Oh... oh, I'm going to cry. Good crying! Thank you!",
        "[happy] {item}! It's my favourite! How did you know? Did the bees tell you? They gossip.",
        "[happy] Oh, {item}... I'll treasure it forever. Or eat it. Depending. Thank you so, so much!"
      ],
      like: [
        "[happy] {item}! That's so kind of you. Thank you!",
        "Oh, {item}! I'll put it somewhere lovely. Next to the bears.",
        "[happy] {item}. You're so thoughtful. Sorry, I mean, thank you!"
      ],
      neutral: [
        "Oh! {item}. Thank you! I'm sure I can find a... use for it.",
        "{item}? That's... nice! Thank you. Really.",
        "Thank you! {item} is very... interesting. I'll ask the bees."
      ],
      dislike: [
        "[sad] Oh. {item}. Um. That's... it's very... sorry. I don't like it. Sorry.",
        "[sad] {item}... the bees are hiding. I think they're scared. I'm a little scared.",
        "{item}? Oh. Um. I'll put it outside. Far outside."
      ],
      hate: [
        "[surprised] Eek! {item}! Please take it away. Sorry! Please!",
        "[sad] {item}... that's my very worst thing. I'm sorry. I can't even look at it."
      ]
    },
    giftDone: [
      "[happy] You already gave me something today! You're too kind. Far too kind.",
      "Oh, no, I couldn't take another. My heart's too full. And my shelves."
    ],
    hearts: {
      2: {
        pages: [
          "[surprised] Would you... like to see the hives? Only if you want. You don't have to. Sorry. Do you want to?",
          "This is Queen Clementine. She's very regal. She's never stung anyone. Well, she stung Pip, but he deserved it.",
          "[happy] You're standing so still! The bees like you. They don't like most people. They like you.",
          "[happy] Here. My best honey, the moonpetal kind. It glows a little. Please don't tell anyone how much I gave you."
        ],
        reward: { item: 'honey', qty: 3 }
      },
      4: {
        pages: [
          "[sad] Can I tell you a secret? I entered a baking contest in the capital once. My cake collapsed. Everyone laughed.",
          "I haven't entered anything since. I bake for Mirabel's shop and my stall and... that's it. It's safer.",
          "[happy] But you ate three slices of my lopsided cake yesterday and said it was the best you'd ever had. Did you mean it?",
          "[happy] ...You did. I could tell. Here, two Honeymoon Cakes. Not lopsided. Mostly not."
        ],
        reward: { item: 'food_honeycake', qty: 2 }
      },
      6: {
        pages: [
          "[surprised] {player}! I did it! I entered Sable's bake-off at the Gilded Owl! And I came SECOND!",
          "Mirabel won. She always wins. But second! With my own recipe! I didn't even stammer when they called my name!",
          "[happy] I only entered because you said I should. Because you believed in me. I've never had a believer before.",
          "[happy] Take these moonlilies. I grew them for my table. I want you to have them. There. I said it bravely."
        ],
        reward: { item: 'moonlily', qty: 3 }
      },
      8: {
        pages: [
          "[happy] I baked you something. It's shaped like you. Sort of. The arms went a bit wrong. You have very long arms in cake.",
          "[sad] When I was little, I thought I'd always be the shy girl at the back. The one who apologises to doors.",
          "[happy] I still apologise to doors. But I'm not at the back anymore. I'm here. With you.",
          "[happy] Here. Moonsweets I made myself. Every one is a little moon. One of them is a heart. Find it."
        ],
        reward: { item: 'snack_sweets', qty: 3 }
      }
    },
    romance: {
      bouquet: [
        "[surprised] A bouquet... for me? Oh! Oh my goodness. The bees are going to be SO excited.",
        "[happy] Yes! Yes, please! I'd love to be... yours. To date. Courting. Dating! I'm so happy I might float away."
      ],
      bouquetEarly: [
        "[surprised] Oh! Flowers! They're so pretty... but I'm, um... not ready yet. Sorry! Not sorry. Just... not yet.",
        "[happy] Maybe someday? When we're closer? I'd like that. I'd really, really like that."
      ],
      dating: [
        "[happy] I baked you a heart-shaped loaf. It came out more potato-shaped. But the love's in there!",
        "The bees know about us. I told them. You have to tell the bees everything. It's tradition. They approve.",
        "[surprised] Laura called us 'disgustingly sweet.' I said thank you. She didn't mean it nicely. I took it nicely.",
        "[happy] I'm not nervous around you anymore. Well. A little. The good kind. Butterflies. Bees, really.",
        "Sir Bartholomew wants to know when you're coming for tea. He's very formal. He's a bear.",
        "[happy] I hum when I think of you. The bees hum back. We're a choir now."
      ],
      heart10: {
        pages: [
          "[happy] Close your eyes and hold out your hands. ...It's a cake. The real one. The one I never finished for the capital.",
          "[sad] Six layers, moonpetal honey, candied stars. Ten years I was too scared to bake it. I baked it for you. Because of you.",
          "[happy] And I'm opening the bakery. A real one, with a sign: Honeywell's. I'll be terrified. I'll do it anyway.",
          "[happy] These are starbloom seeds from my garden, so you can grow the flowers my bravest honey comes from."
        ],
        reward: { item: 'seed_starbloom', qty: 5 }
      },
      pendant: [
        "[surprised] A... a moonstone pendant. Is this... are you... oh. Oh! OH!",
        "[happy] Yes! A thousand times yes! I'll bring the bees. And the bears. Some of the bears. Most of the bears. Is that alright?"
      ],
      partner: {
        morning: [
          "[happy] Good morning! I made honey toast. And honey tea. And a honey cake. I may have a problem. Eat up!",
          "The bees woke me at dawn to say good morning to you. I said you were sleeping. They said 'bzz.' So: good morning, from the bees."
        ],
        evening: [
          "[happy] You're home! I kept your supper warm. And your slippers. And a bear, for hugging. Optional.",
          "How was your day? Tell me everything. Slowly. I've got biscuits and nowhere to be."
        ],
        gift: [
          "[happy] I found {item} at the market and thought of you! Is that silly? It's not silly. Here!",
          "For you! {item}. I wrapped it in a napkin. I ran out of ribbon. I used the ribbon on a bear.",
          "[surprised] Oh! I almost forgot! {item}, for you. I love you. I mean, I love giving you things. Both. Here."
        ]
      }
    },
    shop: {
      greet: [
        "[happy] Welcome to my little stall! Honey cakes, Moonsweets and jars of honey. Sorry the sign's crooked. Pip made it.",
        "Oh! A customer! Hello! Everything's fresh. Well, nearly everything. That one's from yesterday. It's still nice!",
        "[happy] Take your time! Sorry. Not too much time. Some time. The right amount of time!"
      ],
      bye: [
        "[happy] Thank you so much! Come back soon! The bees will miss you.",
        "Bye! Sorry. Bye! Have a sweet day!"
      ]
    }
  };

  // ================================================================ AMARA (romanceable)
  T.npcs.amara = {
    name: 'Amara Starling', short: 'Amara', title: 'Star-Cartographer',
    bio: "Orvyn's brilliant, bubbly apprentice: she maps stars, theorises about runes, talks at comet speed, and is terrifyingly competitive at board games.",
    intro: [
      "[surprised] Oh! Hi! You're the new keeper! I've read about your altar! Well, the Order's notes about it. Sorry. Hi. Amara.",
      "Amara Starling. Star-cartographer, Orvyn's apprentice, part-time rune theorist, full-time person who talks too fast.",
      "[happy] Did you know the moon's orbit here is three hundredths of a degree off? Probably your altar! Can I measure it? Later! Hi!"
    ],
    talk: [
      { text: "[happy] Comets are just snowballs that got ambitious. Isn't that wonderful? I want to be an ambitious snowball." },
      { text: "Runes are recipes for reality. Get one stroke wrong and instead of light you get soup. Magical soup. Long story." },
      { text: "I've mapped four hundred and twelve stars this year. Orvyn's mapped three. He says his are 'more meaningful.' Annoyingly, he's right." },
      { text: "[surprised] Wait. If a potion's strength follows the moon phase, a full-moon Healing Draught should... sorry, thinking out loud." },
      { text: "Board game night is every Starday. I always win. Not because I'm competitive. Because I'm VERY competitive." },
      { text: "[sad] People say I talk too much. I know. I just think everything is SO interesting. Is that bad? Don't answer. Answer later." },
      { text: "My glasses are gold because I lost the silver ones inside a telescope. Inside it. Please don't ask how." },
      { text: "[happy] I carry seven books everywhere, just in case. In case of what? In case of not having a book." },
      { text: "Every rune in the Sanctum is a tiny sentence. Some are prayers. One, I'm fairly sure, is a shopping list." },
      { text: "Starlight takes thousands of years to reach us, so when you wish on a star you're wishing on the past. Romantic, right? Sorry. It is." },
      { text: "[surprised] I just realised I've been talking for ten minutes. Have I? I have. Okay. Your turn. Go." },
      { text: "Potion theory says ingredients argue in the cauldron. Moonpetal and glowcap get along. Mandrake argues with everyone. Like Grizelda." },
      { text: "The Order's star charts are wrong by exactly one star. One star is missing. Where did it go? I think about it constantly." },
      { text: "I collect geodes. Ronan cracks them. I gasp. It's a very efficient system." },
      { text: "[happy] Welcome to my study! Mind the books. And the other books. Those are runes on the chalkboard, not doodles. Mostly.", when: { loc: 'amara_home' } },
      { text: "Telescope's out! The Stubborn Kettle's rising. Orvyn named it after Morwenna, did you know? Of course you know. Come and look!", when: { loc: 'amara_home', time: 'night' } },
      { text: "Orvyn's teaching me the old star charts. Half of them are tea-stained. The other half are tea-stained differently.", when: { loc: 'ridge' } },
      { text: "[happy] Morning! I haven't slept. There was a comet! A small, shy one. I named it after my cat.", when: { time: 'morning' } },
      { text: "Evening's the best time for astronomy. The first stars come out like they're nervous. I relate.", when: { time: 'evening' } },
      { text: "[sad] Clouds. No stars tonight. I'll do rune maths instead. It's like stars, but indoors.", when: { weather: 'rain' } },
      { text: "Mist scatters light in the most beautiful way. It's physics! It's also pretty. Both!", when: { weather: 'mist' } },
      { text: "[surprised] STARFALL! I need my notebook! And my other notebook! Where's my third notebook?!", when: { weather: 'starfall' } },
      { text: "New moon. Darkest sky of the cycle. Best for faint stars, worst for walking home. I've tripped over Brann's cart twice.", when: { moon: 'new' } },
      { text: "[happy] Lantern Moon! I've calculated the exact minute the lanterns reach the clouds. I'll tell you. You don't have to listen.", when: { moon: 'full', time: 'evening' } },
      { text: "[happy] You listen to me ramble! Nobody listens to me ramble! Usually they nod and slowly back away.", when: { minHearts: 3 } },
      { text: "I keep a notebook of things I want to show you. It's forty pages long. Some of them are rocks.", when: { minHearts: 5 } },
      { text: "[sad] At the Academy they called me 'the Comet.' Because I talked fast and burned out. I didn't burn out. I came here.", when: { minHearts: 7 } },
      { text: "[happy] I mapped a new constellation. It's shaped like a watering can. I haven't named it. Well. I have. It's private.", when: { minHearts: 9 } },
      { text: "[happy] Orvyn is the smartest person I know. He also called me 'the bright one' for a month because he forgot my name. I let him." },
      { text: "Laura threw a dagger at a bat mid-sentence and finished the sentence. I've never been so jealous of anyone." },
      { text: "Jasmine's bees navigate by the sun! I wrote her a little paper about it. She cried. Good crying, she said. I hope." },
      { text: "Ronan lets me study the runes on his forge. He grunts when I'm right. He grunts differently when I'm wrong. I'm learning grunts." },
      { text: "Caspian says dragons navigate by 'the shiny stars.' I'm making him a proper chart. He's going to hate it. He's going to love it." },
      { text: "[angry] Gideon beat me at Siege & Serpents. Once. ONCE. Thirty-nine to one. He brings it up every single time." },
      { text: "Seraphine's windows bend light exactly like prisms! We talk refraction for hours. Best friendship I've ever had." },
      { text: "[surprised] Your first potion! What was the ratio? The temperature? Did it hum? Mine hummed. In B flat.", when: { flag: 'firstBrew' } },
      { text: "The Amethyst Grotto! Did the crystals hum? Orvyn says they hum the Starfall! Bring me a sample? A tiny one?", when: { flag: 'depths10' } },
      { text: "[happy] All five offerings! The moon's orbit corrected by three hundredths of a degree. I measured it! I cried! Both!", when: { flag: 'altar5' } },
      { text: "[happy] The moon's eleven percent brighter. ELEVEN. Do you know what that means? It means you're amazing.", when: { flag: 'archonDefeated' } }
    ],
    repeat: [
      "[happy] Back already? Did you think of a question? I love questions! Ask me two!",
      "Oh! You! Hi! I was in the middle of a sum. It can wait. Sums are patient.",
      "Sorry, I'm mid-thought. Hold that... no, I lost it. It's fine! I'll have another one in a minute.",
      "[happy] Twice in one day! Statistically, you like me. That's science."
    ],
    gift: {
      love: [
        "[surprised] {item}!! Do you know how rare this is? Do you know what I can DO with this? I'm going to cry, and then do science!",
        "[happy] {item}! This is going under the telescope tonight. Then on my desk. Then in my heart. Metaphorically!",
        "[happy] You brought me {item}? On purpose? Because you knew I'd love it? I'm... really touched. Thank you."
      ],
      like: [
        "[happy] Ooh, {item}! I've got at least three experiments for this!",
        "{item}! Thank you! It's going in the 'interesting' drawer. It's a very big drawer.",
        "[happy] {item}. Perfect for my notes. Everything's perfect for my notes."
      ],
      neutral: [
        "{item}? Hm! I'll study it. Everything's interesting if you look closely enough.",
        "Oh, {item}. Thank you! I'll find a hypothesis for it.",
        "{item}. Interesting. Not exciting. But interesting."
      ],
      dislike: [
        "[sad] {item}... it's very... ordinary. Sorry. That sounded rude. It's just very ordinary.",
        "{item}? I'll put it with the things I can't explain. Mostly why people like them.",
        "[sad] Oh. {item}. There's nothing in it to measure. At all."
      ],
      hate: [
        "[angry] {item}! It'll contaminate my samples! Out! Out of the study!",
        "[angry] {item}?! That's the opposite of science. That's anti-science!"
      ]
    },
    giftDone: [
      "[happy] You already gave me something today! Don't skew the data!",
      "One gift a day keeps the statistics clean. And my heart from exploding."
    ],
    hearts: {
      2: {
        pages: [
          "[happy] Want to see something? Look through here. That smudge is a comet. My comet. Well, I found it. Comets don't belong to anyone.",
          "I named it Biscuit, after my cat. Orvyn said that wasn't a serious name. I said comets don't care about serious.",
          "[happy] You're the first person I've shown. Here, starshards I've been saving. For luck. Or for science. Mostly luck."
        ],
        reward: { item: 'starshard', qty: 2 }
      },
      4: {
        pages: [
          "[angry] Board game night. You. Me. Siege & Serpents. I'm warning you now: I don't go easy. I've never gone easy. On anyone.",
          "[surprised] ...You won? You WON? Nobody wins! Gideon won once and he's still insufferable about it!",
          "[happy] Rematch. Now. No, wait, I'm being a bad loser. You earned this. Arcane dust. Use it on something clever."
        ],
        reward: { item: 'arcane_dust', qty: 3 }
      },
      6: {
        pages: [
          "[sad] Can I tell you something embarrassing? I failed out of the Academy in the capital. I talked too much in the exam. About comets.",
          "I thought I was a disappointment. Then Orvyn wrote to me. 'Bright one,' he said. 'Come and look at my sky.' So I came.",
          "[happy] Now I've found a comet, mapped four hundred stars, and made a friend who actually listens. That's a better degree.",
          "[happy] I want you to have this. Comet glass, from where Biscuit's tail brushed the Ridge. The rarest thing I own."
        ],
        reward: { item: 'min_comet_glass', qty: 1 }
      },
      8: {
        pages: [
          "[happy] Come up to the roof! I set up two telescopes. One's yours. I tuned it myself. Don't touch the dial. Okay, touch the dial.",
          "That missing star in the Order's charts? I found it. It isn't missing. It moved. It's been moving toward Nightvale for three hundred years.",
          "[surprised] I don't know what it means! Isn't that wonderful? A real mystery! And I wanted to tell you first. Before Orvyn. Before anyone.",
          "[happy] Here. Moonstones, to mark the night. Or bookmarks. Very shiny bookmarks."
        ],
        reward: { item: 'moonstone', qty: 2 }
      }
    },
    romance: {
      bouquet: [
        "[surprised] A bouquet. For me. I calculated the odds of this at four percent. FOUR. I've never been so happy to be wrong!",
        "[happy] Yes! Yes yes yes. We're dating! I'm telling the stars. Not literally. Slightly literally. I'm telling Orvyn."
      ],
      bouquetEarly: [
        "[surprised] Flowers? For me? My heart rate just doubled. That's data. But... I think it's too soon. I want to get this right.",
        "[happy] Ask me again later? I'll be ready. I'll make a chart."
      ],
      dating: [
        "[happy] I added you to my star chart. As a constellation. You're the one shaped like a watering can. Don't laugh.",
        "You beat me at Siege & Serpents again. I've never been so proud and so furious at the same time.",
        "[happy] Orvyn says I've been 'distracted.' I've mapped twelve fewer stars this month. I regret nothing.",
        "Your heartbeat goes up when I talk about comets. I measured. It's fine! Mine does too.",
        "[surprised] Jasmine asked if you're 'the one.' I said statistically there's no such thing. Then I blushed for an hour.",
        "[happy] Stargazing tonight? I'll bring tea. You bring you. That's the whole plan. It's a very good plan."
      ],
      heart10: {
        pages: [
          "[happy] Tonight's the night. The moving star is close enough to see. Come up to the roof. Bring a blanket. I brought two.",
          "[surprised] There! Look! It isn't a star. It's a comet, coming home after three hundred years. The Order saw it last. Now we do.",
          "[sad] I used to think I'd spend my life looking up alone, writing everything down so someone, someday, would read it.",
          "[happy] Then you read it. Every page. Here, the Star Fragment I've kept since I was small. You should have my brightest thing."
        ],
        reward: { item: 'relic_star', qty: 1 }
      },
      pendant: [
        "[surprised] A moonstone pendant?! The probability of this was... I don't care what the probability was! YES!",
        "[happy] I'll move in! I'll bring the telescope. And the books. Most of the books. We might need a bigger cottage. I'll draw plans!"
      ],
      partner: {
        morning: [
          "[happy] Good morning! I've been up since four. There was a meteor. I named it after you. Again. That's six now.",
          "Coffee's ready! I calibrated the kettle. Perfect temperature. I'm insufferable, I know. Drink up!"
        ],
        evening: [
          "[happy] You're home! Sit. I'll read you today's notes. Or I won't. I'll just sit next to you. That's nice too.",
          "Clear sky tonight. Shall we count stars? You always lose count at forty. I find it adorable."
        ],
        gift: [
          "[happy] Found {item} in the observatory stores! Orvyn won't miss it. He doesn't know he had it.",
          "For you! {item}. I catalogued it first. Item one thousand and one. You're item one, obviously.",
          "[surprised] Oh! I bought you {item} at the market. I calculated you'd like it. Ninety-two percent."
        ]
      }
    }
  };

  // ================================================================ RONAN (romanceable)
  T.npcs.ronan = {
    name: 'Ronan Ashvale', short: 'Ronan', title: 'Runesmith of Ashvale',
    bio: "The quiet, rune-tattooed runesmith of the Ashvale Runesmithy: dry as forge ash, obsessed with rare minerals, and far gentler than he looks.",
    intro: [
      "Mm. Customer. Welcome to the Runesmithy. Don't touch the glowing things. Most of them are hot. The rest are hungry.",
      "Ronan Ashvale. I work metal, read runes and crack geodes. Bring me rocks. Interesting ones. I'll make it worth your while.",
      "The cabinet on the wall. Twenty-four slots, twenty-four minerals. I want to see it full. You can help."
    ],
    talk: [
      { text: "Mm. Ore's like people. Most of it's ordinary. The good stuff hides deep and glows when nobody's looking." },
      { text: "The runes on my arms? My grandmother burned them in. Steady hands. Patience. And one she never would explain." },
      { text: "I talk less than most. Saves time. Time is for forging." },
      { text: "Geodes are just rocks with secrets. I like rocks with secrets." },
      { text: "Brann thinks runes are decoration. I think his hammer's decoration. We're both wrong. Mostly him." },
      { text: "[happy] Found a moth fossil in a moon geode last week. Little thing. Perfect wings. Didn't sell it." },
      { text: "Don't sharpen a blade on a full moon. It gets ideas. ...That's a joke. Partly." },
      { text: "The forge hums when it likes the ore. Listen. ...That. That's a good hum." },
      { text: "People think blacksmiths are loud. The hammer's loud. I'm not." },
      { text: "The quench trough's etched with water runes. Cools steel faster. Also makes good tea. Don't tell anyone." },
      { text: "If a geode rattles, it's hollow. If it hums, it's special. If it ticks, put it down and walk away." },
      { text: "[sad] My grandmother forged for the Order's last keepers. She said the runes were older than words. I believe her." },
      { text: "The cabinet's empty slots keep me up at night. Fill them. Please. For my sleep." },
      { text: "Forge takes time to wake. So do I. Coffee first. Then talk.", when: { loc: 'smithy', time: 'morning' } },
      { text: "Busy. Bring geodes or bring quiet. Both welcome.", when: { loc: 'smithy', time: 'afternoon' } },
      { text: "Closing up. Coals glow longest after the work stops. Like most things.", when: { loc: 'smithy', time: 'evening' } },
      { text: "Can't sleep. Thinking about a starheart. Haven't found one yet. I will.", when: { time: 'night' } },
      { text: "Rain on the forge roof. Good sound. Steam everywhere. Like working inside a cloud.", when: { weather: 'rain' } },
      { text: "Mist slows the quench. Have to be patient. I'm good at patient.", when: { weather: 'mist' } },
      { text: "[surprised] Starfall. Meteorites. Real ones. Find one with a black crust, bring it here. Don't run. Walk fast.", when: { weather: 'starfall' } },
      { text: "New moon. Rune-light glows brighter in the dark. My arms look like lanterns. Children follow me home.", when: { moon: 'new' } },
      { text: "Lantern Moon. Too many people. I'll be at the edge of the plaza, near the food. Come find me. If you want.", when: { moon: 'full', time: 'evening' } },
      { text: "Mm. You again. Something to crack, or just looking?", when: { maxHearts: 2 } },
      { text: "[happy] You're here. Good. Saved you a geode. Didn't crack it. Thought you'd want to watch.", when: { minHearts: 3 } },
      { text: "Most people talk to fill the silence. You don't. I like that. I like you. ...Both true. First one's more important.", when: { minHearts: 5 } },
      { text: "[sad] I left Ashvale because everyone knew what I'd be before I did. Here, nobody does. You just let me be.", when: { minHearts: 7 } },
      { text: "[happy] You make the forge feel like a home, not a workshop. Took me a while to notice. Noticed now.", when: { minHearts: 9 } },
      { text: "Brann came in once. Looked at everything. Said 'Hm.' Left. Longest review I've ever had." },
      { text: "Laura's sword is mine. Best balance I ever made. She named it. Won't tell me the name. Suspect it's rude." },
      { text: "Amara studies my runes and talks for an hour. I understand half. I like the other half better." },
      { text: "Jasmine left a honey cake on my anvil. I don't like honey. Ate it anyway. Couldn't bear to tell her." },
      { text: "Caspian wants a rune-stitched dragon saddle. I said dragons don't need runes. He said 'style.' Mm." },
      { text: "Gideon pays on time and never haggles. Only one in the valley. I'd follow him into a cave. Have done." },
      { text: "Fennick sold me a 'genuine meteorite.' Painted potato. I bought it. Respect the effort." },
      { text: "Ember geodes start around floor ten. Warm to the touch. Don't keep them in your pocket. I've learned.", when: { flag: 'depths10' } },
      { text: "Floor twenty-five. That's where the void geodes start. Bring me every one. Every. One.", when: { flag: 'depths25' } },
      { text: "[happy] You beat the Archon. Mm. Want a sword that says so? I'll make one. Won't charge. Much.", when: { flag: 'archonDefeated' } }
    ],
    repeat: [
      "Mm. Back.",
      "Twice. Is it the smell of soot or the company?",
      "Busy with a blade. Talk. I'll listen. Hammer's louder, though.",
      "[happy] You again. Good."
    ],
    gift: {
      love: [
        "[surprised] {item}. ...That's. Mm. That's a very good gift. I'm keeping this forever.",
        "[happy] {item}! You know your stones. And me. Thanks.",
        "[happy] {item}. This goes in the case by the forge. Where I see it every day."
      ],
      like: [
        "{item}. Good. Thanks.",
        "[happy] Mm. {item}. You've got an eye.",
        "{item}. I'll put it to use. Something sharp."
      ],
      neutral: [
        "{item}. Hm. Alright.",
        "{item}? Mm. Thanks.",
        "{item}. Not ore. Still kind of you."
      ],
      dislike: [
        "{item}. ...Not really my thing.",
        "{item}? Mm. Give it to Jasmine. She'll love it.",
        "[sad] {item}. I'll put it somewhere. Away from the forge."
      ],
      hate: [
        "[angry] {item}. Get it out. It'll ruin the temper of every blade in here.",
        "[angry] {item}?! It wobbles. Nothing in my forge wobbles."
      ]
    },
    giftDone: [
      "One's enough. Any more and I'll have to say something nice.",
      "Mm. Already got one today. Keep it for tomorrow."
    ],
    hearts: {
      2: {
        pages: [
          "Watch. Geode on the anvil. Tap here. Not hard. Listen. ...Hear the hollow? That's where the secret lives.",
          "[surprised] There. Moon geode. Lunarite inside. Blue as the first hour after midnight.",
          "[happy] Next one I crack is yours. And take this shadowiron. For your tools. Don't say thank you. I'll get awkward."
        ],
        reward: { item: 'ore_shadow', qty: 5 }
      },
      4: {
        pages: [
          "Hold out your arm. ...Rune of steady hands. Painted, not burned. It'll wash off. In a few years.",
          "[happy] Joke. It washes off tonight. But your hands will remember it. That's how runes work.",
          "Here. Amethysts. You'll want a Frostward or two down there. And come back. I mean it."
        ],
        reward: { item: 'amethyst', qty: 3 }
      },
      6: {
        pages: [
          "[sad] My grandmother's hammer. Cracked last night. Forty years without a flaw. Then... gone.",
          "...You stayed. Most would leave. I'm poor company when I'm sad. I'm barely good company when I'm happy.",
          "[happy] I'll reforge it. Into something new. Not a hammer. Something for you. When it's ready. It'll take a while.",
          "For now, this. A golem core. Hums like the forge. Reminds me of home."
        ],
        reward: { item: 'golem_core', qty: 1 }
      },
      8: {
        pages: [
          "See the cabinet? Twenty-four slots. Behind it, one more. Hidden. My grandmother's idea. For the thing you'd never sell.",
          "[sad] Mine's been empty ten years. Nothing ever felt right. This week I knew what belonged in it.",
          "[happy] ...An iron moonflower. I made it. It's for you. It stays here, where it's safe. Like you are, here.",
          "[happy] And this one's yours to keep. A meteorite. Found it when I was eight. Started all of this. Now it's yours."
        ],
        reward: { item: 'min_meteorite', qty: 1 }
      }
    },
    romance: {
      bouquet: [
        "[surprised] ...Flowers. For me. Mm. Nobody's ever... Mm.",
        "[happy] Yes. I'd like that. Dating. ...I'll need a vase. I'll make one. Iron. Indestructible. Like this."
      ],
      bouquetEarly: [
        "[surprised] Flowers? ...Kind. But not yet. I'm slow to trust. Slower to bloom. Like iron.",
        "Ask again when the forge knows you better. It's close."
      ],
      dating: [
        "[happy] You're here. The forge got warmer. Don't argue with science. Amara would.",
        "Made you a hook by the door. For your coat. So you stay longer. Not subtle. I'm not subtle.",
        "[happy] Gideon asked if I was 'courting.' I said 'forging something.' He laughed for a whole minute. Unbearable man.",
        "Mm. Missed you. ...Said it out loud. Huh. Wasn't so bad.",
        "Cracked a geode today. Wished you'd seen it. Saved the pieces. Look.",
        "[happy] Brann says I'm 'smiling too much.' Didn't know that was possible. Learning things."
      ],
      heart10: {
        pages: [
          "[happy] Come to the forge. Close your eyes. ...Open. Grandmother's hammer, reforged at last. A rune knife.",
          "Every rune means something. Steady hands. Patience. And this one she never explained. I think I know now.",
          "[sad] It means 'home.' She carved it on her hammer the day she met my grandfather. I carved it on this. For you.",
          "[happy] And this. Voidcrystal. The rarest thing I own. Keep it. Keep me. ...Too much? Mm. I'll stop talking."
        ],
        reward: { item: 'voidcrystal', qty: 2 }
      },
      pendant: [
        "[surprised] The pendant. I made this. You bought it from me. To give to me. ...Best sale I've ever made.",
        "[happy] Yes. I'll bring my tools. And the meteorite. And myself. Mostly myself."
      ],
      partner: {
        morning: [
          "Morning. Coffee's black. Fire's lit. Garden's watered. Three things done. Now you.",
          "[happy] You snore like a bellows. ...That's a compliment. I like bellows."
        ],
        evening: [
          "[happy] You're back. Sit by the fire. I'll do the talking. ...No. You talk. I'll listen.",
          "Long day? Mm. Me too. Good to be home."
        ],
        gift: [
          "[happy] Found {item} in a geode today. Kept it for you. Didn't even put it in the cabinet.",
          "{item}. For you. Don't make a fuss.",
          "Mm. Here. {item}. Saw it. Thought of you. That's all."
        ]
      }
    },
    shop: {
      greet: [
        "Runesmithy's open. Ores, gems, minerals, relics. I buy. I sell. I crack geodes.",
        "Mm. Customer. Got anything that glows? I'll make you an offer.",
        "[happy] You. Good. Got geodes? I've got a hammer."
      ],
      bye: [
        "Mm. Come back with rocks.",
        "Mind the steps. They're hot. Everything here is hot."
      ]
    }
  };

  // ================================================================ CASPIAN (romanceable)
  T.npcs.caspian = {
    name: 'Caspian Drake', short: 'Caspian', title: 'Dragon Tamer of the Menagerie',
    bio: "The cocky, charming dragon tamer of Drake's Menagerie & Stables, with a baby dragon on his shoulder and a secret longing to fly past the mountains.",
    intro: [
      "[happy] Well, well. A new face. Caspian Drake: dragon tamer, stablemaster, devastatingly handsome. You may stare. Everyone does.",
      "This is Pebble. Baby dragon. Bites, but only people she likes. ...Ow. See? She likes you. Lucky you.",
      "Horses, pets, and, if you're ever brave enough, a dragon of your own. Best view in Nightvale is from a saddle, sunshine."
    ],
    talk: [
      { text: "[happy] Dragons choose their riders, sunshine. Pebble chose me. Mostly because I had a sausage. Still counts." },
      { text: "Ever seen the valley from a thousand feet up? The lake's a coin. The Sanctum's a candle. You feel tiny and enormous at once." },
      { text: "This scar? Dragon. That one? Also a dragon. This one? Door. Don't ask about the door." },
      { text: "[happy] Horses are loyal. Dragons are opinionated. Kittens are somehow both." },
      { text: "My goggles have seen three kingdoms and a volcano. They've also seen me fall off a dragon twice. They don't judge. Much." },
      { text: "[sad] Past the mountains there's a sea nobody's ever mapped. One day I'll fly there. Me, the wind, Pebble. And snacks." },
      { text: "Pebble ate my hat. Again. That's four hats. I'm starting to think it's personal." },
      { text: "[happy] The trick to taming anything is never looking scared. The trick to never looking scared is goggles." },
      { text: "A good saddle is the difference between flying and falling with style. I've done both. Flying's better." },
      { text: "Dragon eggs hum when they're nearly ready. Ours has hummed for a month. I sleep next to it. It's fine. I'm fine." },
      { text: "People think I'm all swagger. I'm about sixty percent swagger. The rest is hay." },
      { text: "Shadow pups are the clumsiest creatures alive. Absolute geniuses at falling over. I adore them." },
      { text: "Moon kittens glow in moonlight. Actually glow. I've got three. They run the place." },
      { text: "[happy] Crystal foxes are real, you know. Rarest pets in the world. Ronan says you can only earn one. I'd love to meet one." },
      { text: "[happy] Morning, sunshine! Feeding time. If you hear screaming, it's the bunnies. They're dramatic about breakfast.", when: { loc: 'menagerie', time: 'morning' } },
      { text: "Afternoon flying lessons are cancelled. Pebble's napping. Pebble outranks me.", when: { loc: 'menagerie', time: 'afternoon' } },
      { text: "Evenings are for brushing the horses and telling them they're beautiful. They are. So are you. Smooth, right?", when: { loc: 'menagerie', time: 'evening' } },
      { text: "[sad] Some nights I take a dragon up alone, just to see the lights of Hollowmere. It's quieter up there. Lonelier too.", when: { time: 'night' } },
      { text: "Rain! Dragons hate rain. Pebble's sulking under my coat. I'm basically a tent now.", when: { weather: 'rain' } },
      { text: "No flying in mist. Learned that one the hard way. Tree. Big tree. Very surprised tree.", when: { weather: 'mist' } },
      { text: "[surprised] Starfall! The dragons go wild for it. They try to catch the falling stars. Mine nearly managed once.", when: { weather: 'starfall' } },
      { text: "New moon. The horses get skittish. So do I, honestly. Too dark to fly. Too quiet to sleep.", when: { moon: 'new' } },
      { text: "[happy] Lantern Moon! I'm flying my lantern higher than anyone's. Cheating? It's called 'aerial advantage.'", when: { moon: 'full', time: 'evening' } },
      { text: "[happy] Back for more of my charm, sunshine? Understandable. It's considerable.", when: { maxHearts: 2 } },
      { text: "Most people come here for the animals. You come for the animals and me. I noticed.", when: { minHearts: 3 } },
      { text: "[sad] I talk big. Always have. It's easier than admitting I get lonely out here with nobody but hay and dragons.", when: { minHearts: 5 } },
      { text: "Pebble falls asleep when you visit. She only does that around people she trusts. Me and you. Short list.", when: { minHearts: 7 } },
      { text: "[happy] I used to dream of flying past the mountains alone. Lately the dream has two saddles in it. Funny, that.", when: { minHearts: 9 } },
      { text: "Laura won't fly with me. Says I sing. I don't sing. I hum heroically." },
      { text: "[happy] Jasmine cried when she held a bunny. Then the bunny cried. Then I cried. Great afternoon." },
      { text: "Amara wants to chart the dragons' flight paths by the stars. I said they follow snacks. She's charting the snacks." },
      { text: "Ronan's making me a rune-stitched saddle. Says dragons don't need runes. Says it while stitching the runes. Big softie." },
      { text: "Gideon rode a dragon once, in the war. He won't talk about it. Just says 'never again' and smiles a little." },
      { text: "[surprised] The Captain claims to have ridden a sea serpent. I'd pay good glimmer to see that." },
      { text: "Elowen talks to my animals. They told her I sing to them. Traitors, all of them." },
      { text: "[surprised] The Rift? You went that deep? You're braver than me, sunshine, and I sleep next to a dragon egg.", when: { flag: 'depths40' } },
      { text: "[happy] You saved the valley! I'm flying you a victory lap. Pebble's already practising.", when: { flag: 'archonDefeated' } }
    ],
    repeat: [
      "[happy] Couldn't stay away, sunshine? Can't blame you.",
      "Twice in one day! Pebble's keeping count. She's jealous.",
      "Back already? Grab a brush. The horses don't groom themselves. Well, they try. Badly.",
      "[happy] Hey, you. Still here. Nice."
    ],
    gift: {
      love: [
        "[surprised] {item}?! For me? Sunshine, you've left me speechless. That never happens. Pebble, look!",
        "[happy] {item}! Now that's a gift fit for a dragon tamer. Thank you. Really. I mean it.",
        "[happy] {item}... You know me better than I thought. That's a little terrifying. In a good way."
      ],
      like: [
        "[happy] {item}! Nice. Pebble approves too. She's sniffing it.",
        "{item}? You spoil me. Keep doing it.",
        "[happy] Ooh, {item}. Very thoughtful, sunshine."
      ],
      neutral: [
        "{item}. Huh. Okay! Thanks!",
        "{item}? I'll find a use for it. Pebble will find a use for it. Probably eating it.",
        "Thanks, sunshine. {item}. It's a gift. Gifts are great."
      ],
      dislike: [
        "{item}? Not really my style, sunshine.",
        "[sad] {item}. Pebble's growling at it. I trust Pebble.",
        "{item}. I'll put it in the hay. Somewhere deep."
      ],
      hate: [
        "[angry] {item}?! Get it away from the animals! And from me! Mostly from me!",
        "[angry] {item}! Nope. No. Absolutely not. Pebble, don't touch it."
      ]
    },
    giftDone: [
      "[happy] Another one? Easy, sunshine. A man can only be adored so much in one day.",
      "One gift a day. Pebble's rule. She's very strict."
    ],
    hearts: {
      2: {
        pages: [
          "[happy] Sunshine! Hold out your arm. Steady... there. Pebble, say hello. ...She's on your arm. She LIKES you. She bit me for a week.",
          "Most people flinch. You didn't. Dragons remember that kind of thing.",
          "[happy] Here. Pet treats, for Pebble or any critter that wins your heart. Like mine just did. Pebble's heart. I meant Pebble's."
        ],
        reward: { item: 'pet_treat', qty: 5 }
      },
      4: {
        pages: [
          "[happy] Up you get! It's safe. Mostly. It's a horse, sunshine, not a dragon. Yet. Hold the reins. Like that.",
          "[surprised] Look at you! A natural! Okay, she's walking very slowly. But naturally!",
          "[happy] Next time, a gallop. Time after that, the sky. Here, for the road: Stardust Fizz. Fast feet for fast friends."
        ],
        reward: { item: 'drink_fizz', qty: 2 }
      },
      6: {
        pages: [
          "[sad] You found me on the paddock fence at midnight. Bit embarrassing. I come here when I can't sleep.",
          "My dad tamed dragons too. He flew past the mountains when I was twelve. Said he'd come back. Maybe he found the sea.",
          "[happy] ...Never told anyone that. Not even Pebble. Well. Pebble knows. Pebble knows everything.",
          "Take this golden acorn. He gave it to me before he left. 'For luck, kid.' I think you need it more."
        ],
        reward: { item: 'golden_acorn', qty: 1 }
      },
      8: {
        pages: [
          "[happy] Okay. Close your eyes. Hold on to me. Tight. ...Now open them.",
          "[surprised] We're above the clouds! Look! The whole valley! The Sanctum's glowing! That's yours! You did that!",
          "[sad] I always said I'd fly past the mountains alone. Funny. Up here with you, I'm not in a hurry to go anywhere.",
          "[happy] Here. A phoenix feather I found on a peak. It burns bright and never quite goes out. Reminded me of you."
        ],
        reward: { item: 'relic_feather', qty: 1 }
      }
    },
    romance: {
      bouquet: [
        "[surprised] A bouquet? For me? Sunshine... I'm usually the one doing the charming. You've beaten me at my own game.",
        "[happy] Yes. Absolutely yes. Pebble, we're dating! ...She's unimpressed. She'll come round. I already have."
      ],
      bouquetEarly: [
        "[surprised] Flowers? Sunshine, I'm flattered. Truly. But let's not rush. Every good flight starts with a long run-up.",
        "[happy] Ask me again soon. I'll be here. Polishing my charm."
      ],
      dating: [
        "[happy] Morning, gorgeous. Yes, gorgeous. I've been practising in the mirror. The horses think I'm ridiculous.",
        "Pebble finally likes you more than me. I'm heartbroken. And thrilled. Mostly thrilled.",
        "[happy] I wrote your name on the stable wall. In hay. The horses ate it. Romance is hard.",
        "Let's fly to the lake tonight. I'll bring a blanket. You bring that smile. Deal?",
        "[sad] I used to look at the mountains and want to leave. Now I look at them and want to come home. Strange, right?",
        "[happy] Gideon caught me humming. Said 'that's a love song, Drake.' I said it's a dragon song. It was a love song."
      ],
      heart10: {
        pages: [
          "[happy] Saddle up, sunshine. Tonight we fly past the mountains. Together. I've packed snacks. And a map. Mostly snacks.",
          "[surprised] ...There. The sea. Nobody's mapped it. Silver all the way to the edge of the world. Dad was right. It's real.",
          "[sad] I thought finding it would feel like an ending. It feels like a beginning. Because you're here.",
          "[happy] Pearls from its shore, for you. Proof we were the first. Let's come back and map it. Together."
        ],
        reward: { item: 'pearl', qty: 3 }
      },
      pendant: [
        "[surprised] A moonstone pendant. Sunshine... are you asking what I think you're asking? Because I'm already saying yes.",
        "[happy] I'll move in! Pebble too. And maybe a horse. A small horse. We'll talk. Yes. YES."
      ],
      partner: {
        morning: [
          "[happy] Morning, sunshine! Fed the pets, watered three crops, and only fell over once. Productive!",
          "Pebble made breakfast. By which I mean she set fire to the toast. Lovingly."
        ],
        evening: [
          "[happy] You're home! Come here. Tell me everything. Leave nothing out. Especially the dangerous bits.",
          "Sunset flight tomorrow? Just us. And Pebble. She invites herself."
        ],
        gift: [
          "[happy] Brought you {item} from my morning flight! Found it on a cliff. Very romantic cliff.",
          "Here, sunshine. {item}. Pebble wanted to eat it. I said it's for you. She sulked.",
          "[happy] {item}! For the love of my life. And for your satchel. Mostly the love of my life."
        ]
      }
    },
    shop: {
      greet: [
        "[happy] Welcome to Drake's Menagerie! Pets, mounts, and the finest dragon tamer this side of the mountains. Me.",
        "Looking for a friend, sunshine? Furry, scaly or feathery, we've got the lot. Mind the bunny. She bites.",
        "[happy] A customer! Pebble, look sharp. Well. Look less like you're eating my sleeve."
      ],
      bye: [
        "[happy] Fly safe, sunshine! Or walk safe. Either way, come back!",
        "Bye! Pebble says bye. She's chewing my collar. That's her goodbye."
      ]
    }
  };

  // ================================================================ GIDEON
  T.npcs.gideon = {
    name: 'Gideon Grimm', short: 'Gideon', title: 'Guildmaster of the Silver Crescent',
    bio: "The grizzled Guildmaster of the Silver Crescent: stern, fair, fond of his pipe and his war stories, and quietly proud of every hunter who comes home.",
    intro: [
      "So. The keeper. Gideon Grimm, Guildmaster of the Silver Crescent. Sit. Not there. That chair bites. Long story.",
      "The board offers contracts. You take contracts. You come back alive. You get paid. That's the whole philosophy, recruit.",
      "[happy] Copper rank to start. Work hard and you'll make Silver. Work harder and you might make me smile. Few have."
    ],
    talk: [
      { text: "In my day we hunted wyrms with a spoon and a prayer. The prayer did most of the work." },
      { text: "A good hunter is patient, quiet and stubborn. A great hunter is all three and owns good boots." },
      { text: "This eyepatch? Siege of Thornwall. A troll with excellent aim and a very poor attitude." },
      { text: "[happy] The Captain and I disagree about who lost the better eye. I'm winning. I'm also older." },
      { text: "The pipe stays lit. Thirty years now. Like the hearth. Like my grudges." },
      { text: "Never trust a contract that pays too much, a monster that's too quiet, or Fennick's dice." },
      { text: "I write the bounty notices myself. The spelling's mine too. I'm told it's 'creative.'" },
      { text: "I've buried more hunters than I care to count. That's why I count them. Every one. Out loud." },
      { text: "[happy] The bear story? It was a bear. Laura says badger. Laura wasn't born yet. Bear." },
      { text: "Rank isn't about glory, recruit. It's about who I trust to come back. Earn that." },
      { text: "A slime ogre once swallowed my best helmet. Spat it out a week later, polished. I wear it to funerals." },
      { text: "Rest when you can. Eat when you can. Run when you must. Write that on your heart." },
      { text: "Every trophy on that wall has a name. The slime in the jar is Gerald. Pip named him after his goggles." },
      { text: "The crest: crossed blades over a crescent. The blades guard the moon. The moon lights the blades. That's the idea." },
      { text: "Morning. Board's fresh. Coffee's strong. Excuses are weak. Pick a contract.", when: { loc: 'guild', time: 'morning' } },
      { text: "The quiet hours. Hunters out, paperwork in. I miss the hunting.", when: { loc: 'guild', time: 'afternoon' } },
      { text: "[happy] Evening. Feast tables fill up and stories get taller. The wolf on the wall grows a foot every time I tell it.", when: { loc: 'guild', time: 'evening' } },
      { text: "Late, recruit. Good hunters sleep. Great ones sleep with one eye open. I've only got the one, so I cheat.", when: { time: 'night' } },
      { text: "Rain. Tracks wash out. Wolves get bold. Laura gets happy. Terrifying all round.", when: { weather: 'rain' } },
      { text: "Mist. Stay on the paths. If something calls your name in the fog, don't answer. It's never Mirabel.", when: { weather: 'mist' } },
      { text: "Starfall. In the war we read it as an omen. Usually good. Once very bad. Let's call it good.", when: { weather: 'starfall' } },
      { text: "New moon. Double bounty pay, triple the danger. Choose your contracts like your friends. Carefully.", when: { moon: 'new' } },
      { text: "[happy] Lantern Moon. Don't ask me to dance. ...Ask me to dance. I'll pretend to refuse.", when: { moon: 'full', time: 'evening' } },
      { text: "Recruit. You're not dead. Good. Keep that up.", when: { maxHearts: 2 } },
      { text: "You've the makings of a hunter. Stubborn as a mule. From me, that's a compliment.", when: { minHearts: 3 } },
      { text: "[sad] I had a son. Hunted beside me. Better than me. Gone thirty years. You've his habit of coming back late.", when: { minHearts: 5 } },
      { text: "[happy] The hunters call you 'the Keeper' now, not 'the farmer.' Rank isn't on paper, recruit. It's in their voices.", when: { minHearts: 7 } },
      { text: "I've trained a hundred hunters. Proud of most. You, I'd follow into a cave. Don't let it go to your head.", when: { minHearts: 9 } },
      { text: "Laura's the best hunter I've trained. Sharpest tongue, too. I remember her birthday. She pretends that's annoying." },
      { text: "Ronan forges our blades. Never late, never cheap, never talks. I could hug the man. I won't." },
      { text: "Caspian wanted to join as a 'dragon specialist.' I said we don't hunt dragons. He said 'exactly.' Insufferable boy. Good boy." },
      { text: "Jasmine's honey cakes are the only thing that's ever left me speechless. Mostly because I eat them in one bite." },
      { text: "[happy] Amara's beaten me at Siege & Serpents thirty-nine times. I beat her once. I'll mention it at her wedding." },
      { text: "Corvin sends delvers my way. I send them back alive. We've an understanding, the gravekeeper and me. Fewer graves." },
      { text: "Brann and I served together, long ago. He carried a hammer, I carried a grudge. Both still heavy." },
      { text: "Floor twenty-five. You're Silver material, recruit. Keep your shield up and your ego down.", when: { flag: 'depths25' } },
      { text: "[happy] The Archon. You did what my whole Guild couldn't in thirty years. ...Sit. I'm pouring you a stout. Don't argue.", when: { flag: 'archonDefeated' } }
    ],
    repeat: [
      "Back again, recruit? The board hasn't changed in an hour.",
      "Twice in one day. Either you're keen or you're lost. Which?",
      "I'm reading reports. Sit if you like. Quietly.",
      "[happy] Recruit. Good to see you breathing."
    ],
    gift: {
      love: [
        "[surprised] {item}. ...Hm. That's a fine gift, recruit. A very fine gift.",
        "[happy] {item}! You've been listening to my stories. Dangerous habit. Thank you.",
        "[happy] {item}. That goes on the wall, next to the wolf. Highest honour I've got."
      ],
      like: [
        "{item}. Good. Useful. Thank you.",
        "[happy] {item}, eh? You've a practical streak. I approve.",
        "{item}. That'll serve. Much obliged."
      ],
      neutral: [
        "{item}. Hm. Noted.",
        "{item}? Well. Thank you, recruit.",
        "{item}. I'll find it a shelf."
      ],
      dislike: [
        "{item}? Recruit. I'm sixty. I don't do sweets and flowers.",
        "{item}. That's... decorative. Give it to Jasmine.",
        "{item}. Hm. I'll pretend I didn't see that."
      ],
      hate: [
        "[angry] {item}! Get that out of my hall before the trophies see it!",
        "[angry] {item}?! I've fought trolls with better manners!"
      ]
    },
    giftDone: [
      "One gift a day, recruit. Discipline.",
      "Already had one from you today. Don't spoil an old soldier."
    ],
    hearts: {
      2: {
        pages: [
          "Recruit. Your first contract's done. Clean, quick, nobody hurt. Sit down.",
          "I keep a ledger of every hunter's first job. Look. That's Laura's. Twelve slimes and a broken nose. Hers.",
          "[happy] Yours goes in here now. Here's a bonus. Don't spend it all on Elvis's fizzy nonsense."
        ],
        reward: { glimmer: 300 }
      },
      4: {
        pages: [
          "[happy] Sit. Story time. The Siege of Thornwall. Three days, no sleep, one troll, one spoon.",
          "We ran out of arrows. Then swords. Then patience. I hit the troll with the cooking pot. It apologised.",
          "...Some of that's true. The pot's real. It's on the wall. Here. My lucky wolf fangs. Mostly lucky."
        ],
        reward: { item: 'wolf_fang', qty: 2 }
      },
      6: {
        pages: [
          "[sad] The sword on my desk was my son's. I polish it every morning. Thirty years. Habit. Hope. Same thing.",
          "He'd have liked you. Stubborn. Late for supper. Always came back with a story.",
          "[happy] ...Enough. Here. Hollowroot Stout, his favourite. Drink one for him when you come back from something hard."
        ],
        reward: { item: 'drink_hollow', qty: 2 }
      },
      8: {
        pages: [
          "Recruit. Stand up straight. ...I'm putting your name on the Guild's honour roll. Don't make that face.",
          "[happy] Thirty years, I've given that honour to four hunters. Laura's one. You're five. My son was the first.",
          "[sad] ...He'd be glad you're here. So am I. There. I said it. Now get out before I get sentimental.",
          "Take this antler shard. From the hollowstag I tracked ten years and never caught. Catch it for me."
        ],
        reward: { item: 'antler_shard', qty: 1 }
      },
      10: {
        pages: [
          "[happy] Recruit. No. Keeper. ...Friend. Sit. The pipe's lit, the stout's poured, and I've a story I've never told.",
          "The night my son died, a stranger pulled me out of the Depths. Gave me a healing draught and vanished. Smelled of lavender and soot.",
          "[surprised] Took me years to work out who. Morwenna. She never said a word about it. Not one. Stubborn old saint.",
          "[happy] So I've owed your family thirty years of thanks. Here's a start. And this hall is yours. Always."
        ],
        reward: { glimmer: 2000 }
      }
    }
  };

  // ================================================================ THE NIGHT MERCHANT
  T.npcs.nightmerchant = {
    name: 'The Night Merchant', short: 'Night Merchant', title: 'Keeper of the Night Market',
    bio: "A hooded trader with softly glowing violet eyes who arrives every few nights by glowing carriage, and knows far more than he says.",
    intro: [
      "Ah. A new light in the Close. Welcome, keeper. The Night Market opens when the town sleeps and closes before it wakes.",
      "[happy] I am the Night Merchant. I sell what is rare, buy what is curious, and trade in things that have no price. Mostly.",
      "Your Morwenna was a regular, you know. She always haggled. She always won. Shall we see if it runs in the family?"
    ],
    talk: [
      { text: "Everything has a price, keeper. Most prices are not paid in glimmer. Those are the interesting ones." },
      { text: "[happy] A riddle, for free. Sold by the yard, worn by the sky, bought by night and gone by day? My cloak, of course." },
      { text: "The pools in the Close hold the cathedral's colours by day and the stars by night. I like to sell where things are reflected." },
      { text: "I have travelled far. Further than the capital. Further than the sea past the mountains. Not as far as I intend to." },
      { text: "My carriage glows because it is full of light I have collected. A candle from every town. A spark from every promise." },
      { text: "Some want what they need. Some want what they want. The rare ones want what they lost. Those I help for free." },
      { text: "[happy] You are wondering about my face. Everyone does. It is under the hood, keeper, where faces belong at night." },
      { text: "The Lunar Order bought from me once. Silver thread and star-ink. They always paid on time. Always in songs." },
      { text: "The Depths keep a library, a garden and a witch's kitchen, if you know where to look. One floor in ten, or so. I said nothing." },
      { text: "I never haggle on the first night. On the second, I enjoy it. On the third, I let you win. A very old custom." },
      { text: "[sad] Morwenna once sold me a single laugh, to pay for a seedling. I have kept it in a jar ever since." },
      { text: "The mystery boxes? I do not know what is inside. That is the point. Even merchants deserve surprises." },
      { text: "[happy] The lanterns are lit and the pools are still. Evening is the honest hour, keeper. Come, browse.", when: { time: 'evening' } },
      { text: "Midnight is my favourite customer. It never haggles, and it always comes back.", when: { time: 'night' } },
      { text: "Rain on the pools. Every drop a little bell. I lower my prices when it rains. Slightly. Rain bargains poorly.", when: { weather: 'rain' } },
      { text: "[happy] Mist. The Close disappears and only the Market remains. My favourite kind of evening.", when: { weather: 'mist' } },
      { text: "[surprised] A starfall. Old friends, dropping in. Bring me what you find. I pay best for stars that land softly.", when: { weather: 'starfall' } },
      { text: "New moon. The Depths are generous tonight, and hungry. Buy a lantern. I insist. Well. I suggest.", when: { moon: 'new' } },
      { text: "[happy] The Lantern Moon. Every wish in the valley floats past my stall tonight. I read a few. I never tell.", when: { moon: 'full', time: 'evening' } },
      { text: "[happy] You come back. Customers who come back are the only treasure that grows.", when: { minHearts: 3 } },
      { text: "Call me Vael when we are alone. In the Market I am only the Night Merchant. Names are expensive here.", when: { minHearts: 5 } },
      { text: "[sad] I have watched this valley for longer than I can say. The moon grew pale. Then you came. The moon remembers.", when: { minHearts: 7 } },
      { text: "[happy] I thought I walked toward this valley for its light. I see now it was for its people. For you, in part.", when: { minHearts: 9 } },
      { text: "Fennick sells by day; I sell by night. He waves, I nod. It is the politest rivalry in the world." },
      { text: "[happy] Orvyn buys star-ink from me and never remembers buying it. So I sell it to him again. An honest arrangement." },
      { text: "Seraphine says my lanterns shine in colours she cannot name. She is making glass to match. She will succeed." },
      { text: "Grizelda once looked under my hood. I let her. She has never spoken of what she saw. She buys me a drink every year." },
      { text: "Floor twenty-five, and still walking. The Depths respect you, keeper. That is no small thing.", when: { flag: 'depths25' } },
      { text: "[happy] The Archon is gone and the moon is bright. I sold you nothing for it. You did it anyway.", when: { flag: 'archonDefeated' } }
    ],
    repeat: [
      "[happy] Back so soon? The Market has not changed. I may have.",
      "Twice in one night. You are either lucky or curious. Both are good for business.",
      "Browse, keeper. Silence is free.",
      "The stars have moved a hair since you left. So have my prices. Upward, naturally."
    ],
    gift: {
      love: [
        "[surprised] {item}. For me? It has been a very long time since anyone gave me a gift. It will ride with the light in my carriage.",
        "[happy] {item}. Exquisite. An eye for treasure and a heart for giving it away. A rare pair, keeper.",
        "[happy] Ah, {item}. Worth far more than you know. I will not tell you how much. That would spoil it."
      ],
      like: [
        "[happy] {item}. A fine trade, except that you asked for nothing. How unusual.",
        "{item}. I know a buyer in a far city who would weep. I think I will keep it instead.",
        "[happy] {item}. Thank you, keeper. The night approves."
      ],
      neutral: [
        "{item}. Every object is precious to someone. I will find the someone.",
        "{item}? A curious gift. I collect curious things.",
        "Thank you. {item} will ride in the carriage. It will see the world."
      ],
      dislike: [
        "{item}. ...Ah. Even I cannot sell this.",
        "{item}? Keeper, I am a merchant of wonders. This is not one.",
        "{item}. I will leave it by the road. Someone will find it. Someone always does."
      ],
      hate: [
        "[angry] {item}. Take it away, please. Some things are too heavy even for my carriage.",
        "[angry] {item}? No. That is the one bargain I refuse."
      ]
    },
    giftDone: [
      "One gift a night, keeper. Any more and I would owe you. I dislike owing.",
      "[happy] You have already given me something. Save the rest for another night."
    ],
    hearts: {
      2: {
        pages: [
          "Keeper. A gift, for a good customer. Do not open it here. Do not open it in daylight. ...I jest. Open it anywhere.",
          "A mystery box. Even I do not know what is inside. That is the only honest way to sell a mystery.",
          "[happy] If it is wonderful, you are welcome. If it is a sock, it is a very rare sock."
        ],
        reward: { item: 'mystery_box', qty: 1 }
      },
      4: {
        pages: [
          "You have bought, sold and haggled with me many nights now. So I will give you something I sell to no one.",
          "[happy] My name. It is Vael. Keep it somewhere safe. Names are the only thing I have ever been afraid to lose.",
          "[sad] Morwenna knew it. She never once used it in front of anyone. Only when we argued about the price of moonlight.",
          "[happy] Take these starshards. A small price for the privilege of being called by my name."
        ],
        reward: { item: 'starshard', qty: 3 }
      },
      6: {
        pages: [
          "[sad] This jar. Morwenna sold me a single laugh, long ago, to pay for a Moonroot seedling. I have kept it ever since.",
          "Listen. ...There. Still laughing. Fifty years, and it has never once run out.",
          "[happy] I think the laugh belongs with you now. The jar stays with me; the jar is mine. Just open it, and listen.",
          "And these moon pearls. A merchant should never send a friend home empty-handed."
        ],
        reward: { item: 'pearl', qty: 2 }
      },
      8: {
        pages: [
          "Walk with me to the pools, keeper. ...Look into the water. Do you see the stars? Count them.",
          "[surprised] You counted one more than the sky holds. Most never notice. The Order did. Amara will, soon.",
          "[sad] I have been walking toward this valley for a very long time. I will not tell you from where. Not yet. Perhaps never.",
          "[happy] This cloak is woven from the night I set out. I have another. Take it, and wear the sky. It suits you."
        ],
        reward: { item: 'cl_cloak_starweave', qty: 1 }
      }
    },
    shop: {
      greet: [
        "[happy] Welcome to the Night Market, keeper. Rare goods, curious goods, and goods with no names yet.",
        "Ah, a customer by lantern light. Browse slowly. The night is long, and so is my memory.",
        "Come closer. The best wares are always at the back, and the back is always further than it looks."
      ],
      bye: [
        "[happy] Go gently, keeper. The night will keep your secrets. So will I.",
        "Until the next market. I will know where to find you. I always do."
      ]
    }
  };

  // ---------------------------------------------------------------- examine texts
  T.flavor = {
    // --- Sanctum
    altar_dormant: [
      "The Moon Altar. A cracked basin of pale stone, cold to the touch. Moonroot vines curl around its foot, grey and sleeping.",
      "Five empty hollows ring the rim. Something is meant to rest in each of them."
    ],
    altar_partial: [
      "The altar hums faintly. Silver light pools in the hollows you've filled, and the Moonroot vines have begun to glow.",
      "It's waking. Slowly, like an old woman getting out of bed. Complaining a little."
    ],
    altar_restored: [
      "The Moon Altar blazes with cold, clean light. The Moonroot pulses beneath your feet like a heartbeat.",
      "For a moment you smell lavender and singed sugar, and hear a very satisfied little 'hmph.'"
    ],
    sanctum_pool: [
      "The reflecting pool. The Order read the moon's moods in its surface. Your reflection looks back: tired, muddy, hopeful.",
      "A single moonlily drifts at the edge, as if waiting for company."
    ],
    sanctum_mural: [
      "A faded mural: robed figures carrying baskets of light down into a mountain. Above them, the moon sheds one silver tear.",
      "In the corner, in much fresher paint, someone has added a small, smug black cat. Morwenna, almost certainly."
    ],
    morwenna_desk: [
      "Morwenna's desk. Ink stains, dried lavender, a cracked teacup, and a list titled 'Things To Do Before I Die.' Item one: 'Don't.'",
      "At the bottom, in shakier writing: 'Leave the Sanctum to the apprentice. They'll grumble. They'll manage.'"
    ],
    sanctum_bookshelf: [
      "Titles: 'Moonroot and Its Moods.' 'A Keeper's Almanac.' '101 Uses for a Mandrake (102 If Desperate).'",
      "'Grizelda Hexley Is Wrong: A Rebuttal, Volume Four.' Volumes one to three appear to have been thrown at someone.",
      "A slim book labelled 'Recipes I Pretend Not To Know' is empty, except for a pressed moonpetal and a smudge of soot."
    ],
    sanctum_bed: [
      "Your bed, tucked in the keeper's cottage. The quilt is patched with forty little fabric moons. It smells faintly of cat.",
      "Sleeping ends the day. Inkwell will wake you at dawn regardless."
    ],
    sanctum_statue: [
      "The Moon Goddess, carved by the Lunar Order, cradling a crescent in her arms. Lichen has crept into the folds of her robe.",
      "The plinth reads: 'Tend the light, and the light will tend you.'"
    ],
    sanctum_gate: [
      "The Sanctum gate. Rusted iron moons twist through the bars. It creaks as if it has opinions.",
      "Near the hinge, someone small has scratched: 'PIP WAS HERE (FOR SCIENCE).'"
    ],
    sanctum_well: [
      "An old stone well. A dropped pebble takes a long time to land. The water far below glows faintly blue.",
      "Morwenna's bucket still hangs from the rope. It has been patched with a cauldron lid."
    ],
    // --- Hollowmere
    moonwell: [
      "The moonwell. Villagers toss glimmer in for luck. Among the coins at the bottom glints a single brass goggle lens.",
      "A soggy note is tied to the rim: 'I wish for more explosions. -P'"
    ],
    village_sign: [
      "WELCOME TO HOLLOWMERE. Please do not feed the moon.",
      "Underneath, smaller: 'Or the Captain. Either will follow you home.'"
    ],
    shop_sign_seeds: [
      "THORNWICK'S SEEDS & SUNDRIES. 'If it grows, we have it. If it doesn't, we have tea.'"
    ],
    tavern_sign: [
      "THE GILDED OWL. Food, fire, and finely aged rumours. Bards welcome. Brawlers, less so."
    ],
    village_statue: [
      "A statue of Hollowmere's first settler, raising a lantern toward the Sanctum. The pigeons have crowned him generously.",
      "The plaque reads: 'He followed the light, and found a home.'"
    ],
    mirabel_garden: [
      "Mirabel's garden. Every row perfectly straight, every leaf perfectly loved. A small sign: 'PIP, do NOT test anything here.'",
      "A mandrake in the corner glares at you. It's wearing a tiny knitted hat."
    ],
    river_bridge: [
      "An old stone bridge. Carved in the rail: 'M.T. + M.V. = MANDRAKE CHAMPIONS.' Someone has scratched out 'M.T.'",
      "Someone else has carefully scratched it back in."
    ],
    notice_board: [
      "The notice board. Requests, a lost glove, and a poster: 'HOLLOWMERE MANDRAKE SHOW. Hats optional. Biting discouraged.'"
    ],
    village_lamp: [
      "A moonlamp. Instead of a flame, a moonpetal floats in the glass globe, glowing softly. Morwenna planted these years ago."
    ],
    tavern_window: [
      "A great round window shaped like the full moon. Its old glass ripples, so whatever's on the other side looks like a memory.",
      "Lamplight on one side, the night on the other, and the moon looking in on both."
    ],
    // --- Whisperwood
    fairy_ring: [
      "A ring of violet-spotted mushrooms. Quiet now, but the grass inside is softer, greener, and very slightly humming."
    ],
    fairy_ring_full: [
      "Under the full moon the fairy ring glows. Tiny lights drift between the caps like slow, sleepy fireflies.",
      "Faint music comes from very far away. It sounds like it's laughing at you. Kindly."
    ],
    hollow_tree: [
      "A hollow tree. Inside: an owl feather, three acorns, and a tiny note in neat handwriting: 'For whoever needs it.'"
    ],
    woods_shrine: [
      "A mossy shrine to the forest spirits. Offerings rest on the stone: a feather, a pinecone, one slightly burnt biscuit.",
      "The biscuit is almost certainly Pip's."
    ],
    grizelda_cauldron: [
      "Grizelda's cauldron. It bubbles, belches, and seems to be looking at you. Brann did give it a face, after all.",
      "Something inside says 'blub.' You decide not to ask."
    ],
    grizelda_skulls: [
      "A shelf of skulls, each with a neat little label: 'Raven, Retired.' 'Mystery Goat.' 'Not A Skull, Just A Gourd.'",
      "That last one is definitely a gourd. Probably."
    ],
    elowen_grove: [
      "Elowen's grove. Wildflowers grow in gentle spirals, and every tree wears a name on a leaf-shaped wooden tag.",
      "At the edge sits an empty basket, faintly smelling of fairycaps. Nobody admits to leaving it."
    ],
    bog_sign: [
      "SOUTHERN MIRE. TURN BACK. SERIOUSLY. -G.H.",
      "Below, in different ink: 'Unless you've brought biscuits.'"
    ],
    woods_sign: [
      "WHISPERWOOD. Please walk softly. The trees are listening.",
      "In very small letters underneath: 'So am I. -E.'"
    ],
    mushroom_circle: [
      "A circle of glowcaps, faintly luminous. They brighten as you lean closer, then dim, as if embarrassed."
    ],
    // --- Glimmermere
    moon_statue: [
      "A great statue of a moon-crowned lady, half-sunk in Glimmermere. Lilies gather at her shoulders like attentive cats.",
      "Her stone eyes are fixed on the Ridge, as if keeping watch for something."
    ],
    dock_sign: [
      "GLIMMERMERE DOCK. No swimming. No whistling. No questions about the Captain's eye."
    ],
    lune_boathouse: [
      "Captain Lune's boathouse. Nets, lures, and a framed drawing of a fish labelled 'THE ONE THAT GOT AWAY (IT WAS HUGE).'",
      "By the door hangs an old adventurer's sword. Polished every day. Never drawn."
    ],
    lake_shrine: [
      "A small lakeside shrine of the Lunar Order. Carved waves cradle a crescent moon. Shells have been left on it like little prayers."
    ],
    sunken_bell: [
      "A bronze bell, sunk in the shallows and green with age. The Order once rang it to call the moon's reflection home.",
      "Fishers say that on full moons it rings by itself. Very softly. Underwater."
    ],
    // --- Starfall Ridge
    observatory_door: [
      "The Observatory door. The knocker is a brass comet. A note: 'Gone stargazing. Or napping. Knock loudly. -O.'"
    ],
    telescope: [
      "You peer through the telescope. The moon fills the lens, enormous and pale, its craters like old thumbprints.",
      "For a moment you're almost sure it blinks."
    ],
    forge_anvil: [
      "Brann's anvil, scarred by a thousand hammer blows. A small wooden owl sits on the edge, half carved.",
      "You get the feeling you weren't meant to see the owl."
    ],
    grave_1: [
      "MORWENNA VALE. Keeper of the Verdant Sanctum. Alchemist. Right About Most Things.",
      "The earth is fresh. Someone has left a jar of slugs, a duskberry pie, and a single glowing starshard."
    ],
    grave_2: [
      "TOBIAS FENNICK THE ELDER. He said the bridge would hold.",
      "Underneath, smaller: 'It did. He tripped on the way back.'"
    ],
    grave_3: [
      "SISTER ALBA OF THE LUNAR ORDER. She tended the light for ninety years, and the light tended her."
    ],
    grave_4: [
      "BRAMWELL IRONROOT. Smith. He hit things very hard, and loved his family harder.",
      "A tiny wooden hammer has been left on the headstone. It's beautifully carved."
    ],
    grave_5: [
      "HERE LIES BISCUIT. Best Goose. Bit Everyone. Missed By Some."
    ],
    grave_wren: [
      "WREN ASHGRAVE. Not buried. Not found. Not forgotten.",
      "Under a stone lies a folded map of the Depths, inked in careful, tired handwriting. A new one, by the look of it."
    ],
    depths_entrance: [
      "The mouth of the Umbral Depths. Cold air breathes out of the mountain, smelling of stone and something sweetly rotten.",
      "Carved above the arch: 'What the moon lost, the dark keeps. Go gently.'"
    ],
    ridge_lookout: [
      "From up here you can see all of Nightvale: the Sanctum, the village lights, the lake like a dropped mirror.",
      "The moon hangs close enough to make you dizzy."
    ],
    ridge_cairn: [
      "A cairn of stacked stones. Delvers add one before going down, and take one away when they come back up.",
      "There are a great many stones."
    ],
    lodge_sign: [
      "THE DELVERS' LODGE. Weapons. Supplies. Monster Parts Bought. Proprietor: C. Ashgrave.",
      "Hours: ten till six. Or until I get sad. -C."
    ],
    // --- Umbral Depths
    rune_gate: [
      "A Rune Gate. Silver runes circle a ring of black stone. They brighten at your touch, as if remembering you."
    ],
    depths_mural: [
      "A mural cut into the rock: a sliver of moon falling from the sky, and the Order kneeling around it with lanterns.",
      "In the last panel a shadow rises behind the light. Someone has scratched out its eyes."
    ],
    depths_bones: [
      "Old bones, picked clean. A broken lantern lies nearby. You hope whoever carried it made it home."
    ],
    archon_door: [
      "A great door of black stone, sealed with five silver moons. Behind it, something breathes. Slowly. Patiently.",
      "The door is cold. Colder than stone has any right to be."
    ],
    crystal_pool: [
      "A pool of glowing water ringed with crystals. Your reflection looks back, faintly silver, and a little braver than you feel."
    ]
  };

  // ---------------------------------------------------------------- expansion: examine texts
  var F2 = {
    // --- The Gilded Owl, inside (tavern_window is shared with the exterior; see above)
    tavern_hearth: [
      "The hearth burns with violet-green fire that smells faintly of cloves and rain. It warms your hands without ever scorching them.",
      "Elvis says Morwenna lit it with a spell on opening night and it's never once gone out. Sable says Elvis says a lot of things."
    ],
    tavern_bottles: [
      "Shelves of glowing bottles line the wall behind the bar: violet, gold, mint and rose. Some fizz. One appears to be humming a ballad.",
      "A small card reads: 'Please do not touch the top shelf. The top shelf touches back. -E.'"
    ],
    tavern_stage: [
      "A little stage of dark polished wood, its edge lined with candle stubs. A lute waits on a stand for Sable's hands.",
      "Carved into one board: a small heart and the letters S + L. Someone sanded it away, once. Someone else carved it back."
    ],
    tavern_chandelier: [
      "A chandelier of floating candles drifts lazily above the tables. Every so often one wanders off and has to be called back.",
      "Elvis calls them by name. They come. Mostly."
    ],
    tavern_board: [
      "A chalkboard in looping handwriting: 'STARDUST FIZZ. Fizzes, sparkles, makes your feet fast. Do NOT give to Pip.'",
      "'Moonmilk Nog. Dragonbreath Cider. Frostberry Spritz. Mistwine. Hollowroot Stout. A story free with every glass. -E.'"
    ],
    // --- Quillon's Threads & Tomes
    boutique_books: [
      "Books lean together like gossiping neighbours: 'The Widow of Wyrmsday Manor.' 'Lace and Lamentation.' 'The Count's Third Cravat.'",
      "A pressed moth marks page 212 of 'Bride of the Black Fen.' Underlined in violet ink: 'She never trusted a cheerful butler.'"
    ],
    boutique_mirror: [
      "A tall mirror in a frame of tarnished brass vines. Your reflection looks back, a little dustier than you'd hoped.",
      "A card tucked into the frame reads: 'Stand up straight. -I.Q.'"
    ],
    boutique_ladder: [
      "A rolling iron ladder on a rusty rail, reaching the highest shelves. It squeals when it moves, like a soprano warming up."
    ],
    boutique_crow: [
      "Quill the crow watches you from the ladder, head tilted, eyes like two polished buttons. He is looking at your buttons.",
      "He clacks his beak once. You get the distinct feeling your posture has been judged, and found wanting."
    ],
    boutique_rack: [
      "A rack of coats, cloaks and hats: midnight blue, ember red, raven black, moss green. Each tag is written in elegant violet ink.",
      "One tag simply says: 'NO. Not with those boots.'"
    ],
    // --- The Cathedral of the Silver Veil
    cathedral_window_1: [
      "The first window: the founding. Robed figures plant a single glowing root beneath an enormous moon.",
      "From that root, silver lines run out across the glass like rivers, into every corner of the valley."
    ],
    cathedral_window_2: [
      "The second window: the Starfall. A burning sliver of moon falls into a mountain, and tiny figures kneel all across the valley.",
      "The falling light is made of a hundred slivers of real starshard. It glitters even on cloudy days."
    ],
    cathedral_window_3: [
      "The third window: the descent. Keepers carry lanterns down into the dark, and one figure walks ahead of the rest, alone.",
      "That lone figure's face has been left as clear glass, as if the maker couldn't bear to finish it."
    ],
    cathedral_window_4: [
      "The fourth window: the sealing. Five keepers lift five offerings to a blazing altar, and a great shadow is held behind a door of moons.",
      "Beneath it, in old letters: 'What grows, what is found, what is won, what is brewed, what is caught.'"
    ],
    cathedral_pool: [
      "A long reflecting pool, still as a held breath, glowing with every colour the windows throw. Coins rest on the bottom like fallen stars."
    ],
    cathedral_tree: [
      "A small tree in a stone pot, grown from a Sanctum cutting. Its leaves lean toward the windows, as if listening."
    ],
    cathedral_door: [
      "Great doors of black oak, bound with silver crescents. Carved above them: 'Enter quietly. The light is listening.'"
    ],
    veil_altar: [
      "The Veil Altar: a slab of pale stone beneath a curtain of silver gauze that stirs though there is no wind.",
      "Pray here once a day, and the windows may lend you a little of their light. Seraphine calls it luck. The windows don't say."
    ],
    veil_prayer_done: [
      "You've already prayed today. The silver veil stirs gently, as if to say: we heard you. Come back tomorrow."
    ],
    // --- The Deepwood
    deep_stones: [
      "A ring of standing stones, taller than houses and furred with moss. Their carvings show the moon in every phase, worn almost smooth.",
      "Inside the ring the air is still and cold. Even the birds go quiet here."
    ],
    deep_watchtower: [
      "A ruined watchtower of the Lunar Order, its top long since fallen. Ivy has claimed every stone. An owl watches from a broken window.",
      "Above the door, a faded carving of a lantern and a crescent: 'We watch so the valley may sleep.'"
    ],
    deep_sealed_chest: [
      "An iron-bound chest, sealed with a heavy rusted lock. A crescent moon is engraved around the keyhole. It wants a very old key."
    ],
    deep_elder_tree: [
      "The Elder Tree. Its trunk is wider than a cottage, its roots older than the Order. Fireflies drift through its branches like slow sparks.",
      "Press your palm to the bark and you feel a heartbeat, deep and slow. The forest's own."
    ],
    deep_campsite: [
      "An abandoned campsite: a cold fire ring, a torn tent, a cracked mug. A journal lies open to a page that reads only 'Turned back. Wise.'"
    ],
    deep_bones: [
      "Bones, half buried in moss and leaves. Something large, and very old. Ferns grow up through its ribs."
    ],
    deep_web_cocoon: [
      "A web cocoon the size of a person hangs from a branch, swaying slightly. You decide, firmly, not to find out what's inside."
    ],
    deep_shrine: [
      "A tiny forest shrine, swallowed by roots. A stone hare sits on top, its ears worn soft by centuries of rain and gentle hands."
    ],
    deep_sign_warning: [
      "TURN BACK. The words are carved deep, then carved again, deeper, by a different and more worried hand.",
      "Below, in small neat letters: 'Please. Not at night. -E.'"
    ],
    // --- Hushwillow Glade
    glade_pond: [
      "A small round pond, bright with lily pads. A frog dozes on every leaf, and fireflies hover over the water as if listening for something."
    ],
    glade_sign: [
      "HUSHWILLOW GLADE. Shh. Everyone here is sleeping.",
      "Painted underneath: a tiny curled-up fox, and a heart."
    ],
    glade_willow: [
      "A great willow trails its branches in the grass like long green hair. Under its curtain the light turns soft, gold and very quiet."
    ]
  };
  for (var fk in F2) T.flavor[fk] = F2[fk];

  // ---------------------------------------------------------------- Veil Altar blessings (one is shown when you pray)
  T.prayers = [
    "Coloured light falls across your hands. You feel lucky, like a coin landing the right way up.",
    "The windows hum a note too low to hear. Something in you steadies. Fortune leans your way.",
    "The veil stirs. For a moment you smell lavender and old stone. Luck walks beside you for a while.",
    "A beam of rose-gold light finds you and lingers. The day feels a little kinder, and a little luckier.",
    "Somewhere above, a pane chimes softly. The windows have remembered your prayer. Luck is with you.",
    "Every candle leans toward you at once, then settles. You feel watched over. Lucky, even."
  ];

  // ---------------------------------------------------------------- Hushwillow critters (petting them while they sleep)
  T.critters = {
    fox: [
      "The fox's tail twitches over its nose. It sighs a tiny, contented sigh and burrows deeper into its own fur.",
      "You stroke the fox's ear. It flicks once, then settles. Somewhere in a dream, it's chasing a very slow mouse.",
      "The fox curls a little tighter under your hand, warm as a loaf fresh from Mirabel's oven.",
      "The sleeping fox presses its head into your palm without waking. Trust, it turns out, is warm and slightly ginger."
    ],
    deer: [
      "The deer's flank rises and falls, slow as a tide. One ear turns toward you, then relaxes.",
      "You rest a hand on the deer's soft neck. It breathes out through its nose, a long and peaceful huff.",
      "The deer's legs twitch. Dreaming of running, perhaps. It settles again beneath your hand.",
      "A firefly lands on the sleeping deer's nose. It wrinkles, sneezes softly, and sleeps on."
    ],
    rabbit: [
      "The rabbit's nose wiggles in its sleep. Even dreaming, it's very busy.",
      "You smooth the rabbit's ear flat. It springs straight back up. Rabbit ears have opinions.",
      "The rabbit thumps one back foot, gently, without waking. Possibly a dream about clover.",
      "The sleeping rabbit is softer than anything has a right to be. Your heart does a small hop."
    ],
    owl: [
      "The owl puffs into a fluffy ball and opens one eye a sliver. It decides you're allowed, and closes it again.",
      "You smooth the owl's feathers. It makes a tiny sleepy sound, somewhere between a hoot and a yawn.",
      "The owl leans its head against your finger. For a creature of the night, it's terribly fond of naps.",
      "The owl shifts on its branch, and a single soft feather drifts down and settles on your sleeve."
    ],
    hedgehog: [
      "The hedgehog snuffles in its sleep and uncurls a little, showing a tiny pink nose.",
      "You stroke the hedgehog very carefully, with the grain. Its prickles soften, the way a grumpy friend's do.",
      "The hedgehog lets out a small snore. It's the most important sound in the glade.",
      "The sleeping hedgehog sighs and curls around your fingertip. You are, apparently, acceptable."
    ]
  };
  // the same data is also reachable under flavor, for engines that look there
  T.flavor.prayers = T.prayers;
  T.flavor.critters = T.critters;

  // ---------------------------------------------------------------- item tooltips (<= 110 chars)
  T.items = {
    // tools & weapons
    hoe: "Tills soil for planting. Runes on the blade wake the Moonroot below. Brann can upgrade it.",
    can: "Waters crops. Morwenna painted little moons on it; most have chipped off. Refill at any water.",
    pickaxe: "Breaks rocks and ore. Brann says a good pick listens to the stone. This one mostly argues.",
    axe: "Chops trees, stumps and branches into wood. Sturdy, honest, slightly chipped.",
    sword_rusty: "An old Order blade, more rust than moon. Better than bare hands. Barely.",
    sword_silver: "Light, quick and bright as frost. The Mossy Hollows learn to fear it.",
    sword_star: "Forged with fallen starlight. It hums softly in the dark and bites deep.",
    sword_umbral: "Black steel that drinks the shadows it cuts. Fit to face the Archon itself.",
    wand_apprentice: "Fires small bolts of moonlight at range. Every alchemist starts somewhere.",
    wand_ember: "Spits fiery bolts that hit hard. Pip would trade his goggles for one.",
    wand_astral: "Calls down shards of starlight. Orvyn calls it 'a telescope that bites.'",
    rod: "Cast into Glimmermere and wait for a bite. Patience, and a good story, do the rest.",
    // seeds
    seed_moonpetal: "Ready in 4 days. Forgiving, glowing, and the perfect first crop.",
    seed_glowcap: "Mushroom spores. Ready in just 3 days. They love shade and a little rot.",
    seed_mandrake: "Ready in 6 days. Harvesting may involve screaming. Theirs, hopefully.",
    seed_frostmint: "Ready in 5 days, then regrows every 3. The leaves stay cool to the touch.",
    seed_emberroot: "Ready in 7 days. Mind your fingers at harvest: the roots come up hot.",
    seed_duskberry: "Grows into a bush in 8 days, then fruits again every 4. Worth the wait.",
    seed_starbloom: "Blooms in 10 days and sells for a small fortune. Very sparkly. Grizelda disapproves.",
    seed_wispvine: "A pale cutting. Climbs its trellis in 9 days, then rings with wispblooms every 3.",
    seed_phialvine: "In 8 days its fruit ripens into Healing Draughts, then again every 4. Bottled by nature.",
    seed_starflask: "In 10 days this bulb grows flasks of Vigor Tonic, two at a time. Regrows every 5.",
    // crops
    moonpetal: "Pale-blue flower with a glowing core. Brew two into a Healing Draught. Mirabel adores them.",
    glowcap: "Luminous cyan-violet mushroom. Brew with frostmint for a Vigor Tonic. Pip's favourite.",
    mandrake: "A root with a grumpy face. Key to the Mandrake Restorative. Grizelda loves a screamer.",
    frostmint: "Icy leaves. Brew with glowcap for Vigor, or with amethyst for a Frostward Philter.",
    emberroot: "Glowing red root, hot to hold. Brew with slime gel for an Emberheart Elixir. Brann loves it.",
    duskberry: "Tart, deep-purple berries. Used in Swiftstep Brew and Shadowveil Draught. And pie.",
    starbloom: "A golden star of a flower. Prized for Starlight Philter and the Elixir of the Moon.",
    wispbloom: "Ghostly white-teal bells. The rarest part of the Elixir of the Moon.",
    // forage
    fairycap: "Violet-spotted forest mushroom. Brew with wolfsbane for a Fairy Draught. Elowen's favourite.",
    wolfsbane: "Purple hooded flower that closes when frightened. Half of a Fairy Draught.",
    moonlily: "White lake lily that glows at night. Brew with mooncarp for a Tidecaller Tonic.",
    feather: "A soft owl feather. Owls only drop them for those they trust. Elowen treasures them.",
    starshard: "A glowing sliver of fallen star. Needed for Starlight Philter. Orvyn adores them.",
    bog_amber: "Golden amber from the mire, with something tiny trapped inside. Grizelda's treasure.",
    driftwood: "Silver-grey wood polished by the lake. The Captain likes it for patching the boathouse.",
    shell: "A mooncockle shell. Hold it to your ear to hear the tide of a lake that has none.",
    pearl: "A moon pearl, softly luminous. Valuable, and much loved by Sable.",
    honey: "Wild honeycomb, sticky and golden. Sweet to most. Grizelda finds it offensive.",
    // resources
    wood: "Good honest timber, for building and for fixing things that leak.",
    stone: "Plain grey stone. Useful for building. Elowen says the mountain misses every piece.",
    fiber: "Tough plant fibres. Twist them into twine, rope, or anything that needs to hold.",
    ore_glimmer: "Ore flecked with light. Brann needs it for the first tier of tool upgrades.",
    ore_shadow: "Cold, dark shadowiron from deeper down. For stronger tool upgrades at the forge.",
    ore_starsilver: "Light as a promise. The finest metal there is, and Brann's favourite gift.",
    amethyst: "A violet gem from the Grotto. Brew with frostmint for a Frostward Philter.",
    emerald: "A deep green gem that catches the lamplight. Valuable, and much admired by Sable.",
    moonstone: "A milky stone full of captured moonlight. Needed for the Elixir of the Moon.",
    quartz: "Arcane quartz that hums faintly. Orvyn grinds it into lenses. Or loses it.",
    voidcrystal: "A crystal of solid darkness from the Abyssal Rift. Rare, cold, and very valuable.",
    // monster loot
    slime_gel: "Wobbly slime gel. Brew with emberroot for an Emberheart Elixir. Pip has many uses for it.",
    bat_wing: "A leathery bat wing. Part of the Shadowveil Draught. Corvin finds it oddly charming.",
    spider_silk: "Strong, sticky silk. Brew with duskberry for Swiftstep Brew. Brann can't stand it.",
    bone_dust: "Fine grey dust from skeletons. Grim to most villagers. Corvin finds it restful.",
    ectoplasm: "Glowing ghost-goo from wraiths. Part of the Shadowveil Draught. Grizelda's delight.",
    arcane_dust: "Glittering dust left by hexmages, still humming with spells. Orvyn studies it.",
    golem_core: "The still-warm heart of a crystal golem. Brann and Pip would both fight you for it.",
    void_essence: "A drop of living darkness, unsettling to hold. Few villagers want it near them.",
    spore_sac: "A puffy sac of shroomling spores. Sneeze-inducing. Grizelda finds it delightful.",
    // fish
    fish_glimmerfin: "A small fish with glittering fins, common in Glimmermere. Pip thinks it's very scientific.",
    fish_mooncarp: "A plump silver carp, common in Glimmermere. Brew with moonlily for a Tidecaller Tonic.",
    fish_mistperch: "A pale perch that only rises in rain or mist. Tastes faintly of fog.",
    fish_ghosteel: "A see-through eel caught only at night. Lune, Corvin and Grizelda all prize it.",
    fish_lanternpike: "A rare night pike with a glowing lure. The Captain's favourite catch to brag about.",
    fish_crownjaw: "Glimmermere's legendary king. Only bites under a full moon. It may still have Lune's hat.",
    // potions
    pot_healing: "Restores 50 health. Red, warm and faintly sweet. Delvers never go down without three.",
    pot_vigor: "Restores 60 energy. Fizzy, green, and tastes like a brisk morning.",
    pot_swift: "Quickens your step for 3 minutes. A bard's favourite exit strategy.",
    pot_ember: "Raises your attack for 3 minutes. Warms you to the toes. Pip's absolute favourite.",
    pot_mandrake: "Fully restores health and energy. Morwenna's secret. It hums a grumpy little tune.",
    pot_frostward: "Raises your defense for 3 minutes. Frost blooms on your skin and claws slide off.",
    pot_starlight: "Luck for a whole day: better drops and more gems. Sable and Lune treasure it.",
    pot_shadow: "Monsters ignore you for 45 seconds. Tastes like a moonless night.",
    pot_fairy: "Restores 30 health and 30 energy. Sparkles on the tongue.",
    pot_tide: "Makes fishing easier for the whole day. Smells of lake water and lilies.",
    pot_moon: "Permanently raises your max health by 10. The Lunar Order's greatest secret.",
    sludge: "A failed brew. Sells for almost nothing. Somehow, Grizelda and Pip both adore it.",
    // food
    food_bread: "Soft lavender-scented bread from Mirabel's oven. A simple, warm bite of energy.",
    food_stew: "Thick, peppery mushroom stew. Restores plenty. Brann's absolute favourite.",
    food_pie: "Sticky duskberry pie, Mirabel's pride. Corvin claims not to like it. It always vanishes.",
    food_mead: "Golden honey mead from the Gilded Owl. Sable and Lune both adore it.",
    food_tea: "Calming starleaf tea. Orvyn has a pot brewing somewhere. Probably since Thornsday.",
    food_coffee: "Coffee black as a moonless night. Corvin lives on the stuff.",
    // placeables & misc
    cauldron: "Place it in the Sanctum, then brew two or three ingredients into a potion.",
    dewcrystal: "Place it in the garden and it waters the nearby crops every morning. Morwenna swore by them.",
    moonmulch: "Moon-touched fertilizer. Spread on tilled soil to help crops grow faster and finer.",
    chest: "A sturdy chest for storing things. Every keeper needs somewhere to hide the sludge.",
    letter: "A folded letter. It smells faintly of lavender and ink."
  };

  // ---------------------------------------------------------------- expansion: item tooltips (<= 110 chars)
  var I2 = {
    // clothing (Isolde)
    cl_hat_wizard: "A tall indigo hat scattered with gold stars, its tip bent from wisdom. Or from a low doorway.",
    cl_hat_witch: "Wide black-plum brim, crooked tip, buckled purple band. Grizelda calls it 'almost respectable.'",
    cl_hat_tricorn: "A black tricorn with a raven feather. Makes any entrance a little more ominous.",
    cl_hat_beret: "Plum velvet with a gold pin. Wear it tilted. Isolde insists.",
    cl_hat_hood: "A deep green cowl, woven like moss. The forest will think you're one of its own.",
    cl_hat_crown: "Violet and white flowers that never quite wilt. Bees may ask you for directions.",
    cl_hat_tophat: "A tall black top hat with a silver crescent band. A full stop with ambitions.",
    cl_hat_circlet: "A thin silver circlet set with a moonstone. It glows faintly under a full moon.",
    cl_cloak_midnight: "Deep blue, scattered with tiny white stars, fastened in silver. Once worn by an opera's Night Queen.",
    cl_cloak_ember: "A cape fading from crimson to orange like a dying fire. Gold clasp. Very dramatic in a breeze.",
    cl_cloak_moss: "A green mantle with a ragged, leafy hem. Smells faintly of rain on ferns.",
    cl_cloak_raven: "Layered black feathers with a violet sheen. Corvin would approve. Quietly.",
    cl_cloak_silver: "Pale silver-lavender that shimmers like the cathedral's veil. Isolde's finest work.",
    cl_outfit_scholar: "Black robes with violet-and-silver trim and a long scarf. You'll look like you've read everything.",
    cl_outfit_alchemist: "A brown leather coat with brass buttons and a sturdy apron. Singe-resistant. Mostly.",
    cl_outfit_bard: "A wine-red doublet with gold trim. It practically begs for a song.",
    cl_outfit_duelist: "Charcoal waistcoat, white shirt, red sash. Cut for someone who never draws first.",
    cl_outfit_moonweave: "Pale lavender robes woven with moonlight. They glimmer whenever you move.",
    cl_outfit_ranger: "A forest-green tunic, leather belt and bracers. Built for long walks and short fights.",
    // drinks (Elvis)
    drink_fizz: "Elvis's sparkly violet-gold speed drink. It fizzes! +20% move speed for 3 minutes, plus a little energy.",
    drink_moonmilk: "Creamy, nutmeg-sweet and pale as the moon. Restores plenty of energy. Elvis calls it a royal secret.",
    drink_dragon: "Spiced cider with a smoky bite. Heals a little and makes your attacks hit harder for a while.",
    drink_frostberry: "Icy, tart and bubbly. Restores both health and energy. Tastes like a crisp morning.",
    drink_mistwine: "Pale wine aged in an old crypt cellar. Brings you luck until evening. The ghosts insist.",
    drink_hollow: "A dark, earthy stout. You take less damage for a while, and it restores some energy.",
    // relics & curios
    treasure_map: "A tattered map with a hurried X. Somewhere out there the ground is keeping a secret. Dig at the mark.",
    old_key: "A heavy rusted skeleton key with a crescent bit. It opens the sealed chest in the watchtower ruin.",
    relic_coin: "An ancient coin of the Lunar Order, stamped with a crescent. Collectors and crows adore it.",
    relic_idol: "A small idol with moth wings and moon eyes. Fennick swears it's lucky. Nobody can prove otherwise.",
    relic_star: "A Star Fragment that glows with its own steady light. Rare, precious, and faintly warm to hold.",
    relic_locket: "A silver locket on a fine chain. It's empty, or it's keeping something too small to see.",
    relic_bell: "A tiny Fairy Bell. It rings by itself when someone far away is thinking of you.",
    relic_feather: "A Phoenix Feather, flickering gold and red. It has burned out and come back before.",
    golden_acorn: "An acorn of solid gold. Squirrels speak of it in hushed voices. Fennick would trade his hat for one.",
    // forest loot
    thorn_bramble: "A knot of living bramble that still twitches. Brew with frostmint for a Thornhide Draught.",
    wisp_essence: "A captured wisp light, bobbing in your palm. Brew with a glowcap for a Wisplight Tonic.",
    wolf_fang: "A moss-wolf fang, green-tinged and sharp. Delvers carry them as good-luck charms.",
    antler_shard: "A shard of the hollowstag's spectral antler. It glows like moonlight in mist. Very rare.",
    // potions
    pot_wisplight: "Your light reaches further in the Depths for 3 minutes. Tastes like a firefly's daydream.",
    pot_thornhide: "You take less damage for 4 minutes. Your skin prickles pleasantly, like a hedgehog's.",
    pot_mana: "Restores mana. Blue as a twilight sky and fizzy with spells. Moonpetal and arcane dust.",
    // foods (buffs are listed by the engine)
    snack_sweets: "Tiny sugar moons in a paper bag, glowing faintly. Moonlight always tastes sweeter shared.",
    snack_toffee: "Dark, chewy toffee stirred in a cauldron. Hard enough to chip ore, sweet enough to forgive it.",
    snack_jellies: "Fizzy jelly creatures that wriggle on your palm. Catch them before they hop away.",
    food_honeycake: "A golden sponge soaked in honey and lavender. Tastes like the first day of a good story.",
    food_pasty: "A flaky pumpkin pasty, warm from Sable's oven. Gardeners swear by them.",
    food_gazypie: "Fish heads peek out of the crust, gazing at the stars. Fishers swear by it, eyes shut.",
    food_chili: "Chili so hot it glows faintly. Tastes like a dragon's opinion, and sharpens your sword arm.",
    food_gingerghost: "A pale gingerbread ghost baked at midnight. Things seem to float into your pockets afterwards.",
    food_glowtoast: "Thick toast piled with sizzling glowcaps. Crunchy, savoury and faintly luminous.",
    food_moonpudding: "A wobbly silver pudding that shimmers like moonlight on water. Elvis's pride and joy.",
    food_spellscroll: "A rolled cinnamon pastry with glowing icing runes. Every bite is a little spell.",
    food_starbun: "A rare bun dusted with real starlight. Light as a cloud, and good at nearly everything.",
    // spellbook, festival, familiars
    spellbook: "Orvyn's gift: a book of starlit spells. Press Q to cast the chosen spell; Tab cycles spells.",
    scroll_spell: "A scroll in Orvyn's spidery hand. Read it to learn a new spell for your spellbook.",
    sky_lantern: "A paper lantern for the Lantern Moon. Release it at the moonwell with a wish.",
    festival_token: "A brass token stamped with a lantern. Spend it at the stalls on a Lantern Moon night.",
    prize_ribbon: "A silver ribbon from the Lantern Moon potion judging. Orvyn and Mirabel signed the back.",
    fam_treat: "A little treat for your familiar. Feathered, furred or fluttering, they all adore it."
  };
  for (var ik in I2) T.items[ik] = I2[ik];

  // ---------------------------------------------------------------- furniture tooltips (cottage decorate mode)
  var FU = {
    furn_bed_canopy: "A four-poster bed hung with violet curtains. Sleep like royalty. Or like Inkwell, which is better.",
    furn_cot: "A narrow cot with a patched blanket. Humble, sturdy, and surprisingly comfy.",
    furn_rug_moon: "A round rug woven with a silver crescent moon. Soft underfoot, and Inkwell's new favourite spot.",
    furn_rug_star: "A deep blue rug scattered with stitched golden stars. Walk on the night sky.",
    furn_rug_round: "A cosy round rag rug in plum and moss. Every cottage needs one spot that's just for toes.",
    furn_table_oak: "A solid oak table, scarred by years of teacups and spilled potions. Built to last.",
    furn_table_round: "A small round table, perfect for two cups of tea and one long conversation.",
    furn_desk: "A writing desk with a dozen tiny drawers. At least three contain mysterious keys.",
    furn_chair_oak: "A plain oak chair. It creaks a welcome every time you sit down.",
    furn_armchair: "A deep velvet armchair that swallows you whole. Dangerous before bedtime.",
    furn_bookshelf: "Tall shelves of well-loved books. Some are spellbooks. Some are just very old cookbooks.",
    furn_potion_shelf: "A shelf of glowing bottles in every colour. Purely decorative. Probably.",
    furn_candelabra: "A wrought-iron candelabra with five candles. Very gothic. Mind your sleeves.",
    furn_crystal_lamp: "A lamp with a glowing crystal heart. It hums faintly, like a contented cat.",
    furn_lantern_stand: "A tall iron stand with a hanging lantern. Warm light for long evenings.",
    furn_fern: "A lush potted fern. Elowen says it likes to be talked to, mostly about the weather.",
    furn_moonflower_pot: "A pot of moonflowers that open at dusk and glow softly all night.",
    furn_potted_tree: "A little potted tree, forever reaching for the window. It has opinions about sunlight.",
    furn_painting_moon: "A painting of the full moon over Nightvale. The moon in it seems to watch the room.",
    furn_portrait_morwenna: "Morwenna, scowling fondly from a gilt frame. You can almost hear her say 'Dust the shelves.'",
    furn_star_map: "A hand-drawn chart of the constellations. The Stubborn Kettle is circled twice.",
    furn_tapestry: "A woven tapestry of the Lunar Order planting the Moonroot. Slightly moth-nibbled.",
    furn_wall_clock: "A wall clock with a moon-phase dial. It ticks gently and chimes at midnight.",
    furn_crystal_ball: "A crystal ball on a brass stand. Mostly it shows fog. Occasionally, Grizelda waving.",
    furn_globe: "A globe of a world much bigger than Nightvale. Fennick has sold things in most of it.",
    furn_telescope: "A brass telescope for the window. Orvyn says every home needs a way to look up.",
    furn_cauldron_decor: "A decorative copper cauldron with a wisp of pretend steam. No brewing, just atmosphere.",
    furn_music_box: "A silver music box. Its lullaby sounds a lot like the moon humming.",
    furn_harp: "A small golden harp. It plays a note on its own whenever the wind sighs.",
    furn_owl_perch: "A wooden perch for a feathered friend. Owls find it extremely dignified.",
    furn_cat_bed: "A plump cushion bed for Inkwell, who will of course sleep anywhere else instead.",
    furn_wardrobe: "A tall carved wardrobe for your finest outfits. Isolde would approve. Probably.",
    furn_mirror: "A standing mirror in a gilded frame. Check your hat before you face the valley.",
    furn_trophy_slime: "A mounted slime trophy, still slightly wobbly. A reminder of humble beginnings.",
    furn_trophy_spider: "A broodmother's fang on a plaque. Brave, impressive, and a little unsettling.",
    furn_trophy_crown: "The Archon's broken crown on a velvet stand. The valley's greatest victory, on your shelf.",
    furn_trophy_case: "Four bounties behind glass: a dented crown, a mossy fang, a stolen lantern and a shard of Vorrakh. Gideon would be proud.",
    furn_mineral_cabinet: "Ronan's thank-you: little drawers of glittering stones, and a lunarite on top that glows like a pocket moon."
  };
  for (var fu in FU) T.items[fu] = FU[fu];

  // ---------------------------------------------------------------- round 3: Guild, Runesmithy, Menagerie, crafting, romance
  var I3 = {
    // geodes (Ronan cracks them)
    geode_moon: "A plain grey stone with a secret inside. Found on any floor. Ronan will crack it for a small fee.",
    geode_ember: "A warm, rust-red geode from floor 10 and deeper. Something fiery waits inside.",
    geode_void: "A cold black geode from floor 25 and deeper. It feels heavier than it should.",
    geode_star: "A rare geode that twinkles faintly, found on any floor. The best surprises hide in plain stones.",
    // minerals: moon geodes
    min_lunarite: "Pale blue stone that glows at midnight. A Moon geode mineral for the Collection Cabinet.",
    min_moonglass: "Smooth, milky glass formed where moonlight struck stone. It still feels cool to the touch.",
    min_silvervein: "Grey rock laced with bright silver threads, like frost on a window.",
    min_moth_fossil: "A tiny moth, perfect to the last wing, pressed into stone ten thousand years ago.",
    min_tidestone: "A striped stone that hums faintly with the moon's pull on the tide.",
    min_crescent_agate: "An agate whose bands curve into a perfect crescent. The Lunar Order prized them.",
    // ember geodes
    min_emberstone: "A stone that never quite cools. Warms your pocket on cold nights. An Ember geode find.",
    min_phoenix_tear: "A drop of red glass said to have fallen from a phoenix's eye. Rare, and always warm.",
    min_lava_opal: "An opal with fire trapped inside, flickering orange and gold.",
    min_salamander_fossil: "A fossil salamander curled around itself, faintly warm even now.",
    min_cinnabar: "Bright red crystals: beautiful, and best not licked. Ronan insists.",
    min_smokequartz: "Quartz the colour of woodsmoke, hazy and calm.",
    // void geodes
    min_void_eye: "A black stone with a single pale ring. You could swear it blinks. A Void geode find.",
    min_obsidian: "Glossy volcanic glass, sharp-edged and dark as a moonless night.",
    min_nightglass: "Glass so dark it seems to hold a few faint stars inside.",
    min_ammonite: "A spiral fossil from an ancient sea, older than the mountains.",
    min_wraith_opal: "A pale, ghostly opal that shimmers only when nobody's looking at it.",
    min_hollow_heart: "A dark crystal with an empty chamber at its heart. It rattles softly, like a whisper.",
    // star geodes
    min_starheart: "A crystal with a tiny star burning at its core. The rarest treasure of the Star geodes.",
    min_comet_glass: "Green-gold glass formed where a comet's tail brushed the earth. Amara would swoon.",
    min_meteorite: "A black-crusted chunk of fallen sky. Heavy, ancient, and Ronan's favourite thing.",
    min_celestite: "Soft sky-blue crystals that seem to glow even in daylight.",
    min_aurora: "A stone that ripples green and violet, like the northern lights caught in a pebble.",
    min_wishing_stone: "A smooth stone with a natural hole through it. Look through it and make a wish.",
    // blueprints and what they make
    bp_sprinkler: "Blueprint: Dew Sprinkler. Learn to craft a sprinkler that waters the 8 tiles around it each morning.",
    bp_warp: "Blueprint: Warp Rune. Learn to craft a rune that whisks you home.",
    bp_charm: "Blueprint: Lucky Charm. Learn to craft a charm worth +2 Luck for the day.",
    bp_lamp: "Blueprint: Moonlit Lamp. Learn to craft a glowing lamp for your cottage.",
    bp_hammer: "Blueprint: Geode Hammer. Learn to craft a hammer for cracking geodes yourself.",
    bp_scarecrow: "Blueprint: Moon-Scarecrow. Learn to craft a scarecrow that helps nearby crops grow faster.",
    bp_saddle: "Blueprint: Saddle of Swiftness. Learn to craft a saddle that makes your mount 15% faster.",
    bp_trophy: "Blueprint: Bounty Trophy Case. Learn to craft a case for showing off your slain bounties.",
    dew_sprinkler: "Waters the 8 tiles around it every morning. Your watering can will be jealous.",
    warp_rune: "Snap it to teleport home in a flash of silver. Smells faintly of lavender.",
    lucky_charm: "A little knot of good fortune. Grants +2 Luck for the rest of the day.",
    moonlit_lamp: "A lamp of frosted glass that glows like a captured moon. Lovely in the cottage.",
    geode_hammer: "A small rune-etched hammer. Crack geodes yourself. Ronan will pretend not to mind.",
    moon_scarecrow: "A scarecrow with a crescent-moon head. Nearby crops grow a little faster. Crows are baffled.",
    trophy_case: "A glass case for your bounty trophies. Every slain legend, on proud display.",
    lucky_rune: "Ronan's rune of fortune. It grants +1 Luck forever. Keep it close.",
    // pets & mounts (Caspian)
    pet_treat: "A crunchy treat for your pets. Kittens, pups, bunnies and baby dragons all approve.",
    pet_toy: "A squeaky toy stuffed with moss. Pets go wild for it. So does Pip.",
    pet_bed: "A cosy round pet bed. Place it in your cottage and someone will curl up in it right away.",
    saddle_swift: "Saddle of Swiftness. Your mount runs 15% faster.",
    saddle_starlit: "A saddle stitched with starlight. Your mount runs 30% faster.",
    dragon_harness: "A rune-stitched harness. Your dragon flies higher and faster.",
    silver_whistle: "Blow it anywhere outdoors and your mount comes running. Or flying.",
    pet_kitten: "A moon kitten that purrs and glows softly in moonlight. Adorable, and slightly smug.",
    pet_puppy: "A shadow pup: clumsy, loyal, and certain every stick is the best stick ever.",
    pet_bunny: "A lop bunny with velvet ears and strong opinions about breakfast.",
    pet_hatchling: "A baby dragon that sneezes sparks and naps somewhere warm. Mind your eyebrows.",
    pet_crystalfox: "A crystal fox, born from a star geode. The rarest pet there is, earned at the Collection Cabinet.",
    horse_midnight: "A midnight-black horse with a silver mane. Gallops at 1.7x speed. Press R outdoors to ride.",
    horse_silver: "A silver-dappled horse, calm and quick. Gallops at 1.7x speed. Press R outdoors to ride.",
    horse_chestnut: "A warm chestnut horse with a white blaze. Gallops at 1.7x speed. Press R outdoors to ride.",
    dragon_amethyst: "An amethyst dragon. Flies over trees, water and rooftops at 2.3x speed. Press R outdoors to ride.",
    dragon_emerald: "An emerald dragon. Flies over trees, water and rooftops at 2.3x speed. Press R outdoors to ride.",
    dragon_ember: "An ember dragon. Flies over trees, water and rooftops at 2.3x speed. Press R outdoors to ride.",
    // romance
    bouquet: "Moonflower Bouquet. Give it to someone at 8 hearts to ask them out. Sweet, and slightly terrifying.",
    pendant: "Moonstone Pendant. Give it to the one you're dating at 10 hearts to ask them to share your life.",
    // the Guild
    contract: "A Guild contract, signed and sealed. Finish the job, then turn it in to Gideon.",
    guild_badge_1: "Copper crescent of the Silver Crescent Guild. Everyone starts somewhere.",
    guild_badge_2: "Silver crescent badge. Harder contracts, and the right to ride dragons.",
    guild_badge_3: "Gold crescent badge. Gideon has pinned only a handful of these.",
    guild_badge_4: "Moonsteel crescent, the Guild's highest honour. It glows faintly in the dark.",
    trophy_gloopgarr: "Gloopgarr's dented crown, still faintly sticky. A bounty trophy for your cottage.",
    trophy_grimjaw: "Old Grimjaw's great scarred fang. The Deepwood sleeps easier. A bounty trophy.",
    trophy_lantern: "The Lantern Thief's stolen lantern, still flickering. A bounty trophy for your cottage.",
    trophy_wyrm: "A crystal scale from Vorrakh the Deep Wyrm, big as a shield. A bounty trophy.",
    lore_page: "A page of old lore from the Forgotten Library. Best read by lamplight.",
    sword_starforged: "The Starforged Blade, born of a full Collection Cabinet. The finest sword in the valley.",
    // the Night Market
    mystery_box: "A sealed velvet box from the Night Market. Nobody knows what's inside. Not even the merchant.",
    cl_cloak_starweave: "A cloak woven from the night sky itself. Sold only at the Night Market, by lantern light."
  };
  for (var ik3 in I3) T.items[ik3] = I3[ik3];

  // ---------------------------------------------------------------- notice board requests (reward ~2.5x sell value)
  T.requests = [
    { npc: 'mirabel', item: 'moonpetal', qty: 5, reward: 560, text: "My window boxes look positively mournful, dearie. Five moonpetals would cheer them up. And me. Mostly me." },
    { npc: 'mirabel', item: 'honey', qty: 3, reward: 600, text: "I'm baking for the whole street and I'm clean out of honey. Three combs, petal, and there's a slice in it for you." },
    { npc: 'mirabel', item: 'frostmint', qty: 4, reward: 550, text: "Four sprigs of frostmint for my cooling tea, please. Pip drank the last batch 'for science' and now he's got hiccups." },
    { npc: 'pip', item: 'slime_gel', qty: 10, reward: 200, text: "I NEED SLIME GEL! Ten globs! For an experiment! It's definitely not going to explode! Probably! Don't tell Gran!" },
    { npc: 'pip', item: 'glowcap', qty: 5, reward: 400, text: "Five glowcaps please!! I'm making a lamp that runs on mushrooms! Or a mushroom that runs on lamps! Science will decide!" },
    { npc: 'pip', item: 'spider_silk', qty: 6, reward: 300, text: "Six spider silks for my rope ladder to the moon! I've done the maths! Okay, I haven't done the maths, but I've done the ladder!" },
    { npc: 'pip', item: 'sludge', qty: 1, reward: 3, text: "WANTED: one Murky Sludge! The murkier the better! Reward: three whole glimmer! It's all my savings! Worth it!" },
    { npc: 'sable', item: 'emberroot', qty: 3, reward: 1100, text: "Darling, my spiced stew needs fire. Three emberroots, and I'll compose a little verse in your honour. Free of charge." },
    { npc: 'sable', item: 'pearl', qty: 1, reward: 1000, text: "One moon pearl, darling, for a new pair of earrings. A bard must sparkle, even a retired one. Especially a retired one." },
    { npc: 'sable', item: 'duskberry', qty: 6, reward: 1050, text: "Six duskberries for pie night at the Owl. The regulars will riot without it. Lovingly, darling, but still." },
    { npc: 'brann', item: 'ore_glimmer', qty: 10, reward: 200, text: "Need glimmer ore. Ten. Delvers keep breaking blades. Bring it. Will pay." },
    { npc: 'brann', item: 'emberroot', qty: 2, reward: 750, text: "Forge runs hot on emberroot. Need two. Coals are sulking." },
    { npc: 'brann', item: 'ore_shadow', qty: 8, reward: 360, text: "Shadowiron. Eight chunks. Big order from the Lodge. Corvin's paying. Means I'm paying you." },
    { npc: 'brann', item: 'food_stew', qty: 1, reward: 130, text: "Long shift. Need stew. One bowl. Hearty. Don't tell Mirabel I asked someone else." },
    { npc: 'orvyn', item: 'starshard', qty: 3, reward: 680, text: "Three starshards, if you'd be so kind. My new lens needs a little fallen sky. Or was it the old lens? Either way. Shards." },
    { npc: 'orvyn', item: 'moonstone', qty: 1, reward: 600, text: "A single moonstone, dear. I must measure the moon's mood, and moonstones are terribly honest about such things." },
    { npc: 'orvyn', item: 'food_tea', qty: 2, reward: 100, text: "Two cups of Starleaf Tea, please. I keep brewing my own and forgetting it. It has been cold since Thornsday. Last Thornsday." },
    { npc: 'orvyn', item: 'quartz', qty: 4, reward: 600, text: "Four arcane quartz, dear. I have a lens to grind and a theory to prove. I've forgotten the theory. The lens will remind me." },
    { npc: 'elowen', item: 'moonlily', qty: 3, reward: 450, text: "Um... could you bring three moonlilies? The pond in my grove is lonely. I think they'd keep each other company." },
    { npc: 'elowen', item: 'honey', qty: 2, reward: 400, text: "The bees lost a hive in the last storm. Two combs of honey would help them start again... I'd owe you. So would the bees." },
    { npc: 'elowen', item: 'feather', qty: 4, reward: 350, text: "Four owl feathers, please. I'm weaving a charm to keep the Depths' shadows out of the woods. It needs... a lot of wings." },
    { npc: 'grizelda', item: 'mandrake', qty: 3, reward: 820, text: "Three mandrakes! Screamers only! I'm brewing a cure for the mayor's rhyming hiccups. Kehehe! Be quick, you soggy turnip!" },
    { npc: 'grizelda', item: 'ectoplasm', qty: 4, reward: 450, text: "Ectoplasm! Four blobs! Fresh, mind! Ghost-goo goes off faster than you'd think. Hee hee!" },
    { npc: 'grizelda', item: 'bog_amber', qty: 2, reward: 600, text: "The mire stole two lumps of my bog amber. Fetch me two more, dearie. And don't let it steal YOU. Kehehe!" },
    { npc: 'corvin', item: 'bat_wing', qty: 8, reward: 280, text: "Eight bat wings, for a delver's shadow draught. I can't say which delver. Confidential. ...It's me." },
    { npc: 'corvin', item: 'pot_healing', qty: 3, reward: 900, text: "The Lodge is out of Healing Draughts. Three, please. People keep wanting to survive. Inconvenient, but understandable." },
    { npc: 'corvin', item: 'food_coffee', qty: 2, reward: 130, text: "Two Midnight Brews. My coffee pot exploded. Pip was nowhere near it, apparently. Somehow that's worse." },
    { npc: 'lune', item: 'fish_ghosteel', qty: 2, reward: 800, text: "Two ghosteels, sprat! Night catch! I'd fetch 'em myself, but my knee says no, and my knee's the captain now. HAH!" },
    { npc: 'lune', item: 'driftwood', qty: 10, reward: 380, text: "Ten pieces of driftwood! The boathouse roof's leaking again. Or the lake's raining upward. Either way, I need wood!" },
    { npc: 'lune', item: 'fish_mooncarp', qty: 3, reward: 560, text: "Three mooncarp for Starday. They're for a friend. At the tavern. Not Sable. Definitely not Sable. ...Fine. Sable." }
  ];

  // ---------------------------------------------------------------- the Moon Altar
  T.altar = {
    intro: [
      "Your hand touches the cold stone, and the air thickens with lavender and singed sugar. A shape of silver mist sits down on the rim.",
      "'Oh, good, you found it. I left a bit of myself in the stone. Don't look so alarmed, {player}. It's only an echo. A well-informed one.'",
      "'This altar holds the seal on the thing beneath the Ridge. The seal is starving, and so is the garden. They eat the same thing: gifts.'",
      "'Five of them, the old way. What grows. What's found. What's won in the dark. What's brewed. And what's caught.'",
      "'Fill the hollows and the Sanctum will remember itself, piece by piece. I'd do it, but I'm mostly fog now. Off you go. Feed the cat.'",
      "The mist sinks back into the altar. For a long moment, the stone stays faintly warm."
    ],
    bundles: {
      garden: "What grows: the first harvests of a waking garden, raised under the moon by your own hands.",
      forage: "What is found: gifts of wood, shore and sky, gathered gently and given back.",
      delver: "What is won: treasures carried up out of the dark beneath Starfall Ridge.",
      alchemy: "What is brewed: bottled wonders, stirred with patience and only slightly singed.",
      angler: "What is caught: silver lives drawn up from Glimmermere's moonlit deep."
    },
    offered: {
      garden: [
        "The harvest sinks into the altar like rain into dry soil. Outside, the earth shivers, and the old garden walls groan outward.",
        "Beyond them the soil darkens and wakes, faintly glowing, ready for seed. Two Dew Crystals rise from the loam, beaded and bright."
      ],
      forage: [
        "The wild gifts dissolve into green light. Water wells up from beneath the altar and runs down a hidden channel to the courtyard.",
        "The reflecting pool fills, clear and still, and the moon finds its face there again. Inkwell trots up with something shiny. A moon pearl."
      ],
      delver: [
        "The treasures of the deep flare as they touch the stone. One by one, the Sanctum's cold braziers catch silver fire.",
        "The shadows retreat. On the altar lies a saber that wasn't there before, and you feel sturdier, as if the stone lent you some of itself."
      ],
      alchemy: [
        "The potions pour themselves into the basin and burn blue, gold and violet. Light rushes across the courtyard to the Moon Goddess.",
        "Cracks seal. Lichen falls away. Her stone face is clear again, calm and kind. Somewhere, very faintly, someone says 'Hmph. Not bad.'"
      ],
      angler: [
        "The catch slips into the altar like fish into a stream. The stone ripples. Then, high above the valley, the moon answers.",
        "A beam of moonlight falls straight into the basin and blazes there. On its rim lies a lake-stained recipe and a heap of glimmer."
      ]
    },
    complete: [
      "The last hollow fills. For a heartbeat the whole Sanctum is silent. Then the altar sends a pillar of silver light straight into the sky.",
      "The moon brightens, like a lamp turned up. Across the valley every Moonroot vine lights at once: under fields, paths, even the lake.",
      "Morwenna's echo flickers beside you. 'There. That's the seal holding. That's the light remembering. Well done, my dear.'",
      "'But a fed seal is a door that can be opened, and you're going to open it. I know you. The Archon waits at the bottom of the Depths.'",
      "'Go down and finish what the Order started. Then come home. The garden won't water itself, and I can't hold a can any more.'",
      "Far beneath Starfall Ridge, something that has fed for centuries feels its meal grow thin. And for the first time, it is afraid."
    ]
  };

  // ---------------------------------------------------------------- notes found in the Depths
  T.lore = {
    lore_1: [
      "A water-stained page in careful script. 'Novice's Lesson, the First. The Moonroot drinks the moon as the willow drinks the river.'",
      "'Where it runs, the soil remembers light. Where it is cut, the soil forgets. Tend the light, and the light will tend you.'",
      "In the margin, a bored novice has drawn a mushroom with a very sad face."
    ],
    lore_2: [
      "A torn journal page in quick, slanting handwriting. 'Day 2. Floor 8. Slimes: 41. Me: undefeated. Cor: probably sulking. Good.'",
      "'Map's coming along. The Mossy Hollows are harmless if you don't mind being licked by things. I mind. A bit.'",
      "'Note to self: better boots. Note to Cor, if he ever reads this: I'm FINE. Stop making that face. I can feel you making it. - W.'"
    ],
    lore_3: [
      "Words cut into a slab of stone. 'In the Year of Three Lanterns, a sliver of the moon broke loose and fell burning into the Ridge.'",
      "'The mountain swallowed it. The caverns filled with its light, and the light was sweet, and things came up from the deep to drink.'",
      "'The Order went down with lanterns and songs. Fewer came back up. We named the caverns the Umbral Depths, and stopped singing.'"
    ],
    lore_4: [
      "Wren's handwriting again, smaller now. 'Day 19. Amethyst Grotto. The crystals sing if you keep quiet. I think they remember the Starfall.'",
      "'Found an Order lantern still burning after centuries. Didn't take it. Felt rude. Like stealing someone's last candle.'",
      "'Miss Cor's terrible coffee. Don't tell him. Actually, do. He'll pretend not to smile. It's his best trick.'"
    ],
    lore_5: [
      "A keeper's warning, scratched in haste. 'The Vigil-Keeper Vesper went down to guard the fallen light. For seven years Vesper kept it.'",
      "'Then Vesper began to keep it from us. The light did not burn. It hollowed out a hunger, and the hunger wore Vesper like a coat.'",
      "'It calls itself the Archon now. It cannot be slain while it feeds. Feed the Altar instead, and the Altar will hold the door.'"
    ],
    lore_6: [
      "Wren's page, the writing shaky. 'Day 41. Below the Catacombs. Found the Order's tombs. Read their warnings. The Altar's dimming. The Archon's waking.'",
      "'Everyone up top thinks the moon's just paler this year. It isn't paler. It's being EATEN. Slowly. Like a pie at the Owl.'",
      "'Lost my red scarf to a web back there. Cor knitted it. Badly. I'll miss it more than I'll admit. Spiders can keep it. For now.'",
      "'I should go back and tell them. Tell Cor I'm sorry about the shouting. ...No. I'll tell him myself. After. I'm close. I can feel it.'"
    ],
    lore_7: [
      "A silver-inlaid tablet. 'The Rite of Sealing. Five gifts wake the Altar: what grows, what is found, what is won from the dark,'",
      "'what is brewed by patient hands, and what is drawn from the moonlit water. Give all five, and the light will hold.'",
      "'Should the light falter in a later age, let a keeper rise to give the five again. The moon remembers. So must we.'"
    ],
    lore_8: [
      "Wren's last page, inked in silver, as if by moonlight. 'Day ??. I can see it. The fallen light. It isn't just light. There are doors in it.'",
      "'The Archon sleeps when it's full. I think I can slip through the light while it dreams. I don't know where it goes. Somewhere bright.'",
      "'If someone finds this: I'm not lost. I'm just further along. Don't wait up, Cor. ...Actually, do. Keep the coffee hot.' - W."
    ]
  };

  // ---------------------------------------------------------------- the Umbral Archon
  T.archon = {
    intro: [
      "The Archon's Throne. A cavern so vast the dark has weather. At its heart, the fallen sliver of moon hangs in chains of shadow, flickering.",
      "Something unfolds from the throne. Tall. Thin. Night stitched over hunger. Two pale eyes open, each one a dying star.",
      "'Another keeper. You smell of moonpetal and that stubborn woman's garden. She kept me starving for fifty years.'",
      "'I am Vesper. I was the light's guardian once. Now I am its appetite. Come closer, little gardener. You look... bright.'"
    ],
    phase2: [
      "Vesper's shadow cracks. Light spills from the wounds: stolen moonlight, streaming back toward the fallen shard.",
      "'No. NO. It is MINE. I kept it when the Order forgot. I kept it when the moon wept. I kept it ALONE.'",
      "The cavern shudders. The chains around the shard begin to snap, one by one, and Vesper rises, enormous and desperate."
    ],
    defeat: [
      "Vesper falls. The shadows unravel like old thread, and the stolen light rushes free, singing as it rises.",
      "For a moment, inside the dark, you see a figure in a keeper's robe. Tired. Young. Relieved.",
      "'Tell the moon I kept it as long as I could. Tell it I'm sorry I kept it so long.' Then there is only light, and quiet."
    ],
    epilogue: [
      "You climb out of the Depths at dawn. The sky is pink, and the moon, still up, is brighter than you have ever seen it.",
      "Across the valley the Sanctum garden blazes silver. The Moonroot hums under every field and path and root.",
      "In Hollowmere, Mirabel is crying into her apron, Pip is shouting your name from the bridge, and Brann has something in his eye. Still.",
      "Sable is already tuning her lute. Lune is already exaggerating. Orvyn is up on his balcony, waving at the moon like an old friend.",
      "At the Lodge, Corvin has set out two cups of coffee. 'Habit,' he says. He doesn't put the second one away.",
      "Back at the altar you smell lavender and something singed. 'Told you so,' says a voice that is mostly memory. 'Now water the garden.'",
      "The moon remembers what we forget. And tonight, all of Nightvale remembers you."
    ]
  };

  // ---------------------------------------------------------------- misc
  T.misc = {
    passout: [
      "You wake in your own bed, still in your boots. Inkwell is sitting on your chest, judging you. Somebody carried you home.",
      "You wake with leaves in your hair. A note on the table, in blocky letters: 'Found you on the path. Carried you. Sleep earlier. -B.'",
      "You wake to the smell of soup on the stove and a note: 'Bed before two, dearie! Two! -M.' Your purse feels a little lighter."
    ],
    death: [
      "You wake on a cot at the Delvers' Lodge. Corvin sits beside it with a cold coffee. 'You were nearly one of mine. Don't make a habit of it.'",
      "Darkness, then lantern light. Someone found you at the bottom of the stairs and hauled you up. Some of your pack didn't make the climb.",
      "You wake in your own bed, aching everywhere. Inkwell is curled at your feet and refuses to leave you all morning."
    ],
    sleep: [
      "You sleep deeply and dream of silver roots. Inkwell is already up, sitting on the windowsill, glaring at a moth.",
      "A good night's sleep. The garden smells of dew and moonpetal. Somewhere, a mandrake is complaining.",
      "You wake to a warm weight on your feet and a rumbling purr. Inkwell has decided you are a pillow."
    ],
    cat: [
      "Inkwell purrs like a tiny cauldron.",
      "Inkwell headbutts your hand, demanding more. Always more.",
      "Inkwell blinks slowly at you. In cat, that means 'I approve of you. For now.'",
      "Inkwell rolls over, offering a fluffy belly. It is a trap. You know it is a trap.",
      "Inkwell's tail curls around your wrist like a question mark.",
      "Inkwell sniffs your fingers, smells moonpetal, and sneezes indignantly.",
      "Inkwell kneads the air, eyes half closed, purring loudly enough to rattle the jars.",
      "Inkwell stares past you at something you can't see. Then purrs, as if greeting an old friend.",
      "Inkwell flops dramatically across your boots and refuses to move.",
      "You scratch behind Inkwell's ears. Somewhere deep inside the cat, a contented little engine starts up."
    ],
    newDay: {
      full: "The moon is full. Crops will grow faster, and tonight something stirs in Whisperwood's fairy ring.",
      new: "A new moon. The Depths will be darker today: more dangerous, and richer for it.",
      rain: "Rain patters on the Sanctum roof. The garden will water itself today.",
      mist: "A thick mist has rolled down from the Ridge. The whole valley feels hushed and secret.",
      starfall: "Stars are falling over Nightvale! Starshards may be glittering wherever they land."
    },
    firstBrew: [
      "The cauldron hisses, then glows. A thin silver steam curls up and, for a moment, takes the shape of a crescent moon.",
      "Your first potion! It's warm in your hand and smells like a garden at night. Morwenna would have pretended not to be impressed."
    ],
    firstHarvest: [
      "You pull your first crop from the Sanctum soil. It's warm, faintly glowing, and perfect.",
      "Beneath your feet the Moonroot stirs, just slightly, like someone turning over in their sleep. The garden is waking."
    ],
    firstDepths: [
      "You step into the Umbral Depths. The air is cool and damp, and the dark seems to lean in for a closer look at you.",
      "Somewhere far below, something slow and hungry notices a new light in its caves. Keep your lantern lit."
    ],
    runeGate: [
      "The Rune Gate's silver runes flare at your touch. The stone remembers you now: you can return to this floor from the entrance."
    ],
    fairyRing: [
      "Under the full moon the fairy ring blazes with light. Music rises from nowhere, thin and silver and impossibly old.",
      "Tiny lights swirl around you, tugging your sleeves, tangling in your hair. You're laughing before you know why.",
      "When the music fades the lights are gone. But something has been left in your hands, wrapped in a leaf, still warm."
    ]
  };


  // ---------------------------------------------------------------- random encounters
  // Each: intro pages, choices { key: label }, outcomes { key: pages }. Luck-roll choices resolve to the
  // listed result keys (e.g. chest.open -> success | mimic). Only Fennick's lines carry portrait tags.
  T.encounters = {
    merchant: {
      intro: [
        "[happy] Psst! Over here! Yes, you, with the excellent boots! Tobias Fennick, at your service, with four rare treasures, today only!",
        "And for the brave: dice. You wager, I wager, the coins decide. Fortune favours the bold, friend. Occasionally the bald. Never the dull."
      ],
      choices: { browse: 'Browse the pack', dice: 'Roll the dice', leave: 'Not today' },
      outcomes: {
        browse: ["[happy] Feast your eyes! All genuine, all rare, all priced with love. Love and a modest markup."],
        win: ["[surprised] Well, bless my monocle! The coins adore you, friend! Here are your winnings. I'll be weeping into my scarf later."],
        lose: ["[happy] Ah, hard luck! The coins are fickle creatures. Your stake is mine, but the story's yours. Another day, friend!"],
        leave: ["[happy] No harm in looking! I'll be somewhere else tomorrow. Or the day after. Look for the hat with the pins!"]
      }
    },
    chest: {
      intro: [
        "A chest sits alone where no chest should be, half sunk in moss. Its lock is rusted through, its lid open a crack. It seems to be waiting.",
        "Was that a creak? Chests don't creak on their own. Do they?"
      ],
      choices: { open: 'Lift the lid', leave: 'Leave it be' },
      outcomes: {
        success: ["The lid swings open with a sigh. Inside, wrapped in old cloth, something glints. Whoever hid this never came back for it."],
        mimic: ["The lid yawns open... and keeps on yawning. Teeth! Splintered teeth and a long purple tongue! It's a MIMIC!"],
        leave: ["You back away slowly. The chest watches you go. You're almost certain it looks disappointed."]
      }
    },
    shrine: {
      intro: [
        "A small shrine of mossy stone, its carved face worn smooth. The bowl at its feet holds a few old coins and a single feather.",
        "Words circle the bowl: 'Give to the moon, and the moon may give back. Or may not. The moon has moods.'"
      ],
      choices: { offer: 'Offer glimmer', leave: 'Walk on' },
      outcomes: {
        blessing: ["The coins in the bowl ring like tiny bells, and silver light settles on your shoulders. You feel lucky. Distinctly, suspiciously lucky."],
        curse: ["The shrine sighs. A small grey cloud gathers over your head and drizzles on you as you walk away. It'll pass. Probably."],
        leave: ["You leave the shrine to its coins and its moods. Behind you, the feather in the bowl turns over by itself."]
      }
    },
    fallenstar: {
      intro: [
        "A crater the size of a cartwheel, still steaming. At its heart something glows: a fallen star, cooling in the grass and humming softly."
      ],
      choices: { gather: 'Gather the starlight', leave: 'Let it cool' },
      outcomes: {
        success: ["You scoop up the glittering shards. They're warm, and they hum faintly, like a song you almost remember."],
        rare: [
          "You scoop up the glittering shards. They're warm, and they hum faintly, like a song you almost remember.",
          "Beneath them lies something bigger: a perfect Star Fragment, glowing steadily, as if a little piece of the sky chose you."
        ],
        leave: ["You leave the star to cool in peace. By morning there'll be nothing here but a ring of silver grass."]
      }
    },
    spirit: {
      intro: [
        "A pale figure flickers between the trees, translucent as breath on glass. It turns, sees you, and drifts closer.",
        "'Oh... you can see me. Please. There's something I need before I can rest...'"
      ],
      wants: [
        { item: 'moonlily', qty: 1, text: "'I was married beside the lake, under the lilies. Bring me a moonlily, so I can remember the water.'" },
        { item: 'food_bread', qty: 1, text: "'My mother baked lavender bread every morning. Bring me a loaf. I'd like to smell home once more.'" },
        { item: 'feather', qty: 2, text: "'I promised my little brother two owl feathers, and never made it home to give them. Will you bring them to me?'" },
        { item: 'starshard', qty: 1, text: "'It's so dark where I've been. Bring me a starshard. Just a little light to carry the rest of the way.'" },
        { item: 'honey', qty: 1, text: "'I kept bees, once. I can't remember their names. Bring me a honeycomb. Perhaps the taste will remind me.'" },
        { item: 'fish_mooncarp', qty: 1, text: "'I fished Glimmermere every dawn for fifty years. Bring me a mooncarp. One last catch, and I can rest.'" }
      ],
      choices: { give: 'Give it to the spirit', refuse: 'Not now' },
      outcomes: {
        give: [
          "The spirit takes your gift in trembling hands and smiles. 'Thank you. I can rest now.' It fades like mist in morning sun.",
          "Where it stood, the grass glows silver for a moment. Then a small gift glints at your feet."
        ],
        refuse: ["The spirit nods, sad but patient. 'I'll wait. I'm very good at waiting.' It drifts back into the trees."],
        missing: ["You search your pack, but you don't have what it needs. 'Another time, perhaps,' it whispers, and fades."]
      }
    },
    riddle: {
      intro: [
        "A standing stone, taller than a door, carved with a face that is half moon, half owl. Its eyes open. Its voice is moss and gravel.",
        "'Answer truly, traveller, and I shall reward you. Answer falsely, and I shall be... mildly disappointed.'"
      ],
      choices: { answer: 'Hear the riddle', leave: 'Walk away' },
      outcomes: {
        success: ["'Truly answered.' The stone's eyes glow with pleasure, and a drawer you never noticed slides open at its base."],
        fail: ["'Alas.' The stone sighs, a sound like a landslide in no hurry. 'Think on it. I shall still be here. I am a rock.'"],
        leave: ["The stone's eyes close. 'Another day, then. Stones are patient. It's mostly what we're for.'"]
      },
      riddles: [
        { q: "I grow fat and thin each month, I am full but never eat, and the tides follow me home. What am I?", answers: ['A candle', 'The moon', 'A river', 'A cauldron'], correct: 1 },
        { q: "I roll down from the Ridge at dawn. I wet your cheeks but I am not rain, and the more of me there is, the less you see.", answers: ['Night', 'Snow', 'Smoke', 'Mist'], correct: 3 },
        { q: "I sleep in a tiny brown house beneath the soil. Give me water, and I break my own walls to climb toward the light.", answers: ['A seed', 'A mole', 'A beetle', 'A stone'], correct: 0 },
        { q: "I am a field no farmer ploughs, sown with silver no one harvests, and I am only planted after dark. What am I?", answers: ['A frozen lake', "A spider's web", 'The starry sky', 'A fairy ring'], correct: 2 },
        { q: "I fly without wings and weep without eyes. When I pass before the moon, she hides her face. What am I?", answers: ['A cloud', 'A bat', 'A ghost', 'An owl'], correct: 0 },
        { q: "I add a ring every year, I have a heart but no blood, and the birds raise their families in my arms. What am I?", answers: ['A bell', 'A well', 'A fairy', 'A tree'], correct: 3 },
        { q: "I carry my house on my back and leave a silver road behind me, yet I am the slowest thing in the garden.", answers: ['A tortoise', 'A snail', 'A hedgehog', 'A beetle'], correct: 1 },
        { q: "At night I hold the whole moon, yet one pebble breaks me into a hundred pieces, and a moment later I am whole again.", answers: ['A mirror', 'A window', 'A still pond', 'A lantern'], correct: 2 }
      ]
    },
    treasuremap: {
      intro: [
        "Something flaps against a tree trunk, pinned by a rusty nail: a map, torn and stained, with an X inked in a hurried hand."
      ],
      choices: { take: 'Take the map', leave: 'Leave it' },
      outcomes: {
        take: ["You tug the map free. The X marks a place you know, or almost know. Find it, and dig."],
        leave: ["You leave the map flapping on its nail. Someone else's treasure. Someone else's adventure."],
        dig: [
          "Your spade strikes something hollow. You dig faster, and a small iron box, crusted with soil, rises from the dark earth.",
          "Inside, wrapped in oilcloth: treasure. The X was telling the truth."
        ]
      }
    },
    traveller: {
      intro: [
        "A traveller sits slumped against a tree, pack spilled, one arm bound in a torn scarf. 'Don't mind me. Just resting. Bleeding a bit.'"
      ],
      choices: { give: 'Give a Healing Draught', refuse: 'Wish them well' },
      outcomes: {
        give: ["The traveller drinks, and colour floods back into their cheeks. 'Kind soul. I won't forget this. I'll send something your way.'"],
        refuse: ["'No, no, I understand. Potions are dear.' The traveller smiles bravely and waves you on. You hope they find the road."],
        missing: ["You search your pack, but there's no Healing Draught to give. 'Never mind,' says the traveller. 'The kindness counts.'"],
        gift: ["A parcel arrives, wrapped in brown paper and string. The note says: 'For the kind keeper who stopped on the road. With thanks.'"]
      }
    },
    wishingwell: {
      intro: [
        "An old well ringed with moss and violets. Coins glitter far below, each one somebody's wish. The water hums one quiet note."
      ],
      choices: { toss: 'Toss a coin', leave: 'Keep your coin' },
      outcomes: {
        success: ["Your coin falls and falls, and lands with a clear, bright chime. The well glows silver. Somewhere, something says yes."],
        fail: ["Plink. The coin sinks without a sound. Nothing happens. Then, very faintly, the well hiccups. Not every wish is heard today."],
        leave: ["You pocket your coin. The well doesn't seem offended. Wells are used to people changing their minds."]
      }
    }
  };

  // ---------------------------------------------------------------- tutorial: Morwenna's old field notes
  T.guide = {
    farming: [
      "Morwenna's notes, the Garden. The dark garden soil inside the temple walls is the only ground you can till at first. Start small. Start there.",
      "Clear the weeds and stones first. A sword or your hoe will cut the weeds; the pickaxe breaks the stones. Then use the hoe to till the soil.",
      "To plant, select your seeds and click the tilled soil. Plant in tidy rows. You'll thank me at watering time.",
      "Water every planted square with the Dew Can, every single day. When the can runs dry, refill it at the pond or the well.",
      "Crops grow overnight while you sleep, and faster on a full moon. Don't stand over them. Nothing grows while it's being stared at. -M."
    ],
    brewing: [
      "Morwenna's notes, the Cauldron. A brew needs a cauldron, two or three ingredients, and patience. The order you add them never matters.",
      "Choose your ingredients at the temple cauldron and brew. Two moonpetals make a Healing Draught. Glowcap and frostmint make a Vigor Tonic.",
      "Get the mix wrong and you'll make Murky Sludge. Don't pour it away: Grizelda and Pip treasure the stuff. There's no accounting for taste.",
      "New recipes come from Orvyn's scrolls, from friends who trust you, or from bold experiments. Write everything down. I never did. -M."
    ],
    selling: [
      "Morwenna's notes, Coin. Glimmer comes from selling, and each shopkeeper buys what suits their trade. Take the right goods to the right door.",
      "Mirabel takes crops, forage and seeds. Lune pays best for fish. Brann buys ore, gems and stone. Corvin buys whatever the monsters leave behind.",
      "Grizelda pays well for potions, Sable takes fish and food, and Orvyn can't resist a gem. Mind the shop hours. Nobody trades after bedtime.",
      "Keep the best of everything back for the altar and for gifts. Not everything worth having is worth selling. -M."
    ],
    villagers: [
      "Morwenna's notes, Neighbours. Talk to everyone, every day. It costs nothing, and the valley runs on it. Friendship grows like anything else.",
      "One gift each per day. Learn what they love: Mirabel lives for pie, Brann for stew, Corvin for terrible coffee. Only Grizelda and Pip love sludge.",
      "As friendships deepen, people share their stories, their secrets, sometimes a recipe. Hearts are earned, dear. Never bought.",
      "Check the notice board in the square. Someone always needs something, and helping is the quickest way into anyone's heart. -M."
    ],
    depths: [
      "Morwenna's notes, Below. The Umbral Depths open on Starfall Ridge, beside Corvin's Lodge. Buy a proper sword before you go down.",
      "Watch your health and energy, carry Healing Draughts, and climb out before you're spent. Brave is good. Stubborn gets carried home.",
      "Every fifth floor has a Rune Gate. Touch it and it remembers you, so next time you can start from that floor.",
      "New moons make the Depths richer and far more dangerous. Fifty floors down, something waits. Wake the altar before you knock. -M."
    ],
    fishing: [
      "Morwenna's notes, Water. Buy a rod from Captain Lune at the Glimmermere dock. Ignore half of what Lune tells you. The other half is gold.",
      "Cast into the water and wait. When something bites, reel it in, keeping the catch bar over the fish until it tires. It always tires.",
      "Glimmerfin and mooncarp bite at any hour. Mistperch rise only in rain or mist. Ghosteels and lanternpike come out at night.",
      "The Crownjaw bites only under a full moon, in Glimmermere. A Tidecaller Tonic makes every fish friendlier for a day. -M."
    ],
    exploring: [
      "Morwenna's notes, Wandering. Whisperwood is friendly by day. West of it lies the Deepwood, older and stranger. Don't go at night.",
      "East, through the mossy tunnel, is Hushwillow Glade. Nothing hunts there. The animals sleep in the grass. Pet them gently, once a day.",
      "Odd things turn up out in the world: chests, shrines, lost spirits, riddling stones. They glow faintly. Some are gifts. Some bite.",
      "Luck decides more than we'd like. Carry a little glimmer and a little courage, and when the coins start spinning, smile.",
      "On full-moon nights the fairy ring wakes, and something with glowing antlers walks the deep woods. Bring manners to one. Run from the other. -M."
    ]
  };

  // ---------------------------------------------------------------- spellbook (Orvyn, after floor 5)
  T.spells = {
    lesson: [
      "[happy] Ah, {player}! Floor five, and still in one piece. Every piece, by the look of it. Come in. I have something for you. Somewhere.",
      "[surprised] Here! A spellbook. Morwenna's first, then mine, then nobody's for far too long. Its pages stay dark until a spell is written in.",
      "Magic is starlight you borrow from yourself, dear. You only hold so much. Mana, we call it. It returns slowly, like stars after dawn.",
      "Spend it, and wait. Or drink a Mana Draught: moonpetal and arcane dust. I'll sell you scrolls to fill the book, one spell at a time.",
      "Press Q to cast the spell you've chosen. Tab turns to the next one. Or click the spell bar, if your fingers prefer.",
      "[happy] Begin with Lumen. A little light that follows you like a loyal comet. Every great wizard started by not tripping over things."
    ],
    lumen: "Lumen (8 mana): an orb of light floats after you for two minutes, like a small, loyal comet.",
    verdance: "Verdance (20 mana): crops within two tiles grow by a day. Each tile can be hurried only once a day.",
    blink: "Blink (10 mana): step through the air and reappear a short way ahead. Mind the walls.",
    frostbolt: "Frostbolt (6 mana): a bolt of frost that chills and slows whatever it hits."
  };

  // ---------------------------------------------------------------- the keeper's cottage (walk-in)
  T.cottage = {
    intro: [
      "The keeper's cottage. It smells of lavender, old books and woodsmoke, as if someone stepped out only a moment ago.",
      "A narrow bed under the window, a hearth with a soot-black kettle, Morwenna's desk buried in papers, and shelves waiting to be filled.",
      "It's yours now. Move things about. Make it look lived in again. Inkwell has already claimed the best cushion."
    ],
    hearth: [
      "The hearth crackles softly. Morwenna's kettle hangs above it, blackened by fifty years of tea and arguments.",
      "Inkwell's favourite spot is the warm stone right in front. You'll have to share."
    ],
    desk: [
      "Morwenna's desk: ink pots, dried lavender, unfinished letters, and a teacup ring on every single page.",
      "One note is pinned in the middle where you can't miss it: 'Rearrange whatever you like. Except the kettle. -M.'"
    ],
    bed: [
      "Your bed, beneath the cottage window. The quilt is patched with forty little fabric moons. It smells faintly of cat.",
      "Sleeping ends the day. Inkwell will wake you at dawn regardless."
    ],
    decorateTip: "Decorate mode: place furniture anywhere on the floor grid, and pick pieces up again to move them. Make it yours."
  };

  // ---------------------------------------------------------------- familiars (Bonding Stone, Hushwillow Glade)
  T.familiars = {
    bonding: [
      "[surprised] Oh! You found the Bonding Stone. I hoped you would. Um. This is where the forest... introduces people. To friends.",
      "Put your hand on the stone and wait. An animal will come. Not a pet. A familiar. It chooses to walk with you, and you with it.",
      "[happy] An owl, a fox, or a luna moth. Each helps in its own way. Owls find things. Foxes dig. Moths bring light, and a little luck.",
      "Give it a good name. And pet it every day. Bonds grow like roots: slowly, quietly, and then all at once.",
      "[happy] If you ever want to choose again, just come back to the stone. Nobody's feelings will be hurt. Well. Maybe a little. Foxes sulk."
    ],
    owl: {
      choose: [
        "A soft hoot from the willow. A small grey owl glides down and lands on the stone, folding its wings with enormous dignity.",
        "Its round amber eyes study you, unblinking, as if reading a very long book. Then it bobs its head once. Decided.",
        "An owl flies after you and perches when you rest. Once a day it brings you a forage find, and in the Depths it hoots near the hidden ladder."
      ],
      pet: [
        "Your owl fluffs up to twice its size, then slowly deflates with a happy little click.",
        "Your owl nibbles your finger very gently. That's owl for 'good morning.'",
        "Your owl swivels its head almost all the way round to look at you. Show-off.",
        "Your owl closes its eyes and leans into your hand, as heavy as a sleepy cloud.",
        "Your owl gives a soft, proud hoot, as if you'd done something clever. You haven't. It's just being kind.",
        "Your owl ruffles its feathers and settles on your arm, warm and almost weightless."
      ]
    },
    fox: {
      choose: [
        "The long grass rustles, and a red fox trots out, tail high, with the air of someone arriving fashionably late.",
        "It circles you twice, sniffs your boots, sneezes, then sits down right on your foot. Apparently that settles it.",
        "A fox trots at your heels and naps whenever you stand still. Sometimes it digs up relics or glimmer, and in a fight it nips at your foes."
      ],
      pet: [
        "Your fox flops onto its back, paws in the air, demanding belly rubs with total confidence.",
        "Your fox nudges your hand until you scratch behind its ears. Then it nudges again. More, please.",
        "Your fox's tail sweeps happily back and forth through the grass.",
        "Your fox gives one very soft yip and presses against your legs.",
        "Your fox makes a sound halfway between a purr and a giggle. Foxes are full of surprises.",
        "Your fox curls into a warm ginger ring against your boots and sighs, utterly content."
      ]
    },
    moth: {
      choose: [
        "Light gathers above the stone, and a great luna moth drifts down, its pale-green wings glowing like moonlit leaves.",
        "It lands on your sleeve, light as a breath. Its feathery antennae taste the air around you. It stays.",
        "A luna moth flutters around you, lighting the dark at night, in the Deepwood and in the Depths, and bringing you a little luck."
      ],
      pet: [
        "Your moth settles on your fingertip and slowly opens and closes its wings, like a heartbeat made of light.",
        "Your moth's glow brightens to a happy shimmer. You'd swear it's smiling.",
        "Your moth dusts your hand with a sprinkle of glittering scales. It's a compliment.",
        "Your moth flutters three loops around your head, then lands on your nose. Hello to you too.",
        "Your moth's antennae brush your cheek, soft as a whisper.",
        "Your moth glows a little warmer: a tiny lantern that has decided you're worth lighting."
      ]
    },
    gifts: {
      owl: [
        "Your owl swoops down and drops {item} at your feet, looking extremely pleased with itself.",
        "A soft hoot from above. Your owl has brought you {item}, and accepts your thanks with a regal blink.",
        "Your owl lands on your shoulder with {item} in its beak. Somewhere, a squirrel is very cross."
      ],
      fox: [
        "Your fox digs furiously, dirt flying everywhere, and proudly unearths {item}!",
        "Your fox's nose twitches. It paws at the ground and turns up {item}. Good fox.",
        "Your fox trots over with {item} in its jaws and drops it at your feet, tail wagging."
      ],
      glimmer: [
        "Your fox digs up a small, mouldy purse. A few glimmer jingle inside. Finders keepers.",
        "Your fox unearths a scatter of old coins and sneezes at the dust. Glimmer!"
      ],
      hoot: [
        "Your owl hoots softly and stares very hard at one particular rock.",
        "Your owl ruffles its feathers and hoots twice. Something about that rock interests it."
      ]
    }
  };

  // ---------------------------------------------------------------- the Lantern Moon festival (full moon, 6pm to midnight)
  T.festival = {
    announce: {
      board: "TONIGHT: THE LANTERN MOON! Hollowmere plaza, 6pm to midnight. Lanterns, music, potion judging, wisp catching, fortunes and dancing!",
      morning: "The moon is full tonight. Hollowmere is stringing lanterns for the Lantern Moon festival: 6pm to midnight, in the plaza."
    },
    lantern: [
      "Sky lanterns hang from a stall by the moonwell, their paper glowing gold and violet. Write a wish on one, light it, and let it go.",
      "The moon reads every wish, they say, and answers with a small blessing for tomorrow. At ten o'clock, all the lanterns rise together."
    ],
    judging: [
      "Orvyn and Mirabel sit behind a table draped in silver cloth, scorecards ready. Orvyn has a loupe. Mirabel has a plate of biscuits.",
      "Enter your finest potion. They judge by rarity and quality. Mirabel also judges by how hard you tried. Orvyn pretends not to."
    ],
    wisps: [
      "Glowing wisps drift around the plaza, bobbing between the lanterns like curious sparks.",
      "Catch as many as you can in sixty seconds. Gently! Elowen is watching. So are the wisps."
    ],
    fortune: [
      "A crooked purple tent, sagging with charms, bones and little bells. The sign reads: 'FORTUNES. TRUE ONES. NO REFUNDS. -G.H.'",
      "Inside, Grizelda peers into a bowl of bog water. 'Sit, sit, dearie! Cross my palm with glimmer and I'll tell you what's coming. Kehehe!'"
    ],
    stalls: [
      "Stalls line the plaza beneath the lanterns: festival treats, little decorations, and rare seeds sold only under a Lantern Moon.",
      "Mirabel is selling sugar moons, Elvis is pouring Stardust Fizz, and Fennick has draped his stall very, very ambitiously."
    ],
    judgingResults: {
      low: ["Orvyn sniffs your potion and blinks. 'Hm. Bold.' Mirabel pats your hand. 'It's the effort that counts, dearie. Have a biscuit.'"],
      mid: ["Orvyn holds your potion up to the lanterns. 'A respectable brew. Solid, like a first-quarter moon.' Mirabel nods and beams."],
      high: ["Orvyn's eyebrows climb. 'Oh, my. Excellent work, dear.' Mirabel whispers 'Morwenna would be furious,' and squeezes your arm."],
      best: [
        "Orvyn stands. Mirabel stands. 'The finest potion of the Lantern Moon!' The plaza cheers, and somewhere Pip is shouting your name.",
        "Mirabel pins a silver ribbon to your collar. 'She'd be so proud, dearie,' she says, and doesn't bother hiding the tears."
      ]
    },
    // Grizelda's fortunes; fortuneHints[i] names the real effect the engine can attach to fortunes[i]
    fortunes: [
      "Something glitters under a mossy rock on Starfall Ridge, near the lookout. Lift the stones nobody bothers with.",
      "The Depths are generous tomorrow. What the monsters drop will be finer than usual.",
      "Tomorrow the fish of Glimmermere are hungry. Bring your rod, and your patience will be repaid.",
      "Rain is coming. Let the sky water your garden tomorrow, and rest your arms.",
      "The stars are restless. Before long they'll fall. Keep one eye on the sky and your pockets empty.",
      "A wanderer with a hat full of pins will cross your path tomorrow. His pack holds something rare.",
      "Your garden is feeling generous. Tomorrow's harvest will give back more than you planted.",
      "Old coins sleep beneath the Deepwood's standing stones. Dig where the moss grows thickest.",
      "Someone who loves you is preparing a gift. Be kind tomorrow, and it will find you.",
      "Luck walks beside you tomorrow, dearie. Toss the coin, roll the die, open the chest. Kehehe!"
    ],
    fortuneHints: ['ridge_treasure', 'depths_loot', 'fishing_luck', 'rain_tomorrow', 'starfall_soon', 'merchant_tomorrow', 'harvest_bonus', 'deepwood_treasure', 'friend_gift', 'luck_tomorrow'],
    dance: {
      intro: [
        "A fiddle strikes up by the moonwell, and couples drift into the lantern light. Ask a dear friend to share the moonlight dance."
      ],
      mirabel: [
        "[surprised] Dance? With me? Oh, my knees! Oh, my heart! Oh, go on then, dearie.",
        "[happy] Morwenna and I danced every Lantern Moon. She always led. Badly. You're much better. Don't tell her I said so."
      ],
      pip: [
        "[surprised] You want to dance with ME?! I can't dance! I've never danced! I'm going to dance!",
        "[happy] I'm counting! One, two, three, one, two... I stepped on your foot. Scientifically, that still counts as dancing!"
      ],
      sable: [
        "[happy] Darling, I thought you'd never ask. Follow my lead. Or don't. I'm very good at following too.",
        "[happy] There. Now everyone's watching us, and Lune is pretending not to. That's the best part of dancing, darling."
      ],
      brann: [
        "[surprised] Dance. Me. ...Hm. Fine. One song.",
        "[happy] ...Didn't step on you. Good. Mirabel taught me. Forty years ago. Don't tell anyone."
      ],
      orvyn: [
        "[happy] A dance! The stars dance every night, you know. Slowly, over thousands of years. Let's go a little faster than that.",
        "[happy] One, two, three... I learned this waltz from a comet. Or a countess. One of the two. Splendid!"
      ],
      elowen: [
        "[surprised] M-me? Dance? In front of everyone? ...Um. Okay. Yes. Okay.",
        "[happy] It's like the willows in the wind. Just... sway. Oh. Oh, I'm dancing. I'm actually dancing."
      ],
      grizelda: [
        "[surprised] Dance? With ME? Kehehe! You brave little turnip! Hold on to your hat!",
        "[happy] Spin! Spin! Hee hee! I haven't danced with anyone but the fairies in years. Terrible leads, fairies."
      ],
      corvin: [
        "Dance? I don't... Fine. One song. Don't expect grace. Expect a very tall shadow moving awkwardly.",
        "[happy] ...You're smiling. So am I, apparently. Wren used to drag me to these. I'd forgotten I liked it."
      ],
      lune: [
        "[happy] A dance! HAH! Finally, someone with taste! Hold on, sprat. I dance like I sail: loudly, and in circles!",
        "[sad] ...Sable's watching. Don't look. Keep dancing. One more song. One more. Always one more."
      ],
      elvis: [
        "[happy] Stardust, I'd be honoured. Shall we? ~ One more turn beneath the lanterns... ~ Mind the dip. Here it comes.",
        "[happy] Perfect! The capital never saw a waltz like that. And believe me, the capital saw a great many things it shouldn't have."
      ],
      isolde: [
        "[surprised] You're asking me? Very well. Shoulders back. Chin up. Lead with the heart, follow with the feet.",
        "[happy] ...Not bad, my moth. Not bad at all. Either you've been practising, or I'm a better teacher than I thought. Both."
      ],
      seraphine: [
        "[happy] I'd love to. Look how the lanterns throw our shadows. Like figures in the windows.",
        "[happy] Slowly. Let the light find us. ...There. I think the windows will remember this one."
      ],
      fennick: [
        "[happy] A dance! And free of charge! The rarest thing I've been offered all year! Lead on, friend!",
        "[surprised] Mind my scarf! It's longer than the dance floor! ...Ha! I haven't spun like that since I was young. Thank you, friend."
      ],
      laura: [
        "[angry] Dance? Me? In front of everyone? ...Fine. One song. Step on my boots and you're buying new ones.",
        "[happy] ...Okay, that wasn't terrible. Don't look so smug. ...Fine. Another one."
      ],
      jasmine: [
        "[surprised] D-dance? With me? Oh! Yes! Sorry! I mean yes! Not sorry!",
        "[happy] We're dancing! I'm dancing! I only stepped on you once. Twice. Sorry! I'm so happy!"
      ],
      amara: [
        "[happy] A dance? I've read about the steps! Theory and practice are different, though. Let's find out how different!",
        "[surprised] Oh, you're good at this! I'm counting in threes. A waltz is just maths with feelings!"
      ],
      ronan: [
        "[surprised] Dance. ...Mm. Haven't since Ashvale. Alright. You lead. I'll follow. Slowly.",
        "[happy] ...You didn't flinch when I stepped wrong. Good partner. Again?"
      ],
      caspian: [
        "[happy] Finally! I thought you'd never ask, sunshine. Hold on tight. I dance like I fly: dramatically.",
        "[happy] Look at us! Everyone's watching. Pebble's watching. Pebble's jealous. Spin!"
      ],
      gideon: [
        "Dance? Recruit, I'm sixty. ...One song. Don't tell Laura.",
        "[happy] Hm. Not bad. Haven't waltzed since Thornwall. The troll was a worse partner."
      ],
      nightmerchant: [
        "[happy] A dance, keeper? I have danced under stranger moons than this one. Mind my cloak. It remembers every step.",
        "The lanterns, the music, the pools full of stars... Thank you. This is one night I will never sell."
      ]
    },
    lanternRise: [
      "Ten o'clock. The music stops. All across the plaza people raise their lanterns, and the whole village goes quiet at once.",
      "Then, together, the lanterns rise: hundreds of little gold moons drifting past the rooftops, carrying every wish toward the real one.",
      "The moon seems to lean a little closer, as if listening. Someone starts to sing. Then everyone does."
    ]
  };

  // ---------------------------------------------------------------- the Silver Crescent Guild ({n} = count)
  T.guild = {
    intro: [
      "Welcome to the Silver Crescent, recruit. That's the contract board. Read it. Respect it. Don't pin recipes to it. Pip.",
      "Every notice is a job: hunt something, gather something, or put down a named beast. Skulls mark the danger. One's a stroll. Five's a funeral.",
      "You may carry up to three contracts at once. The board refreshes every three days, ready or not.",
      "Finish the job, then bring it to me to turn in. Coin for your purse, rank for your name: Copper, Silver, Gold, Moonsteel.",
      "[happy] Higher ranks open harder contracts and better pay. Silver opens Caspian's dragons, too. Now go. Come back alive."
    ],
    rankUp: {
      silver: [
        "[happy] Silver rank, recruit. Most stop at Copper. You didn't. Caspian will finally let you near his dragons.",
        "Harder contracts are yours now. Wear the badge where the monsters can see it."
      ],
      gold: [
        "[surprised] Gold. I've pinned this badge on six hunters in thirty years. Make it seven. Hold still.",
        "[happy] Gold contracts hit harder and pay better. Keep coming back. That's the real rank."
      ],
      moonsteel: [
        "[happy] Moonsteel. The highest rank the Guild gives. I wear one. My son never did. Laura's close. And you're here.",
        "[sad] Don't say anything. Just take it. ...Proud of you, Keeper. There. Now go, before I weep into my beard."
      ]
    },
    board: {
      empty: "The board is bare. New contracts arrive every three days. Gideon's quill is already scratching.",
      full: "You're already carrying three contracts. Finish one before you take another. Gideon's rule.",
      refresh: "Fresh notices crowd the contract board, still smelling of ink and pipe smoke."
    },
    contracts: {
      hunt_slimes: {
        title: "Slime Infestation",
        notice: "WANTED: {n} slimes, dead. They've clogged the upper tunnels of the Depths and eaten a miner's left boot. He'd like the right one avenged as well.",
        hint: "Slimes ooze through every floor of the Umbral Depths, thickest in the Mossy Hollows near the top.",
        done: "Slimes cleared. The miner thanks you, and has bought new boots. Two of them. Optimist."
      },
      hunt_bats: {
        title: "Gloom in the Rafters",
        notice: "Bats. {n} of them. They shriek, they swoop, they nest in delvers' hair. Reward for every wing that stops flapping.",
        hint: "Bats roost throughout the Depths. Listen for the shrieking, then look up.",
        done: "The rafters are quiet again. Delvers' hair is once more their own."
      },
      hunt_thornlings: {
        title: "The Walking Bramble",
        notice: "Thornlings have been snagging travellers' cloaks and refusing to let go. Prune {n} of them. Gloves advised. Patience required.",
        hint: "Thornlings creep through Whisperwood and the Deepwood at dusk and after dark.",
        done: "Thornlings pruned. Elowen wants it known that the rest of the forest is grateful. Mostly."
      },
      hunt_mosswolves: {
        title: "Wolves at the Treeline",
        notice: "Moss-wolves hunt in pairs and howl in harmony. They've taken two sheep and one very good hat. Bring down {n}.",
        hint: "Moss-wolves prowl the Deepwood at night, always in pairs. Never go alone. Neither do they.",
        done: "The howling has stopped. The hat was not recovered. Its owner is in mourning."
      },
      hunt_webweavers: {
        title: "Silk Over the Path",
        notice: "Webweavers drop from the canopy without warning and wrap the unwary like midnight snacks. Cut down {n}. Look up.",
        hint: "Webweavers lurk in the Hollows, the deep heart of the Deepwood. Look up. Always look up.",
        done: "Webweavers slain. The Deepwood paths are a little less sticky tonight."
      },
      hunt_spiders: {
        title: "Too Many Legs",
        notice: "Cave spiders are spinning across the stairwells of the Depths, and delvers keep falling through the webs. Squash {n}.",
        hint: "Cave and crystal spiders swarm the Webbed Catacombs, floors 20 to 29.",
        done: "Spiders squashed. The stairwells are walkable again. Mind the cobwebs."
      },
      hunt_skeletons: {
        title: "Restless Bones",
        notice: "The dead of the Crypts will not stay down. Put {n} skeletons back to rest. Politely. Firmly.",
        hint: "Skeletons and their mages walk the Haunted Crypts, floors 30 to 39.",
        done: "Back to rest they go. Corvin sends his thanks, and a very dry note."
      },
      hunt_wisps: {
        title: "Lights That Lie",
        notice: "Wisps have been leading travellers in circles until their boots wear through. Snuff out {n} of the little liars.",
        hint: "Wisps flit through Whisperwood and the Deepwood after dusk. Don't follow them. Swing at them.",
        done: "The woods are honest again. Mostly. The trees still lie about their age."
      },
      hunt_gloombeetles: {
        title: "Violet Thunder",
        notice: "Gloombeetles: armoured, glowing, and charging at anything that moves. Including a cart. Twice. Flip {n} of them.",
        hint: "Gloombeetles roam the Deepwood. Their violet shells glow in the dark. Dodge the charge.",
        done: "Beetles flipped. The cart driver has bought you a drink, and himself a helmet."
      },
      hunt_boglings: {
        title: "Trouble in the Bog",
        notice: "Boglings: they hop, they spit, they cackle. Grizelda swears they're not hers. Grizelda is lying. Clear {n} anyway.",
        hint: "Boglings hop about the southern mire of Whisperwood at dusk and after dark.",
        done: "The bog is quiet. Grizelda claims to be furious. She's sent you a jar of something by way of thanks."
      },
      gather_silk: {
        title: "Silk for the Guild",
        notice: "The Guild's bowstrings are fraying. Wanted: {n} spider silk, strong and only slightly sticky.",
        hint: "Spiders in the Depths drop silk, and the Deepwood's webweavers drop plenty more.",
        done: "Fresh bowstrings all round. The archers are insufferably pleased with themselves."
      },
      gather_wisp: {
        title: "Bottled Light",
        notice: "The Guild hall's lamps are guttering. Bring {n} wisp lights, still glowing. Jars provided. Courage not included.",
        hint: "Wisps leave their light behind in Whisperwood and the Deepwood after dusk.",
        done: "The hall glows again. Gideon claims he never noticed the dark. He tripped twice."
      },
      gather_amethyst: {
        title: "Violet Stones",
        notice: "The Runesmithy needs amethysts for frost-runes. {n} clean stones. No cracks. No excuses.",
        hint: "Amethysts glitter in the rocks of the Amethyst Grotto, floors 10 to 19.",
        done: "Ronan inspects every stone, grunts once and nods. From Ronan, that's a standing ovation."
      },
      gather_healing: {
        title: "Draughts for the Wounded",
        notice: "Hunters keep coming home with extra holes in them. Wanted: {n} Healing Draughts for the infirmary shelf.",
        hint: "Brew two moonpetals in a cauldron, or grow phialvine and pick them straight off the vine.",
        done: "The infirmary shelf is full. Somewhere, a hunter will live to tell a very long story."
      },
      gather_frostmint: {
        title: "Cool Heads",
        notice: "Tempers in the Guild hall are running hot. Gideon wants {n} sprigs of frostmint for the cooling tea. Urgently.",
        hint: "Frostmint grows in your garden in five days, then regrows every three.",
        done: "Tea brewed, tempers cooled. Laura still glared, but more calmly."
      },
      gather_mooncarp: {
        title: "The Guild Feast",
        notice: "Feast night at the Guild, and the cook has nothing but stories. Bring {n} mooncarp for the long tables.",
        hint: "Mooncarp bite at any hour in Glimmermere. Captain Lune sells rods at the dock.",
        done: "The feast was magnificent. Gideon told the bear story twice. It was a badger."
      },
      gather_bog_amber: {
        title: "Amber for the Archives",
        notice: "The archivist wants {n} lumps of bog amber to seal the Guild's oldest maps. Something tiny inside each is optional.",
        hint: "Bog amber turns up in the southern mire of Whisperwood, around Grizelda's bog.",
        done: "The maps are sealed. One lump had a beetle inside. The archivist has named it."
      },
      gather_bone_dust: {
        title: "Grave Matters",
        notice: "Corvin needs {n} pouches of bone dust for the Lodge's warding salts. He asked very gloomily. Please hurry.",
        hint: "Skeletons crumble into bone dust in the Haunted Crypts of the Depths.",
        done: "The wards are mixed. Corvin smiled. Allegedly."
      },
      bounty_gloopgarr: {
        title: "Gloopgarr the Slime Ogre",
        notice: "BOUNTY: Gloopgarr. Big as a cottage, crowned with a dented pot, armed with a tree. Every blow splits him into more slimes. Many more.",
        hint: "Gloopgarr wallows in Whisperwood's southern bog while this contract is open. Bring friends, or many potions.",
        done: "Gloopgarr is a puddle. A very large puddle. The bog will smell for a week, but it will be a peaceful week."
      },
      bounty_grimjaw: {
        title: "Old Grimjaw",
        notice: "BOUNTY: Old Grimjaw, alpha of the moss-wolves. Twice the size of his kin, scarred and clever. Three hunters tried. Be the fourth, and the first to win.",
        hint: "Grimjaw hunts the Deepwood at night with two of his pack while this contract is open.",
        done: "Grimjaw has fallen. The Deepwood is quieter tonight. Gideon pours a drink for the three who tried before you."
      },
      bounty_lantern: {
        title: "The Lantern Thief",
        notice: "BOUNTY: a wisp king is stealing the dock lanterns at Glimmermere. It blinks, it giggles, it leaves decoys. The Captain is livid.",
        hint: "The Lantern Thief haunts the Glimmermere dock after midnight while this contract is open.",
        done: "The lanterns hang on the dock once more. Lune swears it was easy, and that you were 'adequately heroic.'"
      },
      bounty_wyrm: {
        title: "Vorrakh, the Deep Wyrm",
        notice: "BOUNTY: Vorrakh. Crystal-scaled, cave-born, older than the Guild. It burrows beneath its prey and bursts up in a storm of shards. Five skulls.",
        hint: "Vorrakh's lair lies on floor 20 of the Umbral Depths. When a ring of dust stirs at your feet, move. Fast.",
        done: "Vorrakh is slain. The Guild hall erupts. Gideon pins the notice to the wall of legends, beside his own."
      }
    }
  };

  // ---------------------------------------------------------------- the Ashvale Runesmithy (Ronan speaks)
  T.smithy = {
    crack: [
      "Hold still. Geode on the anvil. One tap... two... listen for the hollow.",
      "Mm. Feels heavy. Heavy's good. Heavy means secrets.",
      "[surprised] Cracking now. Stand back. ...No, closer. You'll want to see this.",
      "Easy. Easy. Rocks don't like being rushed. Neither do I."
    ],
    cabinet: {
      intro: [
        "The Collection Cabinet. Twenty-four slots, twenty-four minerals. Silhouettes, until someone brings the real thing.",
        "Find one in a geode, bring it here, and it goes behind the glass for good. Fill enough slots and I'll make it worth your while."
      ],
      donate: [
        "[happy] Mm. That one. Behind the glass. ...Looks right there. Thank you.",
        "Into the cabinet it goes. One less silhouette. Good.",
        "[happy] Perfect specimen. I'll dust it every morning. Don't tell anyone."
      ],
      milestones: {
        3: ["[happy] Three minerals. A start. Here, three hundred glimmer. Buy something shiny. Then bring it to me."],
        6: ["Six. You've got the eye. A Lucky Rune. Carved it myself. Luck follows you now, for good. Don't waste it."],
        10: ["[surprised] Ten. Mm. Take this Geode Hammer. Crack them yourself now. ...Still bring me the good ones."],
        14: ["[happy] Fourteen. Half the cabinet. Take a Mineral Cabinet of your own, for the cottage. For the ones you can't let go."],
        18: ["[surprised] Eighteen. Something hatched from a star geode last night. A crystal fox. Don't ask. She's yours. She chose you."],
        24: [
          "[happy] All twenty-four. The cabinet's full. Never thought I'd see it. ...My grandmother would weep.",
          "Here. The Starforged Blade, made from cabinet dust and every rune I know. And a title, too: Runesmith's Friend. You are."
        ]
      }
    }
  };

  // ---------------------------------------------------------------- Drake's Menagerie & Stables (Caspian speaks)
  T.menagerie = {
    intro: [
      "[happy] Welcome to Drake's Menagerie & Stables! Pets on the left, mounts on the right, dragon egg in the middle. Don't tap the egg.",
      "Adopt a pet and it'll follow you or live at your cottage. Buy a mount, press R outdoors to ride, R again to hop off. Simple!"
    ],
    adopt: [
      "[happy] Congratulations! You're a parent now. Of a pet. Feed it, pet it every day, and it'll love you forever.",
      "One can follow you about; the rest wait at your cottage. Pet them daily. That's the whole secret."
    ],
    mountBuy: [
      "[happy] She's yours! Press R outdoors to call her and ride. R again to dismount. Mind the hedges. She won't.",
      "Brush her, praise her, and never mention the dragons in front of her. Horses get jealous."
    ],
    firstRide: [
      "The wind catches your hair, the road blurs beneath you, and Hollowmere shrinks behind. Somewhere back at the paddock, Caspian whoops."
    ],
    dragonLocked: [
      "A dragon? Sunshine, I love the enthusiasm. But the Guild says Silver rank first. Dragons need riders who come back.",
      "[happy] Earn your Silver crescent from Gideon, then come and find me. I'll have a saddle waiting."
    ]
  };

  // ---------------------------------------------------------------- rare floors of the Umbral Depths
  T.rare = {
    library: {
      banner: "You've found: The Forgotten Library",
      books: [
        "'Of the Moonroot: it was not planted. It was invited. The moon chose this valley, and the Order only said yes.'",
        "'The Vigil-Keepers wore silver so the dark could see them coming. Better, we thought, to be seen than to be surprised.'",
        "'A recipe, unfinished: wispbloom, starbloom, moonstone... and one more thing the scribe refused to write down.'",
        "'The Starfall lasted one minute. The light it left has lasted nine hundred years. So it is with most kindnesses.'",
        "'Some keepers say the missing star in our charts is not missing at all. It is walking home, slowly, across the sky.'",
        "'Catalogue of the Order, item 4,012: one cat, black, of uncertain age. Not to be fed after midnight. It will ask.'"
      ]
    },
    witch: {
      banner: "You've found: The Witch's Hollow",
      diary: [
        "A stained diary page: 'Day nine hundred. The toads have formed a union. They demand flies and a day off. I have given them flies.'",
        "'Stirred the great cauldron again. Got a potion that turns you into a bat for an hour. Very useful. Very itchy.'",
        "'A letter from a young bog witch up top. Grizelda, she signs it. Rude. Brilliant. I've left her my best spoon.'",
        "'If you're reading this, the Hollow is yours. Stir once. Only once. The cauldron gets ideas if you stir it twice.'"
      ],
      cauldron: [
        "The great cauldron is still warm, after all these years. You stir it once. It gurgles, burps and produces something.",
        "A bottle bobs to the surface, sealed with wax and a tiny drawing of a toad."
      ]
    },
    observatory: {
      banner: "You've found: The Sunken Observatory",
      notes: [
        "A water-stained star chart: 'The Archon stirs when the moon looks away. Mark every new moon in red.'",
        "'Orrery calibrated. When the brass moon stands above the brass ridge, the stair beneath it opens. Cleverness is a kind of key.'",
        "'Apprentice Orvyn broke the third telescope today. He named a star after his apology. A promising boy.'",
        "'The missing star moves a hair's breadth every year. Toward us. We will not live to see it arrive. Someone will.'"
      ],
      orrery: [
        "You set the brass orrery turning. Copper planets and glass moons whirl, click, and settle. The little moon stops above the ridge.",
        "Somewhere below, stone grinds against stone. The way down has opened."
      ]
    },
    crystal: {
      banner: "You've found: The Crystal Garden",
      fountain: [
        "A fairy fountain bubbles among the crystal flowers. The water is warm, faintly sweet and full of light.",
        "You drink. Every scratch closes, every ache fades, and for a moment you could swear the crystals are singing."
      ]
    },
    blueprint: [
      "Tucked between the pages: a blueprint, its lines glowing faintly. You can learn to make something new.",
      "A rolled blueprint rests on the pedestal, sealed with the Order's crescent. Check the Crafting tab to see what it teaches.",
      "You unroll a blueprint. Neat diagrams, careful notes, and a little owl doodled in the margin. A new recipe is yours."
    ]
  };

  // ---------------------------------------------------------------- the Night Market (Cathedral Close, 7pm to 2am)
  T.nightmarket = {
    announce: {
      board: "THE NIGHT MARKET is in the Cathedral Close tonight, 7pm until 2am. Rare goods. Curious goods. Bring glimmer. Bring questions.",
      evening: "A soft violet glow in the Cathedral Close. The Night Market has come to Hollowmere."
    },
    arrive: [
      "A little carriage of dark wood and violet glass rolls into the Close without a sound. Lanterns bloom along its sides.",
      "The Night Merchant steps down, his cloak shimmering like a slice of starry sky, and bows to the coloured pools."
    ],
    leave: [
      "The lanterns dim one by one. By the time the bell strikes two, the carriage is gone, and only the coloured pools remember it."
    ],
    mysteryBox: [
      "You break the wax seal. The box sighs open, and a scent of rain and old roads drifts out.",
      "The velvet box is heavier than it looks. Inside, something waits on a bed of midnight silk.",
      "The lid lifts by itself. A puff of glittering dust, a faint chime, and there, at the bottom...",
      "You open the box slowly. Somewhere far away, a merchant smiles."
    ]
  };

  // ---------------------------------------------------------------- the Handbook (satchel tab), in reading order
  T.handbook = [
    { id: 'start', title: 'Your First Days', pages: [
      "Welcome to Nightvale! You've inherited the Verdant Sanctum, a ruined moon temple with a sleeping garden. Days run from 6am to 2am. Sleep before 2am, or you'll pass out where you stand.",
      "Start by clearing the garden and planting your moonpetal seeds. Then head east to Hollowmere and say hello. Mirabel sells seeds, and she'll try to feed you.",
      "The tracker in the corner always shows your next goal. Press H for the Field Guide and J for your journal. And feed Inkwell. Inkwell will remind you."
    ] },
    { id: 'farming', title: 'Farming', pages: [
      "At first, only the dark garden soil inside the temple walls can be tilled. Your first altar offering wakes the soil beyond the walls.",
      "Clear weeds with your sword or hoe and stones with the pickaxe. Till with the hoe, then select seeds and click the tilled soil to plant.",
      "Crops need water every day: use the Dew Can, and refill it at the pond or a well. Rain waters everything for you. Thirsty crops don't grow.",
      "Each watered night a crop grows one stage, and two stages under a full moon. Days to harvest: glowcap 3, moonpetal 4, frostmint 5 (regrows every 3), mandrake 6, emberroot 7.",
      "Duskberry 8 (regrows every 4), phialvine 8 (regrows every 4), wispvine 9 (regrows every 3), starbloom 10, starflask 10 (regrows every 5). Click a ripe crop to harvest it."
    ] },
    { id: 'brewing', title: 'Brewing', pages: [
      "Brew at a cauldron: choose two or three ingredients and brew. The order doesn't matter. Two moonpetals make a Healing Draught; glowcap and frostmint make a Vigor Tonic.",
      "A wrong mix makes Murky Sludge. Grizelda and Pip adore it. Nobody else does.",
      "Learn recipes from Orvyn's scrolls, from friends' heart scenes, or by experimenting. Potions sell well, and the Lantern Moon judging gives prizes for the best."
    ] },
    { id: 'food', title: 'Food & Buffs', pages: [
      "Food and drink restore energy and health, and many give a buff for a few minutes: Speed, Luck, Farming, Fishing, Mining, Attack, Defense or Magnetism.",
      "You can have one food buff and one drink buff at a time. A new one replaces the old, so pick your snack for the job ahead.",
      "Speed moves you faster. Luck improves drops, finds and luck rolls. Farming can add an extra crop at harvest. Fishing widens your catch bar.",
      "Mining finds more ore and strengthens your pickaxe. Attack hits harder. Defense softens blows. Magnetism pulls items to you from further away."
    ] },
    { id: 'money', title: 'Making Money', pages: [
      "Drop goods into the Moon offering box at the Sanctum and they sell overnight. Or sell in person at a shop; each one buys what suits its trade.",
      "Take requests from the notice board in the square, and contracts from the Guild. Both pay well, and requests earn friendship too.",
      "Brew potions to sell. Crack geodes for gems and minerals. Win prizes at the Lantern Moon. Follow treasure maps to buried loot. Glimmer adds up."
    ] },
    { id: 'shops', title: 'Shops: Who Buys What', pages: [
      "Mirabel buys crops, forage and seeds. Lune buys fish. Brann at the Ridge forge and Ronan at the Runesmithy buy ores, gems and minerals.",
      "Grizelda buys potions and monster loot. Corvin buys monster loot. Elvis buys food, fish and potions. Isolde buys clothes and relics.",
      "To buy: Mirabel sells seeds, Sable and Elvis food and drink, Corvin weapons, Orvyn recipe scrolls, Isolde clothes, and Caspian pets and mounts.",
      "Brann upgrades your tools. Ronan sells the Moonstone Pendant. Jasmine's honey stall opens on Moondays and Thornsdays, and Fennick and the Night Merchant come and go."
    ] },
    { id: 'guild', title: 'The Silver Crescent Guild', pages: [
      "The Guild hall stands in Hollowmere's south quarter. Its board offers hunts, gathering jobs and bounties on named monsters. Skulls show the danger.",
      "You can hold up to 3 contracts at once, and the board refreshes every 3 days. Finish a job, then turn it in to Gideon for coin and rank.",
      "Ranks go Copper, Silver, Gold, Moonsteel. Higher ranks unlock harder contracts and better rewards, and Silver lets you buy a dragon.",
      "Bounty monsters only appear while their contract is active: Gloopgarr in the bog, Old Grimjaw in the Deepwood, the Lantern Thief at the dock, Vorrakh on floor 20."
    ] },
    { id: 'geodes', title: 'Geodes & Minerals', pages: [
      "Breaking rocks in the Depths sometimes drops a geode. Moon geodes come from any floor, Ember from floor 10, Void from floor 25, and rare Star geodes from anywhere.",
      "Ronan at the Runesmithy cracks geodes for 25 to 150 glimmer. Inside: ores, gems, or one of 24 collectible minerals.",
      "Donate minerals to the Collection Cabinet. Rewards at 3, 6, 10, 14, 18 and 24: glimmer, a Lucky Rune, a Geode Hammer, a cabinet, a crystal fox, and the Starforged Blade."
    ] },
    { id: 'pets', title: 'Pets & Mounts', pages: [
      "Caspian's Menagerie sells pets and mounts. One pet can follow you; the rest live at your cottage. Pet them every day.",
      "Press R outdoors to call your mount and ride, and R again to dismount. Horses gallop at 1.7x speed. Dragons fly at 2.3x over trees, water and rooftops.",
      "Dragons need Silver guild rank, and can't fly indoors or in the Depths. Saddles make mounts faster, and the Silver Whistle calls yours from anywhere outdoors."
    ] },
    { id: 'magic', title: 'Magic', pages: [
      "Orvyn gives you a spellbook once you reach floor 5 of the Depths. Spells cost mana, a third bar that refills slowly, or quickly with a Mana Draught.",
      "Q casts your chosen spell and Tab switches spells. Lumen lights your way, Verdance hurries nearby crops, Blink hops you forward, Frostbolt slows foes.",
      "New spells come from Orvyn's scrolls. Brew Mana Draughts from moonpetal and arcane dust."
    ] },
    { id: 'familiars', title: 'Familiars', pages: [
      "Visit the Bonding Stone in Hushwillow Glade to choose a familiar: an owl, a fox or a luna moth. Name it, and it follows you everywhere.",
      "Owls bring a forage find each day and hoot near hidden ladders in the Depths. Foxes dig up relics and glimmer, and nip at foes. Moths light the dark and add Luck.",
      "Pet your familiar every day to grow your bond. You can always return to the stone to choose again."
    ] },
    { id: 'romance', title: 'Romance', pages: [
      "Laura, Jasmine, Amara, Ronan and Caspian can be romanced. Talk every day, give gifts they love, and enjoy their heart scenes at 2, 4, 6 and 8 hearts.",
      "Hearts pause at 8 until you give a Moonflower Bouquet, sold by Jasmine and Mirabel once you have 8 hearts with someone. Then you're dating, and can reach 10.",
      "At 10 hearts while dating, give a Moonstone Pendant from Ronan's Runesmithy. Your partner moves into your cottage, greets you, and sometimes leaves gifts or waters crops."
    ] },
    { id: 'festival', title: 'The Lantern Moon', pages: [
      "Every full moon, from 6pm to midnight, Hollowmere's plaza fills with lanterns, stalls and music. Everyone comes.",
      "Release a sky lantern at the moonwell for a wish, enter a potion in Orvyn and Mirabel's judging, catch wisps, and visit Grizelda's fortune tent.",
      "Invite a friend with 4 or more hearts to the moonlight dance. At 10pm all the lanterns rise together. Don't miss it."
    ] },
    { id: 'depths', title: 'The Umbral Depths', pages: [
      "The Depths open on Starfall Ridge beside Corvin's Lodge. A Rune Gate every 5 floors remembers your progress. The Archon waits on floor 50.",
      "Watch your health and energy, and carry Healing Draughts. If you fall, you'll wake at the Lodge minus some of your pack. New moons make the Depths richer and deadlier.",
      "About one floor in ten is a rare floor: the Forgotten Library, the Witch's Hollow, the Sunken Observatory or the Crystal Garden. Each hides something.",
      "Rare floors and some contracts hold blueprints. Each teaches a crafting recipe, which you'll find in the Crafting tab of your satchel."
    ] },
    { id: 'controls', title: 'Controls', pages: [
      "Move with WASD or the arrow keys. Space or C uses your tool. E talks, opens and interacts. The number keys pick hotbar slots.",
      "I opens your satchel, M the world map, H the Field Guide and J your journal. G toggles decorate mode in your cottage.",
      "R calls or dismounts your mount outdoors. Q casts your selected spell and Tab switches spells. Esc closes menus."
    ] }
  ];

  window.GAMETEXT = T;
})();
