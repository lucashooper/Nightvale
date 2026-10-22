// Nightvale — round three flavour: the south quarter's doors and props, the homes, and the rooms inside them.
(function () {
  'use strict';
  const T = window.GAMETEXT = window.GAMETEXT || {};
  const F = T.flavor = T.flavor || {};
  const add = (k, v) => { if (!F[k]) F[k] = v; };
  add('south_sign', ['South to the Guild Square: the Silver Crescent Guild, the Ashvale Runesmithy and Drake\'s Menagerie.', 'Someone has added, in chalk: "and the woods, if you\'re brave".']);
  add('guild_door', 'Heavy oak doors banded with silver. A notice nailed beside them reads: "Contracts inside. Wipe your boots. That means you, Pip."');
  add('runesmithy_door', 'Heat breathes out of the doorway, and a steady ring of hammer on anvil. The sign shows a rune shaped like a little house.');
  add('menagerie_door', 'Straw on the step, a bowl of water by the door, and somewhere inside, a very small dragon sneezing.');
  add('guild_statue', 'A stone hunter with a crescent on her shield. The plaque reads: "For those who walked into the dark so others could sleep."');
  add('dragon_perch', 'A tall perch of iron and oak, scratched deep by claws. Caspian keeps it oiled "for whoever lands next".');
  add('home_laura', ['Laura\'s house. Black lace at the windows and a hand-painted sign: "NO SALESPEOPLE. NO SERMONS. NO SLIMES."', 'Under it, smaller: "cats welcome".']);
  add('home_jasmine', ['Jasmine\'s cottage. Window boxes full of lavender, a little bee painted on the door, and the smell of honey cake.']);
  add('home_amara', ['Amara\'s study, up in the teal turret. A brass telescope pokes out of the top window like a curious eyebrow.']);
  add('home_ronan', ['Ronan\'s house. The door is locked, but the knocker is beautiful: a hammer and a crescent, forged in one piece.']);
  add('home_gideon', ['Gideon\'s house. Locked tight. A pipe-shaped burn mark on the doorframe, and a boot scraper worn nearly through.']);
  add('home_locked_night', 'The lamps are out and the door is locked. Better come back tomorrow.');
  // inside the Guild hall
  add('guild_hearth', 'The great hearth roars. Hunters dry their boots here and lie about the size of things.');
  add('guild_trophy_wolf', 'A moss-wolf\'s head, older than Laura. The plaque: "The first one Gideon brought back. He won\'t say how."');
  add('guild_trophy_stag', 'A stag skull, its antlers threaded with old prayer ribbons.');
  add('guild_slime_jar', 'A slime in a jar. It is alive. It is watching you. Someone has labelled it "Kevin".');
  add('guild_map_table', 'A map of the valley weighed down with daggers. Little flags mark where contracts were finished, and a few where they weren\'t.');
  add('guild_long_table', 'Carved into the table: tallies, initials, and one very rude drawing of a slime ogre.');
  // the Runesmithy
  add('smithy_forge', 'The rune forge burns a steady teal at its heart. Ronan says the colour means it\'s happy.');
  add('smithy_trough', 'Quench water, faintly glowing. A sign: "Do not drink. Do not bathe. Do not put the cat in."');
  add('smithy_crates', 'Crates of ore, sorted by colour and, apparently, by mood.');
  add('smithy_grindstone', 'A grindstone worn into a perfect curve. It hums when it turns.');
  // the Menagerie
  add('menagerie_aquarium', 'Little silver fish weave between the weeds. One of them is definitely judging you.');
  add('menagerie_incubator', 'A warm glass dome. Inside, an egg the colour of dusk rocks very gently on its own.');
  add('menagerie_hay', 'Fresh hay. A kitten is asleep in the top of it and would like you to leave.');
  add('menagerie_saddles', 'Saddles for horses, and one enormous saddle with two holes for wings.');
  // Laura's room
  add('laura_records', 'A crate of records: The Howling Moons, Grave Pastels, Seven Stray Cats. All very loud. All very scratched.');
  add('laura_vanity', 'Spiked rings, a skull hair clip, black lipstick, and one small heart-shaped locket she will say isn\'t hers.');
  add('laura_bed', 'A dark quilt and a bat plush with one button eye. The plush is called Count Fluffington. Do not ask.');
  add('laura_guitar', 'An old guitar covered in stickers. The strings are new. Someone practises.');
  // Jasmine's cottage
  add('jasmine_bear', 'Sir Bartholomew Honeypaw, a teddy bear the size of a small sofa. He has a little crown.');
  add('jasmine_honey', 'Jars of honey with handwritten labels: "clover", "moonpetal", "Tuesday", "for {player} :)".');
  add('jasmine_counter', 'Cupcakes cooling on a rack. One has a bite out of it and a note: "quality control".');
  add('jasmine_bed', 'A patchwork quilt covered in little embroidered bears. Several real bears too.');
  // Amara's study
  add('amara_chalkboard', 'Equations, runes, a comet\'s orbit, and in the corner, a tiny doodle of a cat in a wizard hat.');
  add('amara_orrery', 'A brass orrery. Seven moons, one more than the sky has. Amara insists the seventh is "just late".');
  add('amara_telescope', 'The telescope is pointed at a patch of sky labelled "BISCUIT?!" in the margin of her notes.');
  add('amara_desk', 'Flasks bubble on the desk. A label reads "DO NOT DRINK (again)".');
})();
