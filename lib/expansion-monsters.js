// Monsters from the two expansion books: East Portal Setting Guide ("More Monsters", pp. 88–95) and
// Judgment on the Iron Road ("More Monsters", pp. 181–183). `book` names the source; `page` is its printed page.
// monsters.js, profiles.js and trophies.js fold these in, so the Scanner, fights and loot see them like any other.
const EP = 'East Portal', IR = 'Iron Road';

export const X_MONSTERS = [
  { name: 'Antlion', kz: '9-8-0337', size: 'Large', page: 88, book: EP },
  { name: 'Glowing Cave Worm', kz: '0-3-5196', size: 'Small', page: 89, book: EP },
  { name: 'Opal Beetle', kz: '2-5-8871', size: 'Medium', page: 90, book: EP },
  { name: 'Red Horned Devil', kz: '2-0-7665', size: 'Medium', page: 91, book: EP },
  { name: 'Red Mine Spider', kz: '3-1-0374', size: 'Small', page: 92, book: EP },
  { name: 'Spotted Whiptail', kz: '1-4-5851', size: 'Medium', page: 93, book: EP },
  { name: 'Vampire Trout', kz: '6-3-1942', size: 'Small', page: 94, book: EP, traits: ['sweep-immunity'] },
  { name: 'Vasthorn Ram', kz: '2-8-2071', size: 'Large', page: 95, book: EP },
  { name: 'Golden Eagle', kz: '5-8-4472', size: 'Medium', page: 181, book: IR },
  { name: 'Hodag', kz: '4-6-1903', size: 'Small', page: 182, book: IR },
  { name: 'Range Troll', kz: '9-1-3659', size: 'Large', page: 183, book: IR },
];

const atk = (name, grit, range, effect, aoe = false) => ({ name, grit, range, aoe, effect });
const fz = (name, health, text, event = false) => ({ name, event, health, text });

export const X_PROFILES = [
  {
    name: 'Antlion', size: 'Large', page: 88, book: EP, health: 80, defense: '1G', speed: 'Slow',
    skills: { charm: '3B', finesse: '2B', intuition: '5G', nerve: '2B3G' },
    attacks: [
      atk('Spiked Mandibles', 4, 'Melee', '3G damage + Trapped [3]'),
      atk('Venom Injection', 2, 'Melee', 'Poisoned [3G]'),
      atk('Sand Toss', 1, 'Short', '1B damage + Knockback'),
      atk('Lion Screech', 3, 'Long', 'Afraid [1], Dazed [1]', true),
      atk('Stone Trebuchet', 3, 'Long', '4B damage'),
    ],
    tolerances: 'Sweep [2], Afraid [2G], Burned [1B], Poisoned [2B]',
    features: [
      'Quicksand. Twice per day, the Antlion can manipulate the sand around it in a Long Range radius, causing one of the following effects: (1) Each target sinks into the sand inflicting Trapped [3B]; (2) each target is moved one Short Range closer to the Antlion; or (3) the sand becomes Rough Terrain for all except the Antlion.',
      'Undercover. When hidden at the bottom of the sand pit, the Antlion gains the benefits of Heavy Cover.',
    ],
    frenzy: [fz('Tomb Sealer', 5, 'Roll 1B. On a Hit or an Ace the Antlion realizes it’s done for, reaches for the nearest target within Short Range, and shakes violently, collapsing the pit upon itself and the target. The tomb has been sealed. Unless somehow rescued within two rounds of player actions, the target dies of suffocation along with the Antlion.', true)],
  },
  {
    name: 'Glowing Cave Worm', size: 'Small', page: 89, book: EP, health: 18, defense: '-', speed: 'Normal',
    skills: { charm: '3G', finesse: '2B', intuition: '2B1G', nerve: '2B' },
    attacks: [
      atk('The Drop', 3, 'Melee', '3G damage'),
      atk('Wrap Victim', 4, 'Melee', '2B damage + Trapped [1]'),
      atk('Toxic Juices', 3, 'Short', '1B damage + Poisoned [2]'),
      atk('Glowing Lure', 3, 'Long', 'Dazed [1B]', true),
    ],
    tolerances: 'Afraid [1B], Poisoned [1G]',
    features: [
      'Bioluminescence. If a target is inflicted with the Dazed Status using the worm’s Glowing Lure attack, that target must move closer to the worm by one Short Range distance.',
      'One with the Cave. The Glowing Cave Worm can scale walls and stick to ceilings at will and at Normal speeds.',
    ],
    frenzy: [fz('Bright Burst', 7, 'The worm now resorts to blinding its opponent(s) in order to get the upper hand. Spending 4 Grit, it inflicts Dazed [3G] to all targets in Short Range.')],
  },
  {
    name: 'Opal Beetle', size: 'Medium', page: 90, book: EP, health: 26, defense: '3B', speed: 'Normal',
    skills: { charm: '3B1G', finesse: '2B', intuition: '2B', nerve: '2B2G' },
    attacks: [
      atk('Crystal Horn', 3, 'Melee', '3G damage + Piercing [2]'),
      atk('Steamroller', 4, 'Short', '2B2G damage + Knockback'),
    ],
    tolerances: 'Burned [1G], Dazed [1B], Unconscious [1B]',
    features: [
      'Iridescent Distraction. Attacks made against the beetle within Short Range aren’t as effective. Any Aces rolled are instead converted into Hits and don’t count towards a player’s Ace-in-the-Hole abilities.',
      'Mesmerize. After any attack, the beetle may choose to spend an additional 1 Grit to also inflict Dazed [2].',
    ],
    frenzy: [fz('Hypnotize', 10, 'The beetle uses its beautifully polished opal shell to hypnotize its foes. Any targets within Short Range of the beetle are inflicted with Unconscious [3B].', true)],
  },
  {
    name: 'Red Horned Devil', size: 'Medium', page: 91, book: EP, health: 66, defense: '1B', speed: 'Normal',
    skills: { charm: '3B', finesse: '3G', intuition: '3B', nerve: '3G' },
    attacks: [
      atk('Demon Horns', 4, 'Melee', '4B damage + Burned [1]'),
      atk('Merciless Claws', 2, 'Melee', '2G damage + Piercing [1]'),
      atk('Blood Wail', 3, 'Long', 'Dazed [2B]', true),
    ],
    tolerances: 'Sweep [1], Afraid [1G], Burned [Immune], Trapped [1B]',
    features: [
      'Metabolic Overdrive. Twice per day, the devil may choose to reroll all dice within the attack, defense, or skill dice pool, hoping the second roll will yield greater results.',
      'Feeds on Fear. Any attacks made against a target with the Afraid Status are rolled with an additional +2B.',
      'Smokescreen. When taking the Dodge action roll with Gold dice instead of Black.',
      'Perdition. Players may not reroll Spurs when within Short Range of the Red Horned Devil.',
    ],
    frenzy: [fz('Cindersurge', 38, 'The devil’s wings begin to smoke heavily before igniting into a crimson blaze, eyes dilated red. Spending 3 Grit, it can now spit fire at Short Range dealing 3B damage + Burned [2]. When this Frenzy is first activated, all targets within sight of the devil, take Afraid [2G].')],
  },
  {
    name: 'Red Mine Spider', size: 'Small', page: 92, book: EP, health: 26, defense: '1B', speed: 'Normal',
    skills: { charm: '2B', finesse: '2B1G', intuition: '2G', nerve: '1B1G' },
    attacks: [
      atk('Drowsy Venom', 3, 'Melee', '1G damage + Unconscious [1]'),
      atk('Venomless Bite', 3, 'Melee', '2G damage'),
      atk('Silk Sling', 2, 'Short', '1B damage + Trapped [1]'),
      atk('Fisherman’s Web', 4, 'Long', 'Trapped [3B]'),
    ],
    tolerances: 'Trapped [2B], Unconscious [1B]',
    features: [
      'Netted Cover. Spending 3 Grit, the Red Mine Spider spins a web in front of itself granting it Light Cover as long as the net interferes with any enemy’s line of sight. If it uses this ability again in the same place, it’s granted Heavy Cover.',
      'Miner Imitations. The spider has adapted to its environment and learned how to attract human prey by mimicking the sounds of miners working in the tunnels, that is, a pickaxe chipping away at a wall.',
    ],
    frenzy: [fz('Catch of the Day', 10, 'The next victim to be successfully trapped by the spider’s Fisherman’s Web attack becomes Captured and reeled in within Arm’s Reach. Any attacks made against that target deal an extra +1G damage.')],
  },
  {
    name: 'Spotted Whiptail', size: 'Medium', page: 93, book: EP, health: 38, defense: '2G', speed: 'Fast',
    skills: { charm: '3B', finesse: '2B1G', intuition: '2B', nerve: '1B3G' },
    attacks: [
      atk('Quick Bite', 2, 'Melee', '2G damage'),
      atk('Tailwhip', 2, 'Short', '2B damage'),
      atk('Thunderous Crack', 4, 'Long', 'Dazed [2B]', true),
    ],
    tolerances: 'Sweep [1], Afraid [1B], Burned [1B], Poisoned [1B]',
    features: [
      'Innate Reflexes. If a Prepared Attack is made against the Spotted Whiptail, roll 1B. On a Hit or an Ace, the monster’s quick reflexes anticipate the attack and it completely Dodges it.',
      'Scurry & Skitter. It never moves in a straight line and never stays in one place. Aim Actions made against the Spotted Whiptail cost the player 2 Grit instead of 1.',
      'Quickstep. Once per round, the Spotted Whiptail may take one free Move Action outside of its turn.',
    ],
    frenzy: [fz('Mover’s Mirage', 15, 'The Spotted Whiptail moves so quickly and unpredictably that it’s hard to keep track of during combat. For each attack made against it, roll 1B. On a Hit or an Ace that attack hits the monster. On a Blank or a Spur, the attack completely misses.')],
  },
  {
    name: 'Vampire Trout', size: 'Small', page: 94, book: EP, health: 21, defense: '1G', speed: 'Fast',
    skills: { charm: '1B', finesse: '4G', intuition: '1B1G', nerve: '2B' },
    attacks: [
      atk('Fleshy Bite', 3, 'Melee', '2G damage + Piercing [1]'),
      atk('Abrasive Scale Bash', 2, 'Melee', '1G damage'),
    ],
    tolerances: 'Burned [2G], Electrocuted [-1G]',
    features: [
      'Water Ward. The Vampire Trout must remain in the water to breathe, but doing so keeps it safe from the effects of any Forstall signals.',
      'Fishing Nets. The trout is susceptible to netted traps used against it. Add +1G to net-based trap dice pools.',
      'Flashy Scales. Once per day, the trout can flash its highly reflective, rainbow scales to confuse any targets within Short Range. Those targets start their next turn with only half their Grit.',
    ],
    frenzy: [fz('Feeding Frenzy', 5, 'The blood in the water attracts a school of smaller Vampire Trout, ready to feed. Each target currently positioned in the water takes 3G damage + Piercing [1], including this and other Vampire Trout.', true)],
  },
  {
    name: 'Vasthorn Ram', size: 'Large', page: 95, book: EP, health: 68, defense: '2B', speed: 'Normal',
    skills: { charm: '2B', finesse: '4G', intuition: '3B', nerve: '4G' },
    attacks: [
      atk('Battering Ram', 3, 'Melee', '4G damage + Knockback'),
      atk('Boulder Breaker', 5, 'Melee', '6G damage + Dazed [2]'),
      atk('Bluff Charge', 3, 'Short', 'Afraid [4G]'),
      atk('Defensive Stance', 2, 'Long', 'Afraid [2B]', true),
    ],
    tolerances: 'Sweep [2], Afraid [1B], Dazed [1B]',
    features: [
      'Focused Attack. The Ram can choose to build up its focus and energy on one turn to release an explosive attack on its next turn. For each Grit spent on “focusing” during its current turn, the Ram can convert one Hit into an Ace on its next turn’s attack.',
      'Big Bully. If the target of an attack is within Arm’s Reach of another target, they both take the effects of that attack.',
      'With a Bang! Once per day, the Ram may decide to apply the Bang! property to one of its melee attacks.',
      'Double Knockback. If the monster’s Battering Ram attack deals 5 or more damage, the target is knocked back twice the distance.',
    ],
    frenzy: [fz('Raw Power', 20, 'The ram is livid and will show no mercy. It gains +2 Grit per turn.')],
  },
  {
    name: 'Golden Eagle', size: 'Medium', page: 181, book: IR, health: 44, defense: '1G', speed: 'Fast',
    skills: { charm: '3G', finesse: '3G', intuition: '3G', nerve: '3G' },
    attacks: [
      atk('Golden Beak', 2, 'Melee', '2G damage'),
      atk('Tri-talon', 3, 'Melee', '1B1G damage + Trapped [2]'),
      atk('Low Dive', 3, 'Short', '3B damage'),
      atk('Eagle Screech', 4, 'Short', 'Dazed [2B]'),
      atk('Stone Drop', 3, 'Long', '2B damage + Dazed [1B]'),
    ],
    tolerances: 'Sweep [1], Afraid [1B], Dazed [-1B], Trapped [1G]',
    features: [
      'Divine Sight. The Golden Eagle has unmatched eyesight. When a target takes cover, they roll with one less die (i.e. Heavy Cover = 1B, Light Cover = 0).',
      'Aerial Expert. When the eagle takes the Dodge action, add +1G to its roll.',
      'Gift of Flight. The eagle gets one free Move Action per turn when flying in the air. No Grit cost needed.',
    ],
    frenzy: [fz('Death Drop', 13, 'After a successful Tri-talon attack, the Golden Eagle can spend another 2 Grit to take the Trapped target into the sky and drop them to their death. This new attack deals 6G damage. If the outcome of the roll is more than 6 Hits, they also take the Unconscious [5] Status and suffer from a major injury as determined by the Warden.')],
  },
  {
    name: 'Hodag', size: 'Small', page: 182, book: IR, health: 28, defense: '1B', speed: 'Normal',
    skills: { charm: '3G', finesse: '2B', intuition: '1B1G', nerve: '3B' },
    attacks: [
      atk('Spiked Tail', 2, 'Melee', '1B damage'),
      atk('Formidable Fangs', 3, 'Melee', '1G damage + Poisoned [1]'),
      atk('Horn Charge', 4, 'Short', '2B damage + Piercing [1]'),
      atk('Low Growl', 3, 'Long', 'Afraid [1G]', true),
    ],
    tolerances: 'Afraid [1B], Burned [1B], Poisoned [1B]',
    features: [
      'Feeds on Fear. If attacking a target with the Afraid Status, add +1B to the roll.',
      'Petrifying Red Eyes. Once per day, the Hodag may lock eyes with one target within Short Range. Doing so skips that target’s next turn as they are briefly petrified in place.',
    ],
    frenzy: [fz('Last Lickin’', 0, 'When the Hodag reaches 0 Health, it lunges at the nearest target within Short Range with its horns. The attack deals 4G damage + Piercing [1] before it dies with horns still in the target’s flesh.', true)],
  },
  {
    name: 'Range Troll', size: 'Large', page: 183, book: IR, health: 65, defense: '1B', speed: 'Slow',
    skills: { charm: '5B', finesse: '2B', intuition: '3B', nerve: '5B' },
    attacks: [
      atk('Hammarslag', 4, 'Melee', '6G damage + Knockback'),
      atk('Klor', 3, 'Melee', '3G damage'),
      atk('Earth Toss', 4, 'Short', '4B damage + Dazed [2]'),
      atk('Troll Breath', 4, 'Short', 'Poisoned [3B]', true),
    ],
    tolerances: 'Sweep [2], Afraid [1G], Burned [1G], Electrocuted [1G], Poisoned [1G], Trapped [1G], Unconscious [1G]',
    features: [
      'Grounded. The troll moves so slow that it’s unable to take the Dodge action. Instead it may choose to save any remaining Grit to regenerate Health. 1 Grit = 1 Health. This feature does not apply when in its Frenzy.',
      'Deep Sleeper. Once per day and at the end of its turn, the troll may choose to sleep off the pain. At the start of its next turn it wakes up having 6B6G more Health but takes Dazed [3] as well.',
      'Trollunge Talk. While the troll isn’t intelligent enough to talk, it can repeat simple words and phrases it has heard in the past, such as: “EAT!”, “GO ‘WAY!”, and “SMASH!”.',
    ],
    frenzy: [fz('Steamroller', 25, 'The troll curls up into a ball and begins rolling around. Its stats change to: Defense 2G, Speed Fast, and its only attack is to steamroll over an enemy (2 Grit, 2G + Dazed [1]).')],
  },
];

// Trophies box of each profile. Several are upgrades or kitbash parts (Mounted/Melee Attachment, Utility).
export const X_TROPHIES = {
  'Antlion': 'Lion Jaws. The Antlion’s spiked mandibles can be kitbashed to a mech as a Mounted Attachment Upgrade. Spending 4 Grit deals 3G damage + Trapped [3].',
  'Glowing Cave Worm': 'Glowing Oil. The bioluminescent oil gives off light in a Short Range radius when burned in an oil lamp. Decide what color of light each cave worm gives off: electric blue, bright pink, sinister green, or another of your choice.',
  'Opal Beetle': 'Opal Shell. The beetle’s opal can be used to adorn one’s self or a weapon as a Utility upgrade. Doing so allows that player to convert any Aces to Hits in an attack made against them. May be used twice per day.',
  'Red Horned Devil': 'Demon Horns. These red horns can be used as a melee weapon or Melee Attachment upgrade. Spending 4 Grit, it deals 4B damage + Burned [1].',
  'Red Mine Spider': 'Silk Sack. The silk found in the spider’s silk sack is thin, strong, and durable. Spending 3 Grit, a player may use this webbing as sutures to seal an open wound. Doing so grants the beneficiary 6B Health.',
  'Spotted Whiptail': 'Whiptail. The monster’s tail can be used as a Short Range whip. Spending 2 Grit deals 2B damage but spending 3 Grit deals 2B damage + Dazed [1] as the whip cracks at ear-shattering levels.',
  'Vampire Trout': 'Rainbow Scales. Once per day and spending 3 Grit, the trout’s scales can be used like a mirror to reflect light at a target within Short Range, distracting them for a time. For one turn, that target’s Grit is halved.',
  'Vasthorn Ram': 'Battering Ram Horns. These horns can be used as a battering ram to knock down barricades, buildings, and even monsters. Place as a Mounted Attachment upgrade on a mech, spend 3 Grit, and roll 4G damage + Knockback. For knocking down objects, the Warden determines if the 4G roll was high enough to break through.',
  'Golden Eagle': 'Golden Feathers. Arrows with fletching made from these golden feathers fly much farther and straighter. When shooting a target at Long Range convert one Black die to Gold. No need to track these arrows. They have unlimited uses.',
  'Hodag': 'Hodag Head. If the Hodag’s head is made into a mask, it can be worn to have the same effect as the Petrifying Red Eyes feature. It can be used once per day on human enemies. Monsters aren’t affected.',
  'Range Troll': 'Trollhide. The troll’s skin is quick to heal and can be used as a First Aid item. Roll 6B6G to determine how many bandage-sized cutouts can be salvaged from the monster. When using the trollhide, spend 2 Grit and roll 2G. Each Hit restores 1 Health.',
};

// Where a page number comes from, for labels ("Guidebook p. 152", "East Portal p. 88").
export const bookLabel = (x) => `${x?.book || 'Guidebook'} p. ${x?.page ?? '—'}`;
