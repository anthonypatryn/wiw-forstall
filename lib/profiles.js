// Monster combat profiles from the Wild Imaginary West Official Guidebook (Section Six), for the Warden's
// combat tracker. Stats only — descriptions and trophies are left in the book. Served behind the Warden PIN.
export const PROFILES = [
 {
  "name": "Alligator Snapping Turtle",
  "size": "Huge",
  "page": 141,
  "health": 63,
  "defense": "5G",
  "speed": "Slow",
  "skills": {
   "charm": "5B",
   "finesse": "1B1G",
   "intuition": "3B",
   "nerve": "2B4G"
  },
  "attacks": [
   {
    "name": "Iron Jaws",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "8G damage"
   },
   {
    "name": "Steady Trample",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "4B damage + Trapped [3]"
   },
   {
    "name": "Rotshot",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Poisoned [2]"
   },
   {
    "name": "Sonic Roar",
    "grit": 2,
    "range": "Long",
    "aoe": true,
    "effect": "3B damage + Afraid [2]"
   }
  ],
  "tolerances": "Sweep [4], Afraid [3G], Burned [2B], Poisoned [1B], Trapped [2B]",
  "features": [
   "Fast Swimmer. If taking the Move Action while in water, the turtle's speed becomes Fast.",
   "Harden Shell. During its Frenzy, the turtle's shell becomes nearly impenetrable, rolling 6G for Defense.",
   "Part Gator. Drawing from its aggressive heritage, the Alligator Snapping Turtle gains a frightening burst of speed. Twice per day, the Turtle may take one free Move Action."
  ],
  "frenzy": [
   {
    "name": "Guillotine",
    "event": false,
    "health": 30,
    "text": "The turtle's Iron Jaw attack now does 6B6G damage. If this drops a target to 0 Health, that character is beheaded and immediately dies. No Bleeding Out."
   }
  ]
 },
 {
  "name": "Alpine Bigfoot",
  "size": "Large",
  "page": 141,
  "health": 70,
  "defense": "2G",
  "speed": "Normal",
  "skills": {
   "charm": "5G",
   "finesse": "2B",
   "intuition": "3B",
   "nerve": "6B"
  },
  "attacks": [
   {
    "name": "Big Foot",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2B2G damage + Dazed [2]"
   },
   {
    "name": "Brutal Fists",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage"
   },
   {
    "name": "Forage and Throw",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage"
   },
   {
    "name": "Alpine Alpha",
    "grit": 4,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [4B]"
   }
  ],
  "tolerances": "Sweep [3], Afraid [2B], Dazed [1G], Trapped [3G]",
  "features": [
   "Counter Blow. The Bigfoot can attempt to block or counter attacks made against it. After being targeted by a Melee Attack, spend 2 Grit (from the Bigfoot's next turn) and choose whether it applies to additional Defense (1B3G) or as immediate retaliation (1B1G).",
   "Technological Target. The Bigfoot doesn't like anything that hums, beeps, or buzzes. Add +1B to any attacks made against someone within Arm's Reach of a Forstall or Mech. This includes attacks directed at any mech.",
   "The Combo. After two successful Brutal Fists attacks on a single turn, the Bigfoot may choose to throw the target at no additional Grit cost. The target is hurled up to Short Range, taking 2G damage from the impact and is knocked down."
  ],
  "frenzy": [
   {
    "name": "A Nasty Beating",
    "event": true,
    "health": 35,
    "text": "Full of uncontrollable rage, the Bigfoot selects one target to beat to a bloody pulp. Roll 2B6G if the target is human, or 6B6G if the target is a mech."
   }
  ]
 },
 {
  "name": "American Bullfrog",
  "size": "Large",
  "page": 142,
  "health": 75,
  "defense": "2G",
  "speed": "Slow",
  "skills": {
   "charm": "6B",
   "finesse": "2B",
   "intuition": "2B",
   "nerve": "6B"
  },
  "attacks": [
   {
    "name": "Gulp",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage + Trapped [3]"
   },
   {
    "name": "Bullish Leap",
    "grit": 4,
    "range": "Short",
    "aoe": false,
    "effect": "3B3G damage + Dazed [1] + Poisoned [1]"
   },
   {
    "name": "Tongue Whip",
    "grit": 2,
    "range": "Long",
    "aoe": false,
    "effect": "2B damage + Trapped [2]"
   },
   {
    "name": "Deafening Croak",
    "grit": 4,
    "range": "Long",
    "aoe": true,
    "effect": "3B damage + Dazed [2] + Afraid [1]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [2B], Burned [1B], Dazed [1B], Poisoned [2B], Trapped [1G]",
  "features": [
   "Long Range Tongue. When the bullfrog successfully uses its Tongue Whip attack, it immediately pulls that target within Arm's Reach.",
   "Moving Target. The bullfrog is drawn to anything that moves and will almost always attack the last player that moves before its turn. In this case, convert any Black dice to Gold dice for the first attack made against the moving target."
  ],
  "frenzy": [
   {
    "name": "Equipment Abduction",
    "event": false,
    "health": 40,
    "text": "Spending 4 Grit, the bullfrog can use its tongue up to Long Range to snatch a target's weapon or a mech's upgrade and swallow it. The item can be retrieved from the bullfrog's stomach once it drops to 0 Health, or after the Trapped Status gained by its Gulp attack is successfully relieved."
   }
  ]
 },
 {
  "name": "American Mastodon",
  "size": "Large",
  "page": 145,
  "health": 77,
  "defense": "2G",
  "speed": "Normal",
  "skills": {
   "charm": "4G",
   "finesse": "2B",
   "intuition": "3B",
   "nerve": "3B3G"
  },
  "attacks": [
   {
    "name": "Serrated Tusks",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "4G damage + Piercing [2]"
   },
   {
    "name": "Tusk Toss",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "3B damage + Dazed [2]"
   },
   {
    "name": "Charge and Trample",
    "grit": 4,
    "range": "Short",
    "aoe": false,
    "effect": "6B damage + Dazed [3]"
   },
   {
    "name": "Startling Trumpet",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [3G]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [3B], Dazed [2B], Trapped [1B]",
  "features": [
   "Pulverize. Should a target drop to 0 Health after a damage-dealing attack, roll 1B. If the outcome is a Hit or Ace, the mastodon continues to trample the victim until they are dead-dead. No Bleeding Out scenario occurs.",
   "Mule vs. Masto. Twice per day, the mastodon may show off its strength against a mech by adding +2G to one of its attack dice pools."
  ],
  "frenzy": [
   {
    "name": "Prehistoric Powerhouse",
    "event": false,
    "health": 20,
    "text": "The mastodon becomes enraged, losing all sense of reason. Any damage it deals to a target is doubled, but it also becomes very vulnerable to all statuses (-2B)."
   }
  ]
 },
 {
  "name": "Badlands Sasquatch",
  "size": "Medium",
  "page": 145,
  "health": 48,
  "defense": "2B",
  "speed": "Normal",
  "skills": {
   "charm": "5G",
   "finesse": "1B1G",
   "intuition": "4B",
   "nerve": "2B2G"
  },
  "attacks": [
   {
    "name": "Double Axe Handle",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "4G damage"
   },
   {
    "name": "Choke Hold",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage + Trapped [1]"
   },
   {
    "name": "Rock Throw",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Dazed [1]"
   },
   {
    "name": "Savage Snarl",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [2B]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [2G], Dazed [1B], Trapped [3B]",
  "features": [
   "Manipulative Eyes. When first approached, the Sasquatch gives off a harmless, human-like demeanor before attacking with an extra +1G regardless of the attack used.",
   "Half-Man. Spending 4 Grit within Arms Reach, the Sasquatch can attempt to steal a target's weapon in a Nerve Challenge Roll. If successful, it steals and can use the weapon. It spends the same weapon Grit cost but with half the dice pool because of its inexperience.",
   "Tuck n' Roll. Twice per day, the Sasquatch can Dodge using 4B without using any Grit. It can choose to do so after an attack roll against it has been made."
  ],
  "frenzy": [
   {
    "name": "Barbaric Assault",
    "event": false,
    "health": 13,
    "text": "The Sasquatch leaps at a target within Short Range and uses its Double Axe Handle attack. If the attack is successful, the Sasquatch can leap to another target within Short Range, using the same attack on the second target. There is no Grit cost for the leap and second attack."
   }
  ]
 },
 {
  "name": "Bark Watcher",
  "size": "Small",
  "page": 146,
  "health": 10,
  "defense": "1G",
  "speed": "Normal",
  "skills": {
   "charm": "2B",
   "finesse": "3G",
   "intuition": "2B1G",
   "nerve": "2B"
  },
  "attacks": [
   {
    "name": "Bark Slash",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage"
   },
   {
    "name": "Irritating Spores",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "2B Damage + Dazed [2]"
   },
   {
    "name": "Splinter Darts",
    "grit": 1,
    "range": "Short",
    "aoe": false,
    "effect": "1B damage"
   }
  ],
  "tolerances": "Burned [-1B], Electrocuted [1G], Unconscious [2B]",
  "features": [
   "Forest Camouflage. The Bark Watcher gains +1G to Finesse rolls made to be stealthy or hide as long as its in the forest.",
   "Echoes of Nature. The Bark Watcher can mimic the sounds of nature and project them as if coming from anywhere else within Long Range."
  ],
  "frenzy": [
   {
    "name": "Eject All Spores",
    "event": true,
    "health": 4,
    "text": "Spores explode from its skin to produce a plume of particles in the air. It breaks the line of sight between it and its enemies, allowing it to hide or escape. It also inflicts Dazed [2B] to any target within Short Range. When this is triggered, it can no longer use its Irritating Spores attack."
   }
  ]
 },
 {
  "name": "Black Widow and Spawn",
  "size": "Medium",
  "page": 146,
  "health": 55,
  "defense": "1B",
  "speed": "Normal",
  "skills": {
   "charm": "4G",
   "finesse": "1B2G",
   "intuition": "3G",
   "nerve": "2B"
  },
  "attacks": [
   {
    "name": "Inject Venom",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage + Poisoned [1]"
   },
   {
    "name": "Wrap Prey",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "Trapped [4B]"
   },
   {
    "name": "Web Grenade",
    "grit": 4,
    "range": "Short",
    "aoe": true,
    "effect": "Trapped [2B]"
   },
   {
    "name": "Short Web Bolt",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Trapped [1]"
   },
   {
    "name": "Long Web Bolt",
    "grit": 3,
    "range": "Long",
    "aoe": false,
    "effect": "1B damage + Trapped [1]"
   }
  ],
  "tolerances": "Sweep [1], Afraid [1G], Poisoned [2B]",
  "features": [
   "Spider Web Nest. When positioned on its webbed nest, the Black Widow gains the benefits of Light Cover.",
   "Red Hourglass. After three rounds have passed, the Black Widow's hourglass begins to faintly glow. The next target who's successfully bitten using the Inject Venom attack, becomes marked with a swollen, red wound. Any attack made against the marked target, is rolled with the Bang! property. This wound can only be cured with the anti-venom serum that comes from the monster's Venom Sack Trophy.",
   "Widower's Kiss. If a target is currently Poisoned or Trapped, the Black Widow gets an extra +1B to its Inject Venom attack made against that target."
  ],
  "frenzy": [
   {
    "name": "Egg Sac Burst",
    "event": true,
    "health": 25,
    "text": "The egg sac on the back of the Black Widow suddenly bursts. An army of little spiders scatter about quickly in a Long Range radius, inflicting Afraid [6B] to all targets within range. The ground becomes Rough Terrains for the next two rounds."
   }
  ]
 },
 {
  "name": "Bloodsucker",
  "size": "Small",
  "page": 147,
  "health": 6,
  "defense": "-",
  "speed": "Normal",
  "skills": {
   "charm": "3B",
   "finesse": "3B",
   "intuition": "1B",
   "nerve": "2B"
  },
  "attacks": [
   {
    "name": "Blood Latch",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "1G damage"
   },
   {
    "name": "Transfusion",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage"
   },
   {
    "name": "Expel Blood",
    "grit": 4,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Poisoned [1]"
   }
  ],
  "tolerances": "Poisoned [1B]",
  "features": [
   "Host-Bound. After rolling at least 1 Hit during either melee attack, the Bloodsucker takes Trapped [1]. To remove it, the player must roll with Nerve, target 3. If successful, roll 1B to see if that player takes any more damage during the removal process.",
   "Parasite. The Bloodsucker has to be latched onto a target with its Blood Latch attack before it can use its Transfusion attack. While attached to a host, it cannot drop below 1 Health.",
   "Numbing Saliva. If the Bloodsucker attacks without first being seen, it uses its saliva to numb the host's body before sinking its teeth into their skin and drinking their blood nearly undetected."
  ],
  "frenzy": [
   {
    "name": "Engorge",
    "event": false,
    "health": 1,
    "text": "If attached to a host at 1 Health, its Transfusion attack now costs only 3 Grit."
   }
  ]
 },
 {
  "name": "Bone-Carver Ant",
  "size": "Tiny",
  "page": 147,
  "health": 6,
  "defense": "-",
  "speed": "Normal",
  "skills": {
   "charm": "1B1G",
   "finesse": "2B",
   "intuition": "3B",
   "nerve": "1B"
  },
  "attacks": [
   {
    "name": "Mandible Crush",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2B damage"
   },
   {
    "name": "Animal Femur",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage"
   },
   {
    "name": "Acidic Enzymes",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "Poisoned [2B]"
   }
  ],
  "tolerances": "None",
  "features": [
   "Strength of Ten. The Bone-Carver Ant can carry objects 10x its weight; like an adult human, Small monster, or heavy bone.",
   "Excavator. The ant can move underground through soft dirt or sand. If it does, this Move Action is considered Rough Terrain."
  ],
  "frenzy": [
   {
    "name": "Hive Link",
    "event": true,
    "health": 2,
    "text": "The BoneCarver Ant taps its mandible on the ground or nearby tree to send vibrations as a distress signal to other ants of its kind. Roll 2G to see how many ants respond to the call and join the fight. It takes the additional ant(s) one round of combat to appear."
   }
  ]
 },
 {
  "name": "Bull Jackalope",
  "size": "Large",
  "page": 148,
  "health": 52,
  "defense": "1G",
  "speed": "Normal",
  "skills": {
   "charm": "3B",
   "finesse": "3B",
   "intuition": "4B",
   "nerve": "4B"
  },
  "attacks": [
   {
    "name": "Gnarled Antlers",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2B2G damage"
   },
   {
    "name": "Thumper",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage + Dazed [1]"
   },
   {
    "name": "High Jump",
    "grit": 4,
    "range": "Short",
    "aoe": true,
    "effect": "3B damage + Afraid [3]"
   },
   {
    "name": "Big Bound",
    "grit": 4,
    "range": "Long",
    "aoe": false,
    "effect": "6B damage"
   }
  ],
  "tolerances": "Sweep [2], Afraid [1B], Dazed [1B], Trapped [1B]",
  "features": [
   "Sense Fear. The jackalope can choose to reroll one attack die if the target has the Afraid Status.",
   "Little Minions. Once per day, the jackalope can summon its army of Tiny jackalopes to aid in its siege. Doing so topples a barricade wall, mech, or other major structure.",
   "Unquenchable Hunger. Spending 3 Grit, the jackalope pauses to devour any vegetation or food around it. Doing so allows it to recover 6B Health."
  ],
  "frenzy": [
   {
    "name": "Thunderhop",
    "event": false,
    "health": 24,
    "text": "The jackalope gets one free Move Action per turn. Any Move Actions taken during its Frenzy inflict Dazed [1B] to any targets within Short Range of where it ends its movement."
   }
  ]
 },
 {
  "name": "Burrowing Mudbugs",
  "size": "Small",
  "page": 148,
  "health": 8,
  "defense": "2G",
  "speed": "Normal",
  "skills": {
   "charm": "1B",
   "finesse": "3B",
   "intuition": "2B",
   "nerve": "2B"
  },
  "attacks": [
   {
    "name": "Pincer Slash",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "1G damage"
   },
   {
    "name": "Pincer Grip",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "1G damage + Trapped [2]"
   },
   {
    "name": "Mud Toss",
    "grit": 4,
    "range": "Short",
    "aoe": false,
    "effect": "Trapped [3B]"
   }
  ],
  "tolerances": "Burned [1B], Trapped [1B]",
  "features": [
   "Burrow Cover. When in its burrow but not completely hidden, the Mudbug benefits from Light Cover.",
   "Sensitive Antennae. Using its antennae, the Mudbug is able to detect scents up to Short Range even when in its burrow. This way it knows exactly when to strike at an approaching target.",
   "Escape Artist. If the Mudbug has the Trapped Status with a Severity between 1-3, it can relieve itself from this Status and escape the trap at the cost of losing one of its legs. When it does, it takes 1G damage. At Trapped 4-6, it takes 2G damage.",
   "Regrow Limbs. If the Mudbug loses a leg or pincer, spend 3 Grit and roll 1B. On an Ace, it regrows its limb and adds 2 to its Health."
  ],
  "frenzy": [
   {
    "name": "Thump",
    "event": false,
    "health": 3,
    "text": "Spending 3 Grit, the Mudbug slaps its muscular tail on the ground, creating a loud thump. The sound inflicts the Dazed [2B] status for anyone within Short Range."
   }
  ]
 },
 {
  "name": "Canadian Beaver Bear",
  "size": "Large",
  "page": 150,
  "health": 50,
  "defense": "2G",
  "speed": "Normal",
  "skills": {
   "charm": "3B",
   "finesse": "3B",
   "intuition": "4B",
   "nerve": "2B3G"
  },
  "attacks": [
   {
    "name": "Ax Teeth",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "4G damage + Piercing [2]"
   },
   {
    "name": "Forehand Paddle Swing",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "3G damage + Dazed [2]"
   },
   {
    "name": "Backhand Paddle Swing",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "3B damage"
   },
   {
    "name": "Tidal Wave",
    "grit": 4,
    "range": "Long",
    "aoe": false,
    "effect": "5B damage"
   }
  ],
  "tolerances": "Sweep [2], Afraid [2B], Burned [1G], Trapped [1B]",
  "features": [
   "Aquatic Mammal. The Beaver Bear's movement speed increases to Fast while in water.",
   "Labyrinth Engineer. The Beaver Bear can create cover, collapse bridges, or reroute water with shocking speed. Its lodge is filled with Rough Terrain, but the Beaver Bear is unaffected there.",
   "Paddle Shield. Instead of taking the Dodge Action, the Beaver Bear may spend 1 Grit to use its broad paddle tail as a shield, granting it Heavy Cover."
  ],
  "frenzy": [
   {
    "name": "Dambush",
    "event": true,
    "health": 25,
    "text": "The beaver breaks an upstream dam, flooding the battlefield with raging waters. Roll 1G to determine the outcome for all targets within the flash flood zone. Blank: 6G damage, Spur: Dazed [6B], Hit: 6B damage + Knockback, Ace: Unconscious [6G]."
   }
  ]
 },
 {
  "name": "Carnivorous Pine",
  "size": "Large",
  "page": 150,
  "health": 38,
  "defense": "3G",
  "speed": "Slow",
  "skills": {
   "charm": "2B2G",
   "finesse": "1B",
   "intuition": "2G",
   "nerve": "6B"
  },
  "attacks": [
   {
    "name": "Root Maw",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage + Trapped [2]"
   },
   {
    "name": "Branch Lash",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2B2G damage"
   },
   {
    "name": "Sap Sling",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Trapped [1]"
   },
   {
    "name": "Pollen Irritant",
    "grit": 4,
    "range": "Long",
    "aoe": true,
    "effect": "Dazed [3G]"
   }
  ],
  "tolerances": "Sweep [2], Burned [-2B], Electrocuted [Immune], Poisoned [2B]",
  "features": [
   "Scented Pine Sap. An aromatic ultra-sticky sap that lures wildlife in then traps them so the pine can more easily devour its prey without it running away. Before the pine is discovered, any player that's within Short Range must roll with Intuition, target 3. If failed, those players are lured to Arms Reach.",
   "Fortified Tree Bark. Attacks made with fire, hatchets, axes, or similar wood-chopping weapons, bypass the Pine's 4B Defense completely.",
   "Timber. When low on Health and as a last-ditch effort to save the forest, a Carnivorous Pine will try to fall down and kill the threat with all its weight. Once felled, a pine can't get up and will eventually die. Targets in the way of the falling Pine will suffer 6G damage + Trapped [6]."
  ],
  "frenzy": [
   {
    "name": "Ensnare",
    "event": false,
    "health": 15,
    "text": "Spending 4 Grit, the pine stomps its feet down and roots shoot through the ground, ensnaring two targets and inflicting Trapped [4B]."
   }
  ]
 },
 {
  "name": "Chupacabra",
  "size": "Small",
  "page": 152,
  "health": 20,
  "defense": "1B",
  "speed": "Normal",
  "skills": {
   "charm": "2B2G",
   "finesse": "2B1G",
   "intuition": "3B",
   "nerve": "2G"
  },
  "attacks": [
   {
    "name": "Garras Letales",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "1G damage"
   },
   {
    "name": "Mordida Sangrienta",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "3B damage + Afraid [1]"
   },
   {
    "name": "Salto Estratégico",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Trapped 1]"
   },
   {
    "name": "Aullido Aterrador",
    "grit": 2,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [1G]"
   }
  ],
  "tolerances": "Sweep [1], Afraid [1G], Trapped [1B]",
  "features": [
   "Spinal Deflectors. The Chupacabra's spines help deflect Forstall signals. Intuition rolls made to Scan it must roll with half the dice pool.",
   "Supernatural Genetics. Twice per day the Chupacabra may spend an additional +2 Grit during its turn."
  ],
  "frenzy": [
   {
    "name": "Blood Bath",
    "event": false,
    "health": 8,
    "text": "The next Mordida Sangrienta attack does 6B damage and the Chupacabra's Health increases one point for every Hit from that attack."
   }
  ]
 },
 {
  "name": "Desert Scorpion",
  "size": "Large",
  "page": 152,
  "health": 46,
  "defense": "4B",
  "speed": "Normal",
  "skills": {
   "charm": "2B2G",
   "finesse": "3B",
   "intuition": "2B",
   "nerve": "5B"
  },
  "attacks": [
   {
    "name": "Pincer Vice Grip",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "3B damage + Trapped [2]"
   },
   {
    "name": "Venomous Stinger",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "4G damage + Poisoned [3]"
   },
   {
    "name": "Scorpion Flail",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage"
   },
   {
    "name": "Sand Blast",
    "grit": 4,
    "range": "Long",
    "aoe": true,
    "effect": "2B damage + Dazed [2]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [1B], Burned [1B], Dazed [1B], Poisoned [Immune]",
  "features": [
   "Arid Camouflage. The scorpion's exoskeleton blends into arid environments. If motionless, it can only be seen with a successful Intuition roll, target 4.",
   "Sandveil Vision. The scorpion has multiple eyes, all conditioned for harsh desert storms and blinding sunlight, giving it an additional +1G to Intuition rolls made to search in arid terrain.",
   "Desperate Sting. Add an extra +1G to the scorpion's Venomous Stinger attack if the target has less than 5 Health."
  ],
  "frenzy": [
   {
    "name": "Rapid Molting",
    "event": false,
    "health": 20,
    "text": "The scorpion sheds its damaged exoskeleton, subtracting 2B from its Defense but increasing its Speed from Normal to Fast, allowing it to move up to 2 Short Range distances per 1 Grit."
   }
  ]
 },
 {
  "name": "Dire Wolf Pack",
  "size": "Medium",
  "page": 153,
  "health": 60,
  "defense": "1B",
  "speed": "Fast",
  "skills": {
   "charm": "4G",
   "finesse": "3B",
   "intuition": "3G",
   "nerve": "5B"
  },
  "attacks": [
   {
    "name": "Alpha Bite",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "4G damage"
   },
   {
    "name": "Flanking Claws",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage"
   },
   {
    "name": "Leap and Latch",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "3B damage + Trapped [1]"
   },
   {
    "name": "Chilling Howl",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [1B1G]"
   }
  ],
  "tolerances": "Sweep [1], Afraid [2B], Trapped [1B]",
  "features": [
   "Power of the Pack. Any attacks made at Arm's Reach against the Dire Wolf Pack allow the wolves to make an immediate retaliation. Deal 2B damage to the attacking target with no Grit cost.",
   "Strength in Numbers. When the pack's Health is above 30 (its Frenzy), add +1B to any damage or Status-inflicting rolls. When its Health is 30 or below, subtract -1B or -1G from any damage or Statusinflicting rolls."
  ],
  "frenzy": [
   {
    "name": "Fearsome Pack",
    "event": false,
    "health": 30,
    "text": "The Dire Wolf pack now inflicts Afraid [1] with each damage-dealing attack."
   }
  ]
 },
 {
  "name": "Dusting Moth",
  "size": "Medium",
  "page": 153,
  "health": 42,
  "defense": "-",
  "speed": "Normal",
  "skills": {
   "charm": "2B1G",
   "finesse": "4B",
   "intuition": "3B",
   "nerve": "2B"
  },
  "attacks": [
   {
    "name": "Needle Tongue",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "1G damage + Trapped [2]"
   },
   {
    "name": "Feeding Time",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage"
   },
   {
    "name": "Moth Dust",
    "grit": 3,
    "range": "Short",
    "aoe": true,
    "effect": "Status [2B]"
   },
   {
    "name": "Dusting Dive",
    "grit": 3,
    "range": "Long",
    "aoe": false,
    "effect": "2G"
   }
  ],
  "tolerances": "Sweep [1], Afraid [1B], Poisoned [2G], Unconscious [2B]",
  "features": [
   "Drawn to Light. If a flashlight, campfire, or other light source is within Short Range of the moth, it becomes distracted. Any Skill rolls are made with one less die.",
   "Dust Selection. When using its Moth Dust attack, the moth may choose to inflict one of the following four Statuses: Poisoned, Dazed, Trapped, or Unconscious [2B].",
   "Gift of Flight. The moth gets one free Move Action per turn. No Grit cost needed."
  ],
  "frenzy": [
   {
    "name": "Dust Storm",
    "event": true,
    "health": 25,
    "text": "The moth flies around in a frenzy above the players' heads. Its Moth Dust attack now targets anyone within Long Range, and grants one free attack to be used immediately."
   }
  ]
 },
 {
  "name": "Feral Hog Cyclops",
  "size": "Medium",
  "page": 154,
  "health": 45,
  "defense": "2B",
  "speed": "Normal",
  "skills": {
   "charm": "4B",
   "finesse": "2B",
   "intuition": "1B1G",
   "nerve": "5G"
  },
  "attacks": [
   {
    "name": "Razor Tusks",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage"
   },
   {
    "name": "Goring Charge",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "5B damage"
   },
   {
    "name": "Root and Toss",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Trapped [1]"
   },
   {
    "name": "Display of Aggression",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [2B]"
   }
  ],
  "tolerances": "Sweep [1], Afraid [2B], Burned [2B], Poisoned [1B], Trapped [1B]",
  "features": [
   "Overturn Earth. The hog can spend 4 Grit to overturn the dirt, rocks, and other surroundings to create Rough Terrain in a Short Range radius around it.",
   "Wild Boar. Add +1G to the hog's Goring Charge attack for each consecutive Move Action taken before the attack.",
   "Burning Temper. During the hog's Frenzy, it can add the Bang! property to all attacks during a single turn."
  ],
  "frenzy": [
   {
    "name": "Hogwild",
    "event": false,
    "health": 18,
    "text": "The hog's temper increases as its scraggly red hair catches fire, nostrils exhale black smoke, and its one eye becomes hyper focused on its targets. The hog gains 2 free Move Actions per turn and each of its melee attacks also inflict Burned [1]."
   }
  ]
 },
 {
  "name": "Firefox",
  "size": "Small",
  "page": 156,
  "health": 16,
  "defense": "1B",
  "speed": "Normal",
  "skills": {
   "charm": "2B",
   "finesse": "3G",
   "intuition": "3B",
   "nerve": "1B1G"
  },
  "attacks": [
   {
    "name": "Searing Bite",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage + Burned [1]"
   },
   {
    "name": "Ember Spray",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "Burned [3]"
   }
  ],
  "tolerances": "Burned [Immune]",
  "features": [
   "Control Flames. The Firefox can extinguish and reignite the flames on its tail. When stalking prey or hiding, it will extinguish its tail until ready to attack.",
   "Fire Barrier. Spending 4 Grit, the Firefox can create a line or circle barrier of fire for two rounds at Short Range. Any creature passing through the fire is Burned [1B].",
   "Burning Balm. The Firefox gains 1G Health if it ends its turn standing in an actively burning fire.",
   "Soaked Fur. If drenched with water, the Firefox must spend 2 Grit to reignite its flaming fur before its attacks can Burn again."
  ],
  "frenzy": [
   {
    "name": "Wildfire",
    "event": true,
    "health": 8,
    "text": "The Firefox combusts entirely into a flaming frenzy of chaos. Each enemy within Short Range is Burned [3B]. Additionally, the Firefox's Defense increases to 2B."
   }
  ]
 },
 {
  "name": "Giant Centipede",
  "size": "Medium",
  "page": 156,
  "health": 23,
  "defense": "2B",
  "speed": "Normal",
  "skills": {
   "charm": "2B",
   "finesse": "3B",
   "intuition": "3B",
   "nerve": "4B"
  },
  "attacks": [
   {
    "name": "Forcipules",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2B damage + Poisoned [2]"
   },
   {
    "name": "Grapple Prey",
    "grit": 1,
    "range": "Melee",
    "aoe": false,
    "effect": "Trapped [1B]"
   },
   {
    "name": "Carapace Slam",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "3B damage"
   }
  ],
  "tolerances": "Sweep [1], Burned [-1B], Poisoned [2B], Trapped [1B]",
  "features": [
   "Creepy Crawly. The centipede isn't considered Fast, however, it can move multiple sections of its body at once. For example, the front half and the back half. Doing so doesn't require more Grit to take the Move Action.",
   "Burrower. The centipede may use a Move Action to travel through the earth as if it were Rough Terrain (double Grit cost). While underground, it cannot be the target of an attack made above ground."
  ],
  "frenzy": [
   {
    "name": "Paralysis",
    "event": false,
    "health": 12,
    "text": "When using its Forcipules attack to inject venom into its prey, the centipede inflicts Trapped [2] in addition to the Poisoned Status."
   }
  ]
 },
 {
  "name": "Golden Bear",
  "size": "Large",
  "page": 157,
  "health": 79,
  "defense": "1B1G",
  "speed": "Normal",
  "skills": {
   "charm": "5B",
   "finesse": "1B2G",
   "intuition": "2G",
   "nerve": "6G"
  },
  "attacks": [
   {
    "name": "Maul",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "6B damage + Dazed [2]"
   },
   {
    "name": "Bite of the Bruin",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage"
   },
   {
    "name": "Deafening Roar",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "2B damage + Afraid [2]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [2G], Burned [1B], Trapped [2B]",
  "features": [
   "Watchful Eyes. The Golden Bear knows most of the goings on in its territory. This knowledge allows it to never be the target of a surprise attack before combat begins, forcing the attackers to roll with Finesse to determine turn order as normal.",
   "Leveling Tackle. After making a successful Bite of the Bruin attack, the bear can spend 1 extra Grit to knock the target to the ground, regardless of size.",
   "Unrelenting Beatdown. If the bear reduces a target's Health to 6 or lower when using its Maul attack, it also inflicts Unconscious [1]."
  ],
  "frenzy": [
   {
    "name": "Full Sovereignty",
    "event": false,
    "health": 35,
    "text": "The bear becomes Immune to the Afraid, Dazed, and Unconscious Statuses. Additionally, the Bear's Sweep Tolerance increases to 4."
   }
  ]
 },
 {
  "name": "Grand Canyon Tarantula",
  "size": "Huge",
  "page": 157,
  "health": 96,
  "defense": "2B",
  "speed": "Normal",
  "skills": {
   "charm": "5B",
   "finesse": "3B",
   "intuition": "4G",
   "nerve": "5B"
  },
  "attacks": [
   {
    "name": "Piercing Fangs",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage + Poisoned [2] + Piercing [2]"
   },
   {
    "name": "Hairy Leg Sweep",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "6B damage"
   },
   {
    "name": "Corrosive Venom",
    "grit": 4,
    "range": "Long",
    "aoe": false,
    "effect": "6B damage + Poisoned [3]"
   },
   {
    "name": "Explosive Pounce",
    "grit": 3,
    "range": "Long",
    "aoe": false,
    "effect": "4B damage + Trapped [3]"
   }
  ],
  "tolerances": "Sweep [3], Afraid [2B], Poisoned [3B], Trapped [2B]",
  "features": [
   "Chasm Skitter. The tarantula can walk with ease on vertical surfaces and cavern ceilings. Twice per day, it can disappear down a slot canyon and reappear behind a target within Long Range. No Move Action required.",
   "Metal Corrosion. If the tarantula's Corrosive Venom attack deals 5 or more damage to a mech, it also reduces that mech's Defense by 1B.",
   "Subtle Vibrations. The tarantula is able to detect subtle vibrations in the ground and react at lightning speeds. When the Tarantula is the target of a Short Range attack, it can roll with an additional +1B for Defense."
  ],
  "frenzy": [
   {
    "name": "Forced Deceleration",
    "event": false,
    "health": 50,
    "text": "Any targets that have been Poisoned and still have its Lasting Effect applied now feel the poison attacking their nervous system. These targets move at a Very Slow speed when taking the Move Action."
   }
  ]
 },
 {
  "name": "Great Golden Elk",
  "size": "Large",
  "page": 158,
  "health": 72,
  "defense": "1G",
  "speed": "Fast",
  "skills": {
   "charm": "2G",
   "finesse": "5B",
   "intuition": "5B",
   "nerve": "2B2G"
  },
  "attacks": [
   {
    "name": "Golden Antlers",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage"
   },
   {
    "name": "Blink Dash",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "5B2G damage"
   },
   {
    "name": "Blinding Flash",
    "grit": 2,
    "range": "Long",
    "aoe": true,
    "effect": "Dazed [1G]"
   }
  ],
  "tolerances": "Sweep [1], Trapped [2B], Unconscious [1B]",
  "features": [
   "Quiet and Concealed. To successfully track down the Golden Elk, a player must get a 6 or higher on their Intuition roll. Otherwise, they may only find evidences of its existence.",
   "Metallic Sheen. The Golden Elk may choose to inflict Dazed [1B] on its attacker instead of rolling its 1G Defense.",
   "A Sight to Behold. Any ranged attacks made against the Golden Elk are done with less accuracy. The attacker must use Black dice in place of any Gold dice."
  ],
  "frenzy": [
   {
    "name": "Elusive Elk",
    "event": false,
    "health": 25,
    "text": "The Golden Elk fears for its life and attempts to escape in the blink on an eye. Spend 4 Grit and roll 1B. If a Hit or Ace is rolled. The elk escapes from the encounter."
   }
  ]
 },
 {
  "name": "Great Horned Owl",
  "size": "Medium",
  "page": 158,
  "health": 50,
  "defense": "1G",
  "speed": "Fast",
  "skills": {
   "charm": "4B",
   "finesse": "3B",
   "intuition": "5G",
   "nerve": "2B1G"
  },
  "attacks": [
   {
    "name": "Talon Air Strike",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "3B damage + Trapped [3]"
   },
   {
    "name": "Antler Skewer",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage"
   },
   {
    "name": "Tempestuous Wings",
    "grit": 2,
    "range": "Short",
    "aoe": true,
    "effect": "Dazed [1G]"
   },
   {
    "name": "Intimidating Wingspan",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [1B1G]"
   }
  ],
  "tolerances": "Sweep [1], Afraid [1B], Trapped [1G]",
  "features": [
   "Silent Stalker. When flying, the owl is completely silent, allowing it to sneak up on its prey. Add +2B to Finesse rolls made to determine the turn order.",
   "Ancient Gaze. Spending 4 Grit, the owl uses its majestic presence to draw in its prey. Anyone within Long Range, moves one Short Range distance closer to the monster.",
   "Nocturnal Hunter. If fighting the owl at night, any of its attacks using Black dice are instead rolled with Gold.",
   "Gift of Flight. The owl gets one free Move Action per turn when flying in the air. No Grit cost needed."
  ],
  "frenzy": [
   {
    "name": "Sky Bomb",
    "event": true,
    "health": 20,
    "text": "The owl takes to the skies returning in a downward spiral attack. It swoops after two targets within Short Range of each other, bypassing any Dodge actions. The attack deals 4G damage to each of the targets before returning to the sky."
   }
  ]
 },
 {
  "name": "Horned Lizard",
  "size": "Large",
  "page": 160,
  "health": 54,
  "defense": "3B",
  "speed": "Normal",
  "skills": {
   "charm": "3G",
   "finesse": "3B",
   "intuition": "3B",
   "nerve": "2B2G"
  },
  "attacks": [
   {
    "name": "Swallow Prey",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage + Trapped [3]"
   },
   {
    "name": "Spiked Body Slam",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "6G damage"
   },
   {
    "name": "Tongue Lash",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "4B damage"
   },
   {
    "name": "Bloodshot Eyes",
    "grit": 4,
    "range": "Long",
    "aoe": false,
    "effect": "5B damage + Poisoned [3]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [1G], Poisoned [2B], Trapped [1B]",
  "features": [
   "Toxic Circulation. Each time the lizard makes a successful Bloodshot Eyes attack, it gains an additional +1B for its next Bloodshot Eyes attack.",
   "Environmental Camouflage. The lizard's rocky hide blends into arid environments. If motionless, it can only be seen with a successful Intuition roll, target 5.",
   "Spiked Skin. Melee Attacks made against the lizard within Arm's Reach trigger a unique reaction of self-preservation. After such an attack is made, roll 2B. The attacker takes damage equal to the number of Hits."
  ],
  "frenzy": [
   {
    "name": "Blood Boil",
    "event": false,
    "health": 38,
    "text": "The Horned Lizard's blood pressure spikes and its Sweep Tolerance increases by 2. Additionally, its Bloodshot Eyes attack now also inflicts Burned [1]."
   }
  ]
 },
 {
  "name": "Hundred-Year Hydra",
  "size": "Titan",
  "page": 160,
  "health": 125,
  "defense": "4B",
  "speed": "Normal",
  "skills": {
   "charm": "7G",
   "finesse": "4G",
   "intuition": "4G",
   "nerve": "4B4G"
  },
  "attacks": [
   {
    "name": "Obliterate",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "6B6G damage"
   },
   {
    "name": "Dragon's Breath",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "2B2G damage + Status [2]"
   },
   {
    "name": "Tail Skewer",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "6B damage"
   },
   {
    "name": "Elemental Spray",
    "grit": 2,
    "range": "Long",
    "aoe": true,
    "effect": "3B damage + Status [1]"
   }
  ],
  "tolerances": "Sweep [4], Afraid [Immune], Burned [2B], Dazed [1B], Electrocuted [1B], Poisoned [2B], Trapped [Immune], Unconscious [1B]",
  "features": [
   "Five Heads. When using its Dragon's Breath or Elemental Spray attacks, pick one of the following five Statuses to inflict: Burned, Dazed, Trapped, Afraid, or Poisoned.",
   "Legendary Tales. Any target within sight of the hydra immediately recalls tales they've heard of such a beast. Each of these targets starts the combat encounter with Afraid [6G].",
   "Dino Descendent. As a descendant of longliving reptiles, twice per day, the hydra may choose to ignore any damage or Statuses inflicted from a single attack."
  ],
  "frenzy": [
   {
    "name": "The Dark Lair",
    "event": true,
    "health": 80,
    "text": "The hydra uses its weight to collapse the battlefield, dropping itself and its targets deep underground into The Dark. Here, the Hydra doesn't feel the effects of a Forstall and all attacks made against it are rolled with one less die."
   },
   {
    "name": "Double or Nothing",
    "event": false,
    "health": 30,
    "text": "The hydra loses one of its heads in the skirmish, but two more emerge in its place. Now all of its attacks cost one less Grit."
   }
  ]
 },
 {
  "name": "Invasive Woodpecker",
  "size": "Small",
  "page": 161,
  "health": 25,
  "defense": "-",
  "speed": "Normal",
  "skills": {
   "charm": "1B1G",
   "finesse": "1B2G",
   "intuition": "3B",
   "nerve": "1B1G"
  },
  "attacks": [
   {
    "name": "Power Drill",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "1G damage + Piercing [1]"
   },
   {
    "name": "Talon Strike",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2B damage"
   },
   {
    "name": "Bristle Crest",
    "grit": 3,
    "range": "Short",
    "aoe": true,
    "effect": "Dazed [1G]"
   },
   {
    "name": "Daring Swoop",
    "grit": 4,
    "range": "Long",
    "aoe": false,
    "effect": "2B damage + Dazed [2]"
   }
  ],
  "tolerances": "Dazed [2B]",
  "features": [
   "Destructive Nature. Only the first Power Drill attack in each turn costs 2 Grit. Any additional Power Drill attacks in the same turn cost 1 Grit.",
   "Percussive Blast. Spending 3 Grit, the woodpecker can hammer vibrations through the ground, knocking any target down within Long Range.",
   "Gift of Flight. The woodpecker gets one free Move Action per turn when flying in the air. No Grit cost needed."
  ],
  "frenzy": [
   {
    "name": "Jackhammer",
    "event": false,
    "health": 12,
    "text": "The Woodpecker's Power Drill attack now does Piercing [3] and it gains +1B to its Defense."
   }
  ]
 },
 {
  "name": "King Cottonmouth",
  "size": "Huge",
  "page": 163,
  "health": 102,
  "defense": "1B2G",
  "speed": "Normal",
  "skills": {
   "charm": "5G",
   "finesse": "4B",
   "intuition": "3B",
   "nerve": "2B5G"
  },
  "attacks": [
   {
    "name": "Viper Fangs",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage + Dazed[1] + Poisoned[1] + Trapped[1]"
   },
   {
    "name": "Lockjaw",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "8B damage + Trapped [3]"
   },
   {
    "name": "Coiled Strike",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "3B3G damage + Dazed[1] + Poisoned[1] + Trapped[1]"
   },
   {
    "name": "Poisonous Mists",
    "grit": 3,
    "range": "Short",
    "aoe": true,
    "effect": "Poisoned [5B]"
   },
   {
    "name": "Cottonmouth Grin",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [4B]"
   },
   {
    "name": "Venom Spit",
    "grit": 4,
    "range": "Long",
    "aoe": false,
    "effect": "3B3G damage + Poisoned[1] + Trapped[1] + Dazed[1]"
   }
  ],
  "tolerances": "Sweep [3], Afraid [Immune], Poisoned [Immune], Trapped [3G]",
  "features": [
   "Wound Up. Ready to strike first, the cottonmouth gains +3G to Finesse rolls made to determine turn order.",
   "Territorial Defender. When fighting in water, the cottonmouth gains a Tolerance to the Burned Status equal to [2B], and its movement speed increases to Fast.",
   "Heat Sensing Pit. The cottonmouth's sight is not affected by darkness, due to its sensory organs that detect warm-blooded prey. It also gains +2B to Intuition rolls made to track or search in darkness."
  ],
  "frenzy": [
   {
    "name": "Venom's Crown",
    "event": false,
    "health": 45,
    "text": "If an attack that would inflict the Poisoned Status is made against a target that is already Poisoned, the Status Severity increases as normal, but they also gain Burned [1]."
   }
  ]
 },
 {
  "name": "Lake Guardian Moose",
  "size": "Large",
  "page": 163,
  "health": 61,
  "defense": "1G",
  "speed": "Normal",
  "skills": {
   "charm": "2B2G",
   "finesse": "3B",
   "intuition": "6G",
   "nerve": "3B"
  },
  "attacks": [
   {
    "name": "Drown Victim",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "5B damage + Unconscious [2]"
   },
   {
    "name": "Wistful Thrash",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage"
   },
   {
    "name": "Guardian Gaze",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "2G damage + Afraid [1]"
   },
   {
    "name": "Existential Gravity",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Dazed [2B]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [Immune], Burned [1G], Electrocuted [-1B], Unconscious [2B]",
  "features": [
   "Hypnotizing Presence. When the moose's Existential Gravity attack rolls at least 1 Hit, the affected players are not only Dazed but are pacified by the monster's majesty. They are immediately drawn closer to it by one Short Range distance, even if they are currently Afraid.",
   "Feared Cryptid. Targets take Afraid [1] at the start of each turn if within Short Range of the moose. If they are already Afraid, add +1 to the Status Severity.",
   "Mystic Dodge. Twice per day, the moose may choose to Dodge one attack completely and mysteriously. This may be decided after the damage is rolled."
  ],
  "frenzy": [
   {
    "name": "Summon Wildlife",
    "event": true,
    "health": 30,
    "text": "The wildlife around the lake answers to the moose's silent call. Any targets within Long Range are overwhelmed, dropping their maximum Grit to 3 for two rounds of combat."
   }
  ]
 },
 {
  "name": "Latcher",
  "size": "Tiny",
  "page": 164,
  "health": 3,
  "defense": "-",
  "speed": "Slow",
  "skills": {
   "charm": "1B",
   "finesse": "2B",
   "intuition": "1B",
   "nerve": "1B"
  },
  "attacks": [
   {
    "name": "Latch",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "1B damage"
   },
   {
    "name": "Inject Bacteria",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "1G damage + Poisoned [1]"
   }
  ],
  "tolerances": "None",
  "features": [
   "Blood is Life. For every Ace rolled on an attack, the Latcher gains one Health up to a temporary maximum of 5 Health.",
   "Long Jumper. The Latcher moves by jumping near-silently up to Short Range instead of crawling slowly from sagebrush to sagebrush.",
   "Detached Head. If the Latcher is pulled out of the skin with a successful Nerve roll, target 2, its body will dislodge freely, but its head will remain inside. To pull the head out, it can be done without a roll but will deal another 1B damage to the player during removal."
  ],
  "frenzy": [
   {
    "name": "Little Latchers",
    "event": true,
    "health": 1,
    "text": "If reduced to 1 Health but not killed, roll 1B. For each Hit, the Latcher lays one egg under the skin. The wound will fester as the eggs hatch into larvae roughly one day later. A fully grown Latcher will emerge from the same wound in about 24 hours if not removed beforehand."
   }
  ]
 },
 {
  "name": "Lightning Bug",
  "size": "Tiny",
  "page": 164,
  "health": 6,
  "defense": "1B",
  "speed": "Normal",
  "skills": {
   "charm": "2B",
   "finesse": "2B",
   "intuition": "2B",
   "nerve": "1B"
  },
  "attacks": [
   {
    "name": "Spark Bite",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "1G damage + Electrocuted [1]"
   },
   {
    "name": "Electric Arc",
    "grit": 4,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Electrocuted [1]"
   },
   {
    "name": "Blinding Glow",
    "grit": 4,
    "range": "Short",
    "aoe": true,
    "effect": "Dazed [2B]"
   }
  ],
  "tolerances": "Electrocuted [Immune]",
  "features": [
   "Shocking Defense. If the Lightning Bug is attacked at Arm's Reach with a conductive material, the Bug will take the damage but immediately inflict the Electrocuted [1B] Status on the attacker.",
   "Short Circuit. When the Lightning Bug drops to 0 Health, it explodes like a shortcircuited battery. Each target within Short Range takes 1G damage + Electrocuted [1].",
   "Gift of Flight. The Lightning Bug gets one free Move Action per turn when flying in the air. No Grit cost needed."
  ],
  "frenzy": [
   {
    "name": "Shock Dash",
    "event": false,
    "health": 2,
    "text": "A new Long Range attack costing 4 Grit where the Lightning Bug charges up its electrical ions and bolts towards an opponent in the blink of an eye and with a thunderous crack. It deals 2G damage plus Electrocuted [3], then zips back to where it was initially."
   }
  ]
 },
 {
  "name": "Livewire Mudcat",
  "size": "Medium",
  "page": 166,
  "health": 41,
  "defense": "1G",
  "speed": "Normal",
  "skills": {
   "charm": "3B",
   "finesse": "2B",
   "intuition": "3B",
   "nerve": "4G"
  },
  "attacks": [
   {
    "name": "Inhale Prey",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "Trapped [4B]"
   },
   {
    "name": "Whisker Jolt",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "3B damage + Electrocuted [2]"
   },
   {
    "name": "Tail Slap",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage"
   },
   {
    "name": "Electric Pulse",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "1G damage + Electrocuted [1]"
   },
   {
    "name": "Water Blast",
    "grit": 2,
    "range": "Long",
    "aoe": false,
    "effect": "2B damage"
   }
  ],
  "tolerances": "Sweep [1], Burned [2B], Electrocuted [Immune]",
  "features": [
   "High Voltage. Twice per day, the Mudcat may choose to inflict an additional +2 to the Electrocuted Status caused by one of its attacks.",
   "Swallow. Once a target is Trapped from the Inhale Prey attack, they must free themselves before the end of their next turn. Otherwise, they are swallowed and Captured (unable to take any actions). They lose 3 Health on every following turn until freed or dead."
  ],
  "frenzy": [
   {
    "name": "Lightning Burst",
    "event": true,
    "health": 20,
    "text": "Electricity charges up to dangerous levels, releasing scattered lightning. Any target within Long Range takes 2G damage + Electrocuted [3]."
   }
  ]
 },
 {
  "name": "Lumberjack Mouse",
  "size": "Tiny",
  "page": 166,
  "health": 7,
  "defense": "-",
  "speed": "Normal",
  "skills": {
   "charm": "1B",
   "finesse": "3G",
   "intuition": "2G",
   "nerve": "1G"
  },
  "attacks": [
   {
    "name": "Sawtooth",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage"
   },
   {
    "name": "Scratch",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "1B damage"
   },
   {
    "name": "Dash and Gnash",
    "grit": 4,
    "range": "Short",
    "aoe": false,
    "effect": "1B damage"
   }
  ],
  "tolerances": "None",
  "features": [
   "Make a Hole. A Lumberjack Mouse can easily make its way through wood objects like doors, floors, and barricades, but this is Rough Terrain for the mouse.",
   "Sawdust Plume. Once per day, the mouse may choose to shake out its sawdustcovered fur to create a plume of dust in a Short Range radius around it. This grants the mouse Light Cover for one round but doesn't grant any players cover. No Grit cost is required to use this ability."
  ],
  "frenzy": [
   {
    "name": "Structural Failure",
    "event": true,
    "health": 3,
    "text": "The Lumberjack Mouse finds the nearest wooden tree or post, chews through it, and positions the object to fall on top of the closest target. That target takes 2B damage + Trapped [2]. The target must be within Short Range to be affected."
   }
  ]
 },
 {
  "name": "Lurking Moss",
  "size": "Medium",
  "page": 167,
  "health": 30,
  "defense": "-",
  "speed": "Slow",
  "skills": {
   "charm": "3B",
   "finesse": "2B1G",
   "intuition": "2B",
   "nerve": "2B"
  },
  "attacks": [
   {
    "name": "Smother",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "3B damage + Trapped [3]"
   },
   {
    "name": "Nettle Whip",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Poisoned [1]"
   },
   {
    "name": "Moss-Rock Sling",
    "grit": 3,
    "range": "Long",
    "aoe": false,
    "effect": "2B damage"
   }
  ],
  "tolerances": "Burned [-1B], Electrocuted [2B], Poisoned [1G], Trapped [1B]",
  "features": [
   "Hidden Snares. Using what nature has provided, the Lurking Moss has prepared up to three traps around its hiding place. When another player takes the Move Action, you may choose to roll 1B. On a Hit or an Ace a well-camouflaged 2B trap is triggered inflicting the Trapped Stats equal to the total number of Hits rolled.",
   "Shape Shifter. The Lurking Moss doesn't have one single form. It can arrange itself to look like thick moss on a tree, log, rock, or other object, making it Very Difficult (target 5) to find.",
   "Damp or Dry. If the Lurking Moss is in a wet environment, it has a 2B tolerance when rolling off the Burned stats. Otherwise, it remains a -1B."
  ],
  "frenzy": [
   {
    "name": "Overgrowth",
    "event": false,
    "health": 12,
    "text": "The Lurking Moss doubles in size as it collects branches, leaves, and grass from its environment (now a Large monster). It increases its Defense by +1G, Sweep Tolerance by 1, and all attacks by 1G."
   }
  ]
 },
 {
  "name": "Mississippi Lobster",
  "size": "Huge",
  "page": 167,
  "health": 77,
  "defense": "4G",
  "speed": "Normal",
  "skills": {
   "charm": "2B2G",
   "finesse": "2B",
   "intuition": "3B",
   "nerve": "3B3G"
  },
  "attacks": [
   {
    "name": "Cutter Claw",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage"
   },
   {
    "name": "Crusher Claw",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "4B4G damage + Dazed [2]"
   },
   {
    "name": "Mud Fling",
    "grit": 3,
    "range": "Short",
    "aoe": true,
    "effect": "Trapped [3B]"
   },
   {
    "name": "Claw Bash",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [2B]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [2B], Burned [3B]",
  "features": [
   "Regenerative Health. If the lobster takes 12 or more damage during a single round, roll 4B at the start of its turn. The lobster regains Health equal to the number of Hits rolled.",
   "Blue Blooded. If successfully attacked at Arm's Reach, the lobster's alien-like blue blood will spill out on the attacker, inflicting Poisoned [2B].",
   "Boats Beware. The lobster is attracted to the sounds of boats on the water and its appetite grows. It gains one free Move Action per turn while in water."
  ],
  "frenzy": [
   {
    "name": "King Claw",
    "event": false,
    "health": 25,
    "text": "The lobster's Crusher Claw grows noticeably bigger. It now deals 4B6G damage + Dazed [4] while the Grit cost remains at 4."
   }
  ]
 },
 {
  "name": "North American Anaconda",
  "size": "Large",
  "page": 169,
  "health": 72,
  "defense": "2B1G",
  "speed": "Normal",
  "skills": {
   "charm": "2B",
   "finesse": "1B2G",
   "intuition": "2B",
   "nerve": "5G"
  },
  "attacks": [
   {
    "name": "Unhinged Jaw",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2B2G damage + Trapped [3]"
   },
   {
    "name": "Max Constrict",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "Trapped [8G]"
   },
   {
    "name": "Ambush Strike",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "4G damage"
   },
   {
    "name": "Hammer Tail",
    "grit": 4,
    "range": "Short",
    "aoe": false,
    "effect": "5B damage + Dazed [3]"
   },
   {
    "name": "Warning Glare",
    "grit": 1,
    "range": "Long",
    "aoe": false,
    "effect": "Afraid [2B]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [2B], Poisoned [1B], Trapped [2G]",
  "features": [
   "Ambush Predator. If the anaconda begins combat while hidden, its first attack gains +2G.",
   "Dragged Under. When in water or mud, the anaconda can pull any one Trapped target under the surface. If underwater for 2 consecutive rounds, the target gains Unconscious [3].",
   "Slithering Escape. Twice per day, the anaconda can choose to avoid a Prepared Attack Action made against it."
  ],
  "frenzy": [
   {
    "name": "Death Coil",
    "event": false,
    "health": 40,
    "text": "If the anaconda starts its turn with a target still Trapped by a previous attack, it envelops the target within its tense body and squeezes its life away, dealing 8G damage (4 Grit)."
   }
  ]
 },
 {
  "name": "Opossum",
  "size": "Medium",
  "page": 169,
  "health": 33,
  "defense": "1B",
  "speed": "Normal",
  "skills": {
   "charm": "2B",
   "finesse": "2B1G",
   "intuition": "3B",
   "nerve": "2B2G"
  },
  "attacks": [
   {
    "name": "Opposable Claws",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage"
   },
   {
    "name": "Prehensile Tail",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "Trapped [3B]"
   },
   {
    "name": "Tail Whip",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "3B damage"
   },
   {
    "name": "Garbage Toss",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Dazed [1]"
   },
   {
    "name": "Frightful Hiss",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [2B]"
   }
  ],
  "tolerances": "Sweep [1], Poisoned [2B], Trapped [1B], Unconscious [1B]",
  "features": [
   "Unforgiving Squeeze. If a creature is still Trapped from the Prehensile Tail attack by the end of its next turn, the opossum may spend 3 Grit to squeeze the victim dealing 3G damage instead of Trapped [3G].",
   "Rabid Rodent. If at least one Hit is rolled on an attack, the opossum can choose to spend an additional 1 Grit to inflict Poisoned [1] on the target.",
   "Tail Whip Strip. If the opossum deals 3 or more damage when using its Tail Whip attack, it also strips away the target's weapon in hand, throwing it to the ground."
  ],
  "frenzy": [
   {
    "name": "Playing Dead",
    "event": true,
    "health": 12,
    "text": "The opossum falls to the ground \"dead\". Only a target 5 Intuition roll would reveal that it's still somehow alive. When the moment is right, the opossum jolts up and attacks the nearest player within Long Range dealing 6G damage in a fury of Opposable Claw attacks. During this round, the opossum only takes half the damage from any skeptical Prepared attacks made against it."
   }
  ]
 },
 {
  "name": "Ozark Howler",
  "size": "Medium",
  "page": 170,
  "health": 36,
  "defense": "2B",
  "speed": "Normal",
  "skills": {
   "charm": "4G",
   "finesse": "3B",
   "intuition": "3B",
   "nerve": "4G"
  },
  "attacks": [
   {
    "name": "Pinning Horns",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage + Trapped [1]"
   },
   {
    "name": "Rearing Stomp",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2B damage"
   },
   {
    "name": "Unearthly Howl",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "1B damage + Afraid [2]"
   }
  ],
  "tolerances": "Sweep [1], Afraid [1G], Trapped [2B]",
  "features": [
   "Cover of Night. The Howler gains an additional +1B to Dodge Actions taken between the hours of dusk and dawn.",
   "Thick-Hide Bruiser. Once per round of combat when it is the target of an attack, the Howler can force its attacker to convert a single Ace from the roll into a Spur. If the attacker has the weapon's Talent unlocked, they may reroll."
  ],
  "frenzy": [
   {
    "name": "Charge from the Shadows",
    "event": false,
    "health": 20,
    "text": "If it takes at least 1 Move Action before using its Pinning Horns attack, the Howler can charge toward its target. Roll 4G and capture the target in its horns, inflicting damage and the Trapped Status equal to the number of Hits."
   }
  ]
 },
 {
  "name": "Plains Shepherd Bison",
  "size": "Large",
  "page": 170,
  "health": 81,
  "defense": "2G",
  "speed": "Normal",
  "skills": {
   "charm": "5G",
   "finesse": "2B",
   "intuition": "1B2G",
   "nerve": "6G"
  },
  "attacks": [
   {
    "name": "Merciless Stomp",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage + Dazed [1]"
   },
   {
    "name": "Bullrush",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "6G damage"
   },
   {
    "name": "Caber Toss",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "3B damage"
   },
   {
    "name": "Shepherd's Warning",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [3B]"
   }
  ],
  "tolerances": "Sweep [3], Afraid [Immune], Dazed [2B], Trapped [2G]",
  "features": [
   "Earthshaker. Once per day the Shepherd can jump up and slam into the ground. The earth crumbles, creating Rough Terrain in a Long Range radius. Any creatures within that radius are knocked down.",
   "Retribution. If a player takes damage from the Shepherd while in its Frenzy, the player subtracts -1B (or -1G if no Black dice are available) from their Nerve skill pool until they're able to sleep it off.",
   "Full Steam Ahead. If the Shepherd takes 2 or more consecutive Move Actions in a straight line, its speed increases to Fast after the first Move Action. This also inflicts Dazed [2] on the target if successfully attacked."
  ],
  "frenzy": [
   {
    "name": "Train Plow",
    "event": false,
    "health": 40,
    "text": "Increase the Shepherd's Grit by +1 per turn while in its Frenzy. When the Shepherd uses its Bullrush attack, roll with an additional +2G. If any Aces are rolled while attacking a mech, the Shepherd topples it, regardless of its class."
   }
  ]
 },
 {
  "name": "Pondweed Peril",
  "size": "Medium",
  "page": 172,
  "health": 34,
  "defense": "1B",
  "speed": "Normal",
  "skills": {
   "charm": "3B",
   "finesse": "4G",
   "intuition": "2B1G",
   "nerve": "3G"
  },
  "attacks": [
   {
    "name": "Strangle",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage + Trapped [4]"
   },
   {
    "name": "Peck",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2B damage"
   },
   {
    "name": "Weed Whip",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "2B1G damage"
   },
   {
    "name": "Screech",
    "grit": 4,
    "range": "Long",
    "aoe": true,
    "effect": "Dazed [2B]"
   }
  ],
  "tolerances": "Sweep [1], Burned [1G], Electrocuted [-2B], Poisoned [2B], Trapped [2G]",
  "features": [
   "Perfect Camouflage. When it’s motionless, the Peril is indistinguishable from any ordinary spread of aquatic plants growing in the water.",
   "Water Shelter. When submerged completely in water, it rolls 3G for defense, unless being targeted by a harpoon or other spear-like object. It’s also immune to Forstall sweeps while completely submerged.",
   "Water Dependant. The Peril can live outside of a water source for up to 2 hours before needing to rehydrate. Otherwise, it falls in exhaustion and dries up completely, slowly dying in the process."
  ],
  "frenzy": [
   {
    "name": "Lake Sludge",
    "event": false,
    "health": 18,
    "text": "Spending 4 Grit, the Peril dives to the bottom of the lake, covers itself in decomposing sludge, and flings it off in all directions. Any target within Short Range becomes Trapped [4B] in thick mud. The Peril's Defense increases by +1B and it no longer has a -1B when relieving the Electrocuted Status."
   }
  ]
 },
 {
  "name": "Prairie Wolf",
  "size": "Small",
  "page": 172,
  "health": 8,
  "defense": "-",
  "speed": "Normal",
  "skills": {
   "charm": "2B",
   "finesse": "3B",
   "intuition": "1B2G",
   "nerve": "1B1G"
  },
  "attacks": [
   {
    "name": "Buckteeth",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2B damage"
   },
   {
    "name": "Pit Trap",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "Trapped [2B]"
   },
   {
    "name": "Hurl Rock",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "1B damage"
   }
  ],
  "tolerances": "Dazed [1B]",
  "features": [
   "Burrower. The Prairie Wolf may use a Move Action to travel through the earth as if it were Rough Terrain (double Grit cost). While underground, it cannot be the target of an attack made above ground.",
   "Howling Alarm. When one Prairie Wolf detects a threat, they begin to bark and howl to warn other Prairie Wolves to get battle-ready.",
   "Double Team. If a Prairie Wolf attacks a target while another Prairie Wolf is within Arm's Reach, add +1B to the attack."
  ],
  "frenzy": [
   {
    "name": "Mad Burrower",
    "event": true,
    "health": 3,
    "text": "The Prairie Wolf burrows into the ground and uses its Pit Trap attack against up to 3 targets within Short Range of each other. They all take Trapped [3B]. Then it takes its turn."
   }
  ]
 },
 {
  "name": "Queen Condor",
  "size": "Huge",
  "page": 173,
  "health": 95,
  "defense": "2G",
  "speed": "Normal",
  "skills": {
   "charm": "3B",
   "finesse": "2B3G",
   "intuition": "3B",
   "nerve": "4B"
  },
  "attacks": [
   {
    "name": "Titanium Talons",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage + Piercing [3]"
   },
   {
    "name": "Crownbreaker",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "8G damage"
   },
   {
    "name": "Feathered Cyclone",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "5B damage + Knockback"
   },
   {
    "name": "Whirlwinds",
    "grit": 4,
    "range": "Short",
    "aoe": true,
    "effect": "Dazed [2B2G]"
   },
   {
    "name": "Death Spiral",
    "grit": 2,
    "range": "Long",
    "aoe": false,
    "effect": "Afraid [3B]"
   },
   {
    "name": "Drop Boulder",
    "grit": 5,
    "range": "Long",
    "aoe": false,
    "effect": "12G damage"
   }
  ],
  "tolerances": "Sweep [3], Afraid [2B], Trapped [3B]",
  "features": [
   "Buzzard Food. For each character death during the combat encounter, the condor gains 6B6G Health.",
   "Opportunistic Feeder. Twice per day and during another player's turn, the condor can choose to attack once with its Titanium Talons. No Grit cost required.",
   "Wings of Ruin. The condor's Feathered Cyclone attack allows it to move the target anywhere it wants within Short Range of the target's original position.",
   "Gift of Flight. The condor gets one free Move Action per turn when flying in the air. No Grit cost needed."
  ],
  "frenzy": [
   {
    "name": "Carrion Hunter",
    "event": false,
    "health": 40,
    "text": "Successful attacks made on targets that are below half of their Max Health also gain Afraid [1]. Additionally, the condor can take another free Move Action per turn."
   }
  ]
 },
 {
  "name": "Quill Archer",
  "size": "Medium",
  "page": 174,
  "health": 28,
  "defense": "1G",
  "speed": "Normal",
  "skills": {
   "charm": "2B1G",
   "finesse": "2B",
   "intuition": "2B2G",
   "nerve": "2B"
  },
  "attacks": [
   {
    "name": "Gnaw",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2B damage"
   },
   {
    "name": "Quill Thrust",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "4G damage"
   },
   {
    "name": "Quill Javelin",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "1B2G damage"
   },
   {
    "name": "Quill Sniper",
    "grit": 3,
    "range": "Long",
    "aoe": false,
    "effect": "3B damage"
   }
  ],
  "tolerances": "Sweep [1], Afraid [1B]",
  "features": [
   "Tree Climber. The Quill Archer can easily climb trees with its curved claws. +2B to Nerve rolls made to climb.",
   "Barbed Quills. Each quill-based attack leaves the quill lodged in the target's skin. To pull a quill out, the target must spend 1 Grit. Doing so deals 1B damage per quill pulled from the target's body. If the target has two or more quills lodged into their skin, they cannot take the Aim or Dodge Actions until they're removed."
  ],
  "frenzy": [
   {
    "name": "Archer's Volley",
    "event": true,
    "health": 10,
    "text": "The Quill Archer launches a third of its quills into the air. They come raining down in a Short Range radius and anyone within that range takes 3G damage."
   }
  ]
 },
 {
  "name": "Red-Striped Skunk",
  "size": "Small",
  "page": 174,
  "health": 28,
  "defense": "-",
  "speed": "Slow",
  "skills": {
   "charm": "3B",
   "finesse": "2B",
   "intuition": "4G",
   "nerve": "2B"
  },
  "attacks": [
   {
    "name": "Claw Swipe",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "1G damage"
   },
   {
    "name": "Suffocate",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage + Poisoned [2]"
   },
   {
    "name": "Sulfuric Spray",
    "grit": 4,
    "range": "Short",
    "aoe": true,
    "effect": "Dazed [3B]"
   },
   {
    "name": "Acidic Blast",
    "grit": 3,
    "range": "Long",
    "aoe": false,
    "effect": "1B damage + Poisoned [2]"
   }
  ],
  "tolerances": "Dazed [1B], Poisoned [2B]",
  "features": [
   "Dizzying Stench. If an enemy is at Arm's Reach of the skunk, they immediately take the Dazed [1G] Status."
  ],
  "frenzy": [
   {
    "name": "Toxic Stench",
    "event": true,
    "health": 10,
    "text": "Each target within Short Range inhales the skunk's potent fumes and falls to the ground, taking the Unconscious [2B] Status."
   }
  ]
 },
 {
  "name": "Road Runner",
  "size": "Small",
  "page": 177,
  "health": 26,
  "defense": "1G",
  "speed": "Fast",
  "skills": {
   "charm": "1B1G",
   "finesse": "4G",
   "intuition": "1B2G",
   "nerve": "2B"
  },
  "attacks": [
   {
    "name": "Concussion",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "3B damage + Dazed [1]"
   },
   {
    "name": "Striker Talon",
    "grit": 1,
    "range": "Melee",
    "aoe": false,
    "effect": "1B damage"
   },
   {
    "name": "Sand Scoop",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "Dazed [2B]"
   }
  ],
  "tolerances": "Dazed [1B], Trapped [1B]",
  "features": [
   "Targeted Blow. After making a Concussion melee attack, if the attack has 3+ hits, the Road Runner will also inflict Unconscious [1].",
   "High-Speed Stoop. If the Road Runner takes the two or more consecutive Move Actions before making a melee attack against a target, it may add 1G to the melee attack pool for this attack.",
   "Dust Cloud. On its turn, the Road Runner may choose to spend 3 Grit to kick up a cloud of dust in a Short Range radius around it. Doing so grants it Light Cover for 3 rounds before the dust settles. Any humans inside or entering the dust cloud immediately take Dazed [1].",
   "Moving Target. When the Road Runner takes the Dodge Action, add +1B to that roll."
  ],
  "frenzy": [
   {
    "name": "Runner's Rampage",
    "event": false,
    "health": 10,
    "text": "The Grit cost of the Road Runner's Concussion attack is reduced to 3 and it gets one free Move Action."
   }
  ]
 },
 {
  "name": "Sabertooth Mountain Lion",
  "size": "Medium",
  "page": 177,
  "health": 45,
  "defense": "2B",
  "speed": "Fast",
  "skills": {
   "charm": "3B1G",
   "finesse": "2G",
   "intuition": "2B2G",
   "nerve": "5B"
  },
  "attacks": [
   {
    "name": "Dual Fangs",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage + Piercing [1]"
   },
   {
    "name": "Retractable Claws",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2B1G damage"
   },
   {
    "name": "Lion Pounce",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Trapped [2]"
   },
   {
    "name": "Terrifying Roar",
    "grit": 4,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [3B]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [1G], Burned [-1B]",
  "features": [
   "Luring Cries. The lion can make sounds that mimic the screams of a woman or child, and can be heard from miles away.",
   "Silent Stalker. If hidden or camoflauged, the lion may surprise attack its target bypassing any Prepared Actions by those it hunts.",
   "Our Little Secret. When the lion is within Short Range of large flames, it gains Afraid [1]."
  ],
  "frenzy": [
   {
    "name": "Savage Predator",
    "event": false,
    "health": 25,
    "text": "Growing hunger drives its desire to kill injured prey. All attacks now cost one less Grit if the target has Health less than its maximum."
   }
  ]
 },
 {
  "name": "Shasta Skullface",
  "size": "Titan",
  "page": 178,
  "health": 110,
  "defense": "2B",
  "speed": "Very Slow",
  "skills": {
   "charm": "4B",
   "finesse": "1B",
   "intuition": "3B",
   "nerve": "6B1G"
  },
  "attacks": [
   {
    "name": "Deadfall",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "6B3G damage + Trapped [6]"
   },
   {
    "name": "Black Lung Breath",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "6B damage + Unconscious [3]"
   },
   {
    "name": "Burning Plague",
    "grit": 3,
    "range": "Long",
    "aoe": false,
    "effect": "7B damage + Burned [3]"
   }
  ],
  "tolerances": "Sweep [3], Afraid [Immune], Dazed [3B], Poisoned [Immune], Trapped [Immune]",
  "features": [
   "Sickening Stench. Any creature within Long Range becomes overwhelmed by the mind-deadening odor, taking Poisoned [2] and Dazed [2] at the start of each of their turns. Those within Short Range also take Trapped [2].",
   "The Slowest. Due to its slow movement speeds, the sloth is physically incapable of taking the Dodge Action.",
   "Airborne Attacks. The sloth's Black Lung Breath and Burning Plague attacks don't deal damage to mechs. However, they do affect the characters inside a mech, dealing damage and inflicting Statuses directly."
  ],
  "frenzy": [
   {
    "name": "Ancient Tolerance",
    "event": false,
    "health": 78,
    "text": "The sloth has been around long enough to withstand physical pain, including mere Forstall signals. The Sloth is now completely immune to Forstall Sweeping."
   },
   {
    "name": "Dysentery",
    "event": true,
    "health": 40,
    "text": "The bacteria on the sloth's body is ancient and infectious. All targets within Long Range become sick with dysentery and lose 1B Grit at the beginning of their turn until the Sloth reaches 0 Health."
   }
  ]
 },
 {
  "name": "Silver-Ringed Octopus",
  "size": "Huge",
  "page": 181,
  "health": 92,
  "defense": "2B",
  "speed": "Normal",
  "skills": {
   "charm": "3B",
   "finesse": "4G",
   "intuition": "4B",
   "nerve": "5B"
  },
  "attacks": [
   {
    "name": "Immobilizing Beak",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "6G damage + Poisoned [3] + Trapped [2]"
   },
   {
    "name": "Neuroshock",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "5G damage + Electrocuted [1]"
   },
   {
    "name": "Sucker Punch",
    "grit": 1,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage"
   },
   {
    "name": "Anchor Limbs",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "Trapped [5B]"
   },
   {
    "name": "Confuse Prey",
    "grit": 4,
    "range": "Long",
    "aoe": true,
    "effect": "Dazed [4B]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [3B], Burned [Immune], Electrocuted [2B], Poisoned [Immune], Trapped [2B]",
  "features": [
   "Black Ink Cloud. Spending 2 Grit, the octopus ejects black ink in a Short Range radius thus granting it Heavy Cover and obscuring it in the water. Lasts three rounds of combat.",
   "Ol' Eight Arms. The octopus can increase the number of targets of its Anchor Limbs attack by spending 1 additional Grit per target added.",
   "Landsick. Dry land is considered Rough Terrain for the octopus. Additionally, if it ends its turn on dry land, it takes Dazed [2].",
   "Hallucinogenic Rings. If a creature willingly moves within Arm's Reach of the octopus, it gains Dazed [1B]."
  ],
  "frenzy": [
   {
    "name": "Maelstrom Surge",
    "event": false,
    "health": 42,
    "text": "In a sudden burst of violence, the octopus thrashes all of its arms. Any creatures within Long Range gain Poisoned [4G], and any creatures already inflicted with this Status also gain Unconscious [3] as the venom overwhelms their nervous systems."
   }
  ]
 },
 {
  "name": "Slide Rock Bolter",
  "size": "Titan",
  "page": 182,
  "health": 82,
  "defense": "5G",
  "speed": "Normal",
  "skills": {
   "charm": "3B4G",
   "finesse": "2B",
   "intuition": "4B",
   "nerve": "8G"
  },
  "attacks": [
   {
    "name": "Monstrous Chomp",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "5G damage"
   },
   {
    "name": "Grab-Hook Tailwhip",
    "grit": 4,
    "range": "Short",
    "aoe": false,
    "effect": "6B2G damage + Dazed [3]"
   },
   {
    "name": "Toxic Grease",
    "grit": 4,
    "range": "Short",
    "aoe": true,
    "effect": "6B damage + Poisoned [3]"
   },
   {
    "name": "Bolt!",
    "grit": 4,
    "range": "Long",
    "aoe": false,
    "effect": "12G damage"
   }
  ],
  "tolerances": "Sweep [4], Afraid [Immune], Burned [1G], Dazed [2B], Electrocuted [1B], Trapped [Immune], Unconscious [2B]",
  "features": [
   "Gangling Lure. The Bolter has a strange lure that extends from its head up to Short Range. The lure lights up and gives off a sweet scent drawing prey in. Before the monster's location is discovered, any targets within Short Range of the lure are drawn in and susceptible to a surprise attack.",
   "No Dodge Danger. The Bolter is unable to take the Dodge Action. Instead, it can use any remaining Grit it would have used to Dodge and apply it on its next turn.",
   "Mountain Camouflage. When motionless, the Bolter is indistinguishable from the mountain terrain around it."
  ],
  "frenzy": [
   {
    "name": "Fault Line Disturbance",
    "event": true,
    "health": 62,
    "text": "The Bolter slams its body into the mountain causing trees, rocks, and debris to tumble down towards any targets within Long Range. The affected targets each take Trapped [6B] and the area becomes Rough Terrain. Mechs take 6G damage."
   },
   {
    "name": "Landslide",
    "event": false,
    "health": 30,
    "text": "The Bolter's Bolt! attack now has the Bang! property applied."
   }
  ]
 },
 {
  "name": "Southern Death Worm",
  "size": "Huge",
  "page": 182,
  "health": 86,
  "defense": "3G",
  "speed": "Fast",
  "skills": {
   "charm": "5G",
   "finesse": "2B",
   "intuition": "3B",
   "nerve": "7B"
  },
  "attacks": [
   {
    "name": "Shredding Teeth",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "4G damage"
   },
   {
    "name": "Quicksand Trap",
    "grit": 1,
    "range": "Melee",
    "aoe": false,
    "effect": "Trapped [2B]"
   },
   {
    "name": "Static Discharge",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "3B damage + Electrocuted [2]"
   },
   {
    "name": "Lightning Arc",
    "grit": 3,
    "range": "Long",
    "aoe": false,
    "effect": "5B damage + Electrocuted [2]"
   }
  ],
  "tolerances": "Sweep [3], Afraid [3B], Dazed [2B], Electrocuted [Immune], Poisoned [2G], Trapped [3B]",
  "features": [
   "Excavator. The worm can move underground through desert terrain at Fast speeds, however, it moves at Slow speeds above ground.",
   "Stun Gun. For any successful attacks that inflict the Electrocuted Status, the worm can choose to spend an additional 1 Grit to keep that target from taking the Aim or Dodge Actions on their next turn.",
   "Natural EMP. Twice per day, the worm may choose to disable any Forstalls within Long Range using static electricity. The affected Forstalls immediately stop Sweeping but can be reactivated by spending the required Grit and using another charge. Scanning and Bursting cannot be attempted for one round."
  ],
  "frenzy": [
   {
    "name": "Sand Shock",
    "event": false,
    "health": 30,
    "text": "The worm shakes violently in the sand generating a build up of static electricity in a Short Range radius. Each target that starts their turn inside that radius automatically takes 2B damage + Electrocuted [1]."
   }
  ]
 },
 {
  "name": "Sun Warden",
  "size": "Titan",
  "page": 183,
  "health": 120,
  "defense": "3B",
  "speed": "Fast",
  "skills": {
   "charm": "6G",
   "finesse": "2B3G",
   "intuition": "5B",
   "nerve": "6G"
  },
  "attacks": [
   {
    "name": "Scorching Talons",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "4G damage + Burned [2]"
   },
   {
    "name": "Incineration",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "6G damage + Burned [6]"
   },
   {
    "name": "Cinder Wings",
    "grit": 4,
    "range": "Short",
    "aoe": true,
    "effect": "6B damage + Burned [2]"
   },
   {
    "name": "Radiant Descent",
    "grit": 3,
    "range": "Long",
    "aoe": false,
    "effect": "6B2G damage + Burned [1]"
   },
   {
    "name": "Flame Thrower",
    "grit": 2,
    "range": "Long",
    "aoe": false,
    "effect": "Burned [4B]"
   }
  ],
  "tolerances": "Sweep [4], Afraid [Immune], Burned [Immune], Poisoned [1B], Trapped [Immune], Unconscious [1B]",
  "features": [
   "Power of the Sun. The Sun Warden burns like the surface of the sun. Any creatures within Long Range automatically take Burned [1] at the start of their turns. If within Short Range, they take Burned [2].",
   "Early Detonation. Any explosives used against the Sun Warden detonate early at Short Range because of the intense heat. Because of this, explosive damage at Arm's Reach does not affect the Sun Warden.",
   "Gift of Flight. The Sun Warden gets one free Move Action per turn when flying in the air. No Grit cost needed."
  ],
  "frenzy": [
   {
    "name": "Firestorm",
    "event": true,
    "health": 90,
    "text": "Flames rain down from above. All targets within Long Range take Burned [6B]. Mechs overheat for one round, disabling their ability to take the Move Action or use a mounted weapon."
   },
   {
    "name": "Blinding Radiance",
    "event": true,
    "health": 40,
    "text": "The Sun Warden expels blinding light as bright as the sun. Any players making an attack against it this round must convert all Gold dice to Black or immediately take Dazed [2]."
   }
  ]
 },
 {
  "name": "Terror Bird",
  "size": "Medium",
  "page": 183,
  "health": 30,
  "defense": "2B",
  "speed": "Fast",
  "skills": {
   "charm": "3B",
   "finesse": "4G",
   "intuition": "1B2G",
   "nerve": "1B1G"
  },
  "attacks": [
   {
    "name": "Concuss Prey",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "3G damage + Unconscious [1]"
   },
   {
    "name": "Raptor Talon",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage + Piercing [1]"
   },
   {
    "name": "Skull Strike",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "3B damage + Dazed [1]"
   },
   {
    "name": "Territorial Stance",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [2B]"
   }
  ],
  "tolerances": "Sweep [1], Dazed [1B], Unconscious [1B]",
  "features": [
   "Solo Hunter. Once per turn while attacking, the Terror Bird may choose to convert one Hit into an Ace.",
   "Flightless Bird. Instead of swooping down on its prey from the skies, the Terror Bird sprints and leaps on its prey. If its Skull Strike attack deals 4 or more damage to a target in a single attack, that target also takes Unconscious [2]."
  ],
  "frenzy": [
   {
    "name": "Raptor's Fury",
    "event": false,
    "health": 15,
    "text": "The Grit cost of the Terror Bird's Raptor Talon attack drops to 1 and it gets one free Move Action per turn."
   }
  ]
 },
 {
  "name": "Trapdoor Spider",
  "size": "Large",
  "page": 184,
  "health": 69,
  "defense": "2B",
  "speed": "Normal",
  "skills": {
   "charm": "5B",
   "finesse": "2B2G",
   "intuition": "4B",
   "nerve": "3B"
  },
  "attacks": [
   {
    "name": "Paralyzing Bite",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2B damage + Poisoned [1] + Trapped [1]"
   },
   {
    "name": "Deadly Dose",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "6G damage + Unconscious [3]"
   },
   {
    "name": "Silk Lasso",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "Trapped [4B]"
   },
   {
    "name": "Sticky Rounds",
    "grit": 1,
    "range": "Long",
    "aoe": false,
    "effect": "Trapped [1B1G]"
   }
  ],
  "tolerances": "Sweep [2], Afraid [2G], Poisoned [Immune], Trapped [2B]",
  "features": [
   "Baited Trap. The spider uses the remains of its previous meal to attract more prey.",
   "Surprise Strike. Before the spider has been seen, it may choose one target within Short Range. Roll 1B. If the result is a Hit or Ace, the target is Trapped in the burrow with a Status Severity of 6.",
   "Gun Jam. If the spider's Sticky Rounds attack gets 3 or more Hits, the target's ranged weapon becomes jammed. Before their next attack, the target must spend the weapon's Grit cost to clean off the spider's webbing before firing.",
   "Burrow Cover. When in its burrow but not completely hidden, the spider benefits from Heavy Cover."
  ],
  "frenzy": [
   {
    "name": "Into the Dungeon",
    "event": true,
    "health": 35,
    "text": "The spider retreats into its burrow where Forstall signals are hindered. If a target is Trapped by the Spider when this occurs, they are pulled in along with it. The burrow is lined with silk webbing making it Rough Terrain, and any attacks the spider makes inside its home deal an extra +1G."
   }
  ]
 },
 {
  "name": "Tunneling Grub",
  "size": "Medium",
  "page": 185,
  "health": 41,
  "defense": "2G",
  "speed": "Slow",
  "skills": {
   "charm": "1B1G",
   "finesse": "2B",
   "intuition": "4B",
   "nerve": "4B"
  },
  "attacks": [
   {
    "name": "Suckermouth",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "Trapped [3G]"
   },
   {
    "name": "Digestive Muck",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "1B2G damage + Poisoned [1]"
   },
   {
    "name": "Gargle and Spit",
    "grit": 4,
    "range": "Short",
    "aoe": true,
    "effect": "2B damage + Poisoned [1] + Trapped [1]"
   },
   {
    "name": "Slime Ball",
    "grit": 2,
    "range": "Short",
    "aoe": false,
    "effect": "2B damage + Trapped [1]"
   },
   {
    "name": "Piercing Echoes",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "1G damage + Dazed [1]"
   }
  ],
  "tolerances": "Sweep [1], Dazed [1B], Poisoned [1B]",
  "features": [
   "Masticate. If a target is Trapped by the grub's Suckermouth attack, then the next time it uses Suckermouth it may choose to deal 3G damage instead of inflicting Trapped [3G]. This subsequent action only costs 2 Grit.",
   "Proficient Tunneler. The Grub can tunnel through caves and mines at a Normal speed while movement outside of its own tunnels is Slow.",
   "Slimy Residue. Any path the Grub has traveled over is left with a sticky slime and becomes Rough Terrain."
  ],
  "frenzy": [
   {
    "name": "Cave In",
    "event": true,
    "health": 24,
    "text": "The Tunneling Grub retreats into the earth then explosively collapses up to two tunnel exits, locking its targets within a confined area and filling the air with thick dust. Each target caught within has one less Grit per turn until they leave the tunnels."
   }
  ]
 },
 {
  "name": "Twin Diamondback",
  "size": "Medium",
  "page": 186,
  "health": 35,
  "defense": "2G",
  "speed": "Normal",
  "skills": {
   "charm": "2B2G",
   "finesse": "3G",
   "intuition": "2B",
   "nerve": "5B"
  },
  "attacks": [
   {
    "name": "Twin Strike",
    "grit": 1,
    "range": "Melee",
    "aoe": false,
    "effect": "1G damage"
   },
   {
    "name": "Venomous Spit",
    "grit": 4,
    "range": "Short",
    "aoe": false,
    "effect": "3B damage + Poisoned [1] + Dazed [1]"
   },
   {
    "name": "Hypnotic Sway",
    "grit": 3,
    "range": "Short",
    "aoe": true,
    "effect": "Unconscious [2B]"
   },
   {
    "name": "Golden Rattle",
    "grit": 3,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [2B]"
   }
  ],
  "tolerances": "Sweep [1], Afraid [1G], Poisoned [Immune], Trapped [2B]",
  "features": [
   "Bicephalous Snake. If being attacked at Short Range or closer, the diamondback can make one Twin Strike attack in retaliation at the end of the attacker's turn. Instead of rolling 1G, roll with 1B.",
   "Dueling Heads. At the start of the Diamondback's turn, roll 1B to see if the two heads are aligned with each other's course of action: Blank = Can't take the Move Action this turn, Spur = Can't take the Dodge Action this turn, Hit = Gain +1 Move Action this turn, Ace = Gain +1 Grit this turn."
  ],
  "frenzy": [
   {
    "name": "Double Vision",
    "event": true,
    "health": 20,
    "text": "Any creature that has been bitten by the snake using its Twin Strike attack now feels the delayed, dizzying effects of its venom. Those creatures immediately take Dazed [6B]."
   }
  ]
 },
 {
  "name": "Vampire Bat",
  "size": "Small",
  "page": 186,
  "health": 32,
  "defense": "1B",
  "speed": "Normal",
  "skills": {
   "charm": "4G",
   "finesse": "3B",
   "intuition": "1B1G",
   "nerve": "3B"
  },
  "attacks": [
   {
    "name": "Blood Siphon",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2G damage"
   },
   {
    "name": "Silent Strike",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "3B damage + Dazed [1]"
   },
   {
    "name": "Fearful Screech",
    "grit": 2,
    "range": "Short",
    "aoe": true,
    "effect": "Afraid [1G]"
   },
   {
    "name": "Supersonic Pulse",
    "grit": 4,
    "range": "Long",
    "aoe": false,
    "effect": "2B damage + Dazed [2]"
   }
  ],
  "tolerances": "Sweep [1], Afraid [1G], Burned [-1B], Trapped [1B]",
  "features": [
   "Full Moon Fortified. If a full moon is present, the bat becomes more energized and dangerous. Its Speed becomes Fast and Attack Actions cost one less Grit to activate.",
   "Blood Thirsty. The Vampire Bat regains Health equal to the damage given using its Blood Siphon attack.",
   "Anticoagulant Saliva. If 3+ Hits are rolled using the Blood Siphon attack, the bat's saliva infects the wound making it difficult for the victim's blood to coagulate. For each subsequent turn that a player's wounds is not attended to by a First Aid item, it takes +1B damage. Roll at the start of their turn.",
   "Gift of Flight. The bat gets one free Move Action per turn. No Grit cost needed."
  ],
  "frenzy": [
   {
    "name": "One With Darkness",
    "event": false,
    "health": 16,
    "text": "The Vampire Bat uses the darkness around it to disappear and reappear as if by magic, granting it +2B to its Defense."
   }
  ]
 },
 {
  "name": "Western Hellbender",
  "size": "Medium",
  "page": 187,
  "health": 28,
  "defense": "1B",
  "speed": "Normal",
  "skills": {
   "charm": "3G",
   "finesse": "1B1G",
   "intuition": "3B",
   "nerve": "4B"
  },
  "attacks": [
   {
    "name": "Needle Teeth",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "2B damage"
   },
   {
    "name": "Toxic Spray",
    "grit": 4,
    "range": "Short",
    "aoe": false,
    "effect": "2B1G damage + Poisoned [2]"
   },
   {
    "name": "River Thrash",
    "grit": 3,
    "range": "Short",
    "aoe": true,
    "effect": "Afraid [2B]"
   },
   {
    "name": "Aqueous Jet",
    "grit": 3,
    "range": "Long",
    "aoe": false,
    "effect": "2B1G damage"
   }
  ],
  "tolerances": "Afraid [1B]",
  "features": [
   "Help from Below. The hellbender fights like a demon but it also seems to have help from the down below. Twice per day, the hellbender can choose to roll 6B and recover Health equal to the number of Hits. No Grit required.",
   "Clever Disguise. The hellbender's skin can change colors and even texture to blend in with its surroundings, making it difficult to track down or hunt.",
   "Regrow Limbs. If the hellbender loses a limb during combat, spend 3 Grit and roll 1B. On an Ace, it regrows its limb and adds 2 to its Health."
  ],
  "frenzy": [
   {
    "name": "Blisterback Rage",
    "event": false,
    "health": 16,
    "text": "The hellbender has had enough. Its blood begins to boil and so does any water around it. Each of its attacks now inflicts Burned [1] in addition to any damage or other Statuses."
   }
  ]
 },
 {
  "name": "Winter Wolverine",
  "size": "Large",
  "page": 188,
  "health": 86,
  "defense": "2G",
  "speed": "Fast",
  "skills": {
   "charm": "5B",
   "finesse": "2B2G",
   "intuition": "3B",
   "nerve": "6G"
  },
  "attacks": [
   {
    "name": "Frost Bite",
    "grit": 4,
    "range": "Melee",
    "aoe": false,
    "effect": "6G damage + Burned [3]"
   },
   {
    "name": "Shredding Claws",
    "grit": 3,
    "range": "Melee",
    "aoe": false,
    "effect": "2B2G damage"
   },
   {
    "name": "Numbing Freeze",
    "grit": 4,
    "range": "Short",
    "aoe": true,
    "effect": "Trapped [3B]"
   },
   {
    "name": "Bristleback Warning",
    "grit": 2,
    "range": "Long",
    "aoe": true,
    "effect": "Afraid [2B]"
   }
  ],
  "tolerances": "Sweep [3], Afraid [3B], Electrocuted [1B], Poisoned [1B], Trapped [2B]",
  "features": [
   "Dominance. The wolverine isn't intimidated by large threats. Apply the Bang! property to any attacks it makes against Mule- and Dromedary-class mechs.",
   "Unrestrained Aggression. The wolverine will stop at nothing to hunt or defend its territory, even if that means dying in the process. Twice per day, it can exchange up to 5 Health for additional Black attack dice. Gain +1B per 1 Health exchanged.",
   "Hell Frozen Over. Spend an additional 2 Grit when using the Numbing Freeze attack to also inflict the affected targets with Burned [2]."
  ],
  "frenzy": [
   {
    "name": "Favorable Whiteout",
    "event": false,
    "health": 28,
    "text": "The wolverine kicks up the surrounding snow which begins to swirl around in a Long Range radius. Now in its preferred element, the monster gains +1 Grit per turn and benefits from the effects of Heavy Cover while in the whiteout."
   }
  ]
 },
 {
  "name": "Yellowjacket Swarm",
  "size": "Small",
  "page": 188,
  "health": 24,
  "defense": "1B",
  "speed": "Normal",
  "skills": {
   "charm": "2B",
   "finesse": "3B",
   "intuition": "2B",
   "nerve": "1B"
  },
  "attacks": [
   {
    "name": "Stinger",
    "grit": 2,
    "range": "Melee",
    "aoe": false,
    "effect": "1G damage"
   },
   {
    "name": "Protect Hive",
    "grit": 3,
    "range": "Short",
    "aoe": false,
    "effect": "Afraid [3B]"
   },
   {
    "name": "Shoot Stinger",
    "grit": 3,
    "range": "Long",
    "aoe": false,
    "effect": "2B damage"
   }
  ],
  "tolerances": "Trapped [2B]",
  "features": [
   "Noxious Sting. If the swarm deals 3+ damage to one target during its turn, that target also takes Dazed [2].",
   "Swelling Wounds. If a target takes any damage from the swarm during the combat scenario, that body part immediately begins to swell and must be roleplayed accordingly. This could restrict one's vision or movement depending on where they were stung, but goes away after one hour."
  ],
  "frenzy": [
   {
    "name": "Swarm Tactics",
    "event": false,
    "health": 12,
    "text": "The swarm begins to fly frantically in all directions, making them harder to attack. The swarm's defense now becomes 2G instead of 1B."
   }
  ]
 }
];
