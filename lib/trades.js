// The seven Trades (Guidebook pp. 18–31) and their official character sheets.
// First ability is the starting one; others unlock with Prestige (4). Ace-in-the-Hole 2 costs 6.
export const TRADES = {
 "Doctor": {
  "quickBuild": {
   "charm": "3B",
   "finesse": "4B",
   "intuition": "2B",
   "nerve": "3B"
  },
  "abilities": [
   {
    "name": "Curative Care",
    "text": "The art of healing is crucial to your posse, and you know how to make your First Aid supplies last. Consumable First Aid items used by you have twice as many uses.",
    "cost": 0
   },
   {
    "name": "Curative Care 2",
    "text": "When using a First Aid item, gain an additional +1B.\n(2/day): You're able to use mundane items in your healing. Using materials available to you, spend 2 Grit and roll 2G, healing an ally's wounds equal to the amount of Hits.",
    "cost": 4
   },
   {
    "name": "Field Medic",
    "text": "Your studies have taught you how to identify and treat the effects of most poisons and venoms. In one hour, you can develop a remedy that will remove the Lasting Effect of the Poisoned Status.",
    "cost": 4
   },
   {
    "name": "Crippling Precision",
    "text": "(2/day): Your knowledge of anatomy aids you in determining the fragile parts of a body. After successfully doing damage to a target any movement during its next turn will cost twice the amount of Grit.",
    "cost": 4
   },
   {
    "name": "Biological Amplification",
    "text": "With your physiological prowess, you’re able to enhance those around you. Spend 2 Grit and choose 1 ally within Short Range. Give this ally either an Aim Action or a Dodge Action [1B] to be used on their next turn, at no Grit cost to them.",
    "cost": 4
   },
   {
    "name": "Bedside Manner",
    "text": "(2/day): Your experience in high-stakes medical work gives you a sense of composure in stressful situations. Choose up to 4 allies within Arms Reach. These allies temporarily gain +1G for their next roll made with any Skill.",
    "cost": 4
   }
  ],
  "aces": [
   {
    "name": "Healing Grenade (First Aid)",
    "text": "Spend 2 Grit, choose a location within Short Range, and roll 2G. All allies within Short Range of this location regain Health equal to the number of Hits rolled. The “Bang!” property applies.",
    "cost": 0
   },
   {
    "name": "Experimental Grenade (First Aid)",
    "text": "Your Healing Grenade now has the opposite effect against enemies. Enemies in Range lose Health equal to the number of Hits rolled. The “Bang!” property still applies.",
    "cost": 6
   }
  ]
 },
 "Gunslinger": {
  "quickBuild": {
   "charm": "3B",
   "finesse": "4B",
   "intuition": "2B",
   "nerve": "3B"
  },
  "abilities": [
   {
    "name": "Sharpshooter",
    "text": "You aim more effectively by anticipating the target’s intentions. On any attacks at Short Range or longer, you automatically bypass 1 of the target’s Defense.",
    "cost": 0
   },
   {
    "name": "Sharpshooter 2",
    "text": "Your marksmanship is unmatched. Going forward, any attacks at Short Range or longer automatically bypass 2 of the target’s Defense.\n(2/day): For one turn, any of your Ranged attacks can increase by 1 Range level.",
    "cost": 4
   },
   {
    "name": "Cut of the Profit",
    "text": "As long as you have a “Neutral” or better Reputation with your employer, you receive 20% more money for bounties or other hired jobs at the time of completion.",
    "cost": 4
   },
   {
    "name": "Deadeye",
    "text": "(2/day): Experience outranks everything. When you take the Aim Action before attacking, you may reroll 2 dice of your choice, instead of 1.",
    "cost": 4
   },
   {
    "name": "A Certain Notoriety",
    "text": "Your business is to know how and where to find your bounty. In any large city you visit, you have a contact in a guild related to this line of work. This contact can provide information on your bounty’s habits, last known location, or other rumors.",
    "cost": 4
   },
   {
    "name": "Quick-Draw",
    "text": "(2/day): Your lightning-fast reaction time has kept you alive this long. You gain +2B to Finesse rolls made to determine turn order.",
    "cost": 4
   }
  ],
  "aces": [
   {
    "name": "Rapid Fire (Pistols)",
    "text": "Time slows down and bullets fly. Spend 2 Grit and choose 1 target within Short Range. Roll 6B and deal damage to this target equal to the number of Hits rolled.",
    "cost": 0
   },
   {
    "name": "Bullet Storm (Pistols)",
    "text": "Your Rapid Fire becomes a raging storm. Spend 2 Grit, roll 4G, and increase to Long Range. Instead of a single target, assign the damage rolled between multiple targets.",
    "cost": 6
   }
  ]
 },
 "Hunter": {
  "quickBuild": {
   "charm": "3B",
   "finesse": "4B",
   "intuition": "2B",
   "nerve": "3B"
  },
  "abilities": [
   {
    "name": "Monster Insight",
    "text": "Your experience in the West gives you a great understanding of the monsters living here. The Warden will reveal information about the behavior of a monster that you can see. Additionally, gain +1B to Intuition rolls made to Scan with a Forstall.",
    "cost": 0
   },
   {
    "name": "Monster Insight 2",
    "text": "Your sense of monster strengths and weaknesses evolves. Going forward, use +1G to Intuition rolls made to Scan with a Forstall.\n(2/day): Spend 2 Grit to find a monster’s weak point, and grant your allies +1G to their next attack against the monster.",
    "cost": 4
   },
   {
    "name": "Stalking Prey",
    "text": "You are an expert in surveying tracks or scat. Gain +1B to Intuition rolls made to track a creature. Then, add 2 Hits to your first attack against this creature.",
    "cost": 4
   },
   {
    "name": "Game Call",
    "text": "(2/day): Using a device of your own creation, you can mimic the sounds of an animal or monster. The creature must move inside the next closest Range measurement (from Distant Range to Long Range, from Long Range to Short Range).",
    "cost": 4
   },
   {
    "name": "Hunting Buddy",
    "text": "You have a way with animals, and often keep one close to you. Choose one Small or Tiny animal. It has 3 Health and cannot attack, but will follow basic commands such as Seek, Retrieve, or Hide. You can vaguely understand each other’s intentions.",
    "cost": 4
   },
   {
    "name": "Nature’s Mask",
    "text": "(2/day): Your experience in the western landscape allows you to use available materials to become one with your surroundings. Gain +2B to Finesse rolls made to hide or be stealthy.",
    "cost": 4
   }
  ],
  "aces": [
   {
    "name": "Beastmaster’s Roar (Charm)",
    "text": "You stand up tall, puff out your chest, and yell intimidatingly at a Medium or smaller creature within Short Range. Spend 2 Grit and roll 4B. Inflict the Afraid Status with a Severity equal to the number of Hits.",
    "cost": 0
   },
   {
    "name": "Berating Shout (Charm)",
    "text": "Your Beastmaster’s Roar can now reprimand a creature. After targeting a monster currently in its Frenzy, spend 2 Grit and roll 2G. The monster loses its Frenzied state for an amount of turns equal to the number of Hits.",
    "cost": 6
   }
  ]
 },
 "Marshal": {
  "quickBuild": {
   "charm": "3B",
   "finesse": "4B",
   "intuition": "2B",
   "nerve": "3B"
  },
  "abilities": [
   {
    "name": "Fired Up",
    "text": "You call on your experience and fervor to revitalize yourself for one turn. Doing so temporarily increases your max Grit to 9 for one turn, but it will be limited to only 3 Grit during the following turn.",
    "cost": 0
   },
   {
    "name": "Fired Up 2",
    "text": "Your energy is infectious. Choose 2 allies within Short Range. These chosen allies may temporarily increase their max Grit to 8 for their next turn. Your max Grit is reduced to 2 on your next turn\n(2/day): When you use this ability, regain 2 Health.",
    "cost": 4
   },
   {
    "name": "Enlist Recruit",
    "text": "While in a populated area, you can convince 1 civilian to assist you as long as you have a “Helpful” or better Reputation with them. They can perform basic tasks to the best of their ability, but won’t do anything too dangerous. The Warden acts for the Recruit.",
    "cost": 4
   },
   {
    "name": "Serve & Protect",
    "text": "(2/day): After you take the Dodge Action, and when an ally within Arm’s Reach is the target of an attack, you may allow this ally to gain its benefits instead of yourself.",
    "cost": 4
   },
   {
    "name": "Warm Reception",
    "text": "Your presence allows you to blend in among the common people. As long as your reputation with a Faction is “Suspicious” or better, consider it as being one level higher. For example, “Suspicious” becomes “Neutral”, or “Helpful” becomes “Revered”.",
    "cost": 4
   },
   {
    "name": "Town Brawler",
    "text": "(2/day): You’re able to interpret aggressive body language and present a decent threat in fistfights. You gain +2B to Nerve Challenge Rolls made to wrestle, grapple, or restrain during your brawl.",
    "cost": 4
   }
  ],
  "aces": [
   {
    "name": "Rallying Cry (Charm)",
    "text": "Your call to arms is emboldening. Spend 2 Grit and choose up to 4 allies within Short Range. Until your next turn, each chosen ally gains +3G for Defense. Those at Long Range gain +1G.",
    "cost": 0
   },
   {
    "name": "Inspiring Address (Charm)",
    "text": "You’ve learned to fine tune your words to the trials of those who hear you. Spend 2 Grit and roll 3G. Any ally within Short Range of you may remove 1 Severity level of any one Status for every Hit rolled.",
    "cost": 6
   }
  ]
 },
 "Mechanic": {
  "quickBuild": {
   "charm": "3B",
   "finesse": "4B",
   "intuition": "2B",
   "nerve": "3B"
  },
  "abilities": [
   {
    "name": "Enhanced Armament",
    "text": "You’ve constructed a wearable gauntlet of scrap metal and technological parts. It acts as a Melee Weapon with a 2G / 2 Grit attack, a small built-in battery, and 1 upgrade slot.",
    "cost": 0
   },
   {
    "name": "Enhanced Armament 2",
    "text": "As an expert in tinkering, you’ve developed an improved version of your gauntlet. It now has a second upgrade slot.\n(2/day): Gain an additional +1B when you take the Dodge Action.",
    "cost": 4
   },
   {
    "name": "Perpetual Salvager",
    "text": "The endless craving for useful components to add to your bits box allows you to more effectively salvage Scrap. After the Warden rolls to determine how much Scrap is salvaged, roll 1G and gain additional Scrap equal to the number of Hits.",
    "cost": 4
   },
   {
    "name": "Forstall Efficiency",
    "text": "(2/day): With a little dial-turning and buttonmashing, you’re able to briefly increase the effectiveness of a Forstall’s signal. After rolling with a Forstall’s dice pool to Sweep, you can convert one successful Hit to an Ace.",
    "cost": 4
   },
   {
    "name": "Weaponsmith",
    "text": "Your expertise in upgrades and careful cable management skills allows you to create 1 additional Upgrade Slot for 1 of your weapons at any given time. This slot is maintained by you and doesn’t transfer with the weapon if traded, lost, or sold.",
    "cost": 4
   },
   {
    "name": "Mechanical Restoration",
    "text": "(2/day): Your knowledge of machinery is first-class, especially when it comes to repairs. Spend 4 Grit and roll 3G to repair a mech and restore its Mech Health equal to the amount of Hits rolled.",
    "cost": 4
   }
  ],
  "aces": [
   {
    "name": "Mechanized Haymaker (Melee)",
    "text": "Your Enhanced Armament converts kinetic energy over time. As a Melee Attack Action, release this energy in one massive punch, rolling 4G against your target.",
    "cost": 0
   },
   {
    "name": "Electrified Prod (Melee)",
    "text": "With some modifications, your Armament can release an electrical charge. Spend 2 Grit and roll 4G, inflicting the Electrocuted Status with a Severity equal to the number of Hits.",
    "cost": 6
   }
  ]
 },
 "Prospector": {
  "quickBuild": {
   "charm": "3B",
   "finesse": "4B",
   "intuition": "2B",
   "nerve": "3B"
  },
  "abilities": [
   {
    "name": "Remote Detonator",
    "text": "With your own self-built device, you’ve perfected the craft of explosives. You can pair 1 Explosive to your Detonator. If you spend 2 Grit, you can take the Prepare Action to detonate the explosive at any time before your next turn.",
    "cost": 0
   },
   {
    "name": "Remote Detonator 2",
    "text": "The number of Explosives you can pair to your Detonator increases to 2 at a time, and can be triggered together or separately.\n(2/day): You’ve concocted an explosive putty that can only be paired to your Detonator. Roll 2G when setting off this Explosive.",
    "cost": 4
   },
   {
    "name": "Echoes in the Dark",
    "text": "You know underground terrain like the back of your hand. By tapping on walls and listening carefully, you can detect hollow spaces, hidden passages, and whether or not something is hiding around the next corner.",
    "cost": 4
   },
   {
    "name": "Digging Deep",
    "text": "(2/day): You find the will to fight through exhaustion and physical weakness. Spend 2 Grit and roll 2G. Gain Health equal to the amount of Hits (refer to the Nerve talent when rerolling Spurs). Health gained in this way can temporarily exceed your Max Health.",
    "cost": 4
   },
   {
    "name": "Face in the Dirt",
    "text": "Too many close calls with explosions has taught you how to take advantage of natural cover. When you have the benefits of either Light or Heavy Cover, gain an additional +1B to roll with Defense.",
    "cost": 4
   },
   {
    "name": "Diamond in the Rough",
    "text": "(2/day): With your experience picking flecks of gold from piles of dirt, you’re able to detect important details others might not. Gain +2B to Intuition rolls made to find ore or other precious underground resources.",
    "cost": 4
   }
  ],
  "aces": [
   {
    "name": "Seismic Charge (Explosives)",
    "text": "Spend 3 Grit to slam a directional explosive into the ground. Any Medium or smaller creature within Short Range and a 90° arc is pushed away from you up to Short Range and is knocked to the ground.",
    "cost": 0
   },
   {
    "name": "Terraform Spike (Explosives)",
    "text": "When planted in the ground, your Seismic Charge can now drop a projectile that shatters the earth around it, creating an area of Rough Terrain with a radius equal to Short Range. Allies caught in this area also gain Light Cover.",
    "cost": 6
   }
  ]
 },
 "Trapper": {
  "quickBuild": {
   "charm": "3B",
   "finesse": "4B",
   "intuition": "2B",
   "nerve": "3B"
  },
  "abilities": [
   {
    "name": "Trap Expertise",
    "text": "You rely on your mechanical knowledge to survive in dangerous situations. Gain an additional +1G when setting Traps (including improvised traps).",
    "cost": 0
   },
   {
    "name": "Trap Expertise 2",
    "text": "Your proficiency with traps has increased. Going forward, use +2G when setting traps.\n(2/day): You’ve learned how to make Bait more convincing. When a monster rolls with Intuition to avoid Bait set by you, it temporarily loses -1B for its roll.",
    "cost": 4
   },
   {
    "name": "Wilderness Guide",
    "text": "Your knowledge of the landscape helps you avoid getting lost. You can also lead your posse to a location within 30 minutes of travel to find either food, water, or shelter.",
    "cost": 4
   },
   {
    "name": "Split-Second Snare",
    "text": "(2/day): With practiced hands and no need for thought, certain traps come second-nature to you. Spend 4 Grit and use the necessary materials to quickly set an improvised Snare trap [2B] during combat.",
    "cost": 4
   },
   {
    "name": "Escape Artist",
    "text": "When you are inflicted with the Trapped Status, temporarily gain +1G to Finesse or Nerve rolls made to remove the Status.",
    "cost": 4
   },
   {
    "name": "Locksmith",
    "text": "(2/day): Your experience setting traps has taught you how to bypass them. Gain +2B to Finesse rolls made to pick locks or otherwise disable similar equipment.",
    "cost": 4
   }
  ],
  "aces": [
   {
    "name": "Dust Devil Engine (Traps)",
    "text": "Deploy a contraption that kicks up a swirling cyclone of debris. Spend 2 Grit and choose a location at Short Range. Until the end of your next turn, the cyclone grants Light Cover and obscures line of sight to anything within Short Range.",
    "cost": 0
   },
   {
    "name": "Sandstorm Turbine (Traps)",
    "text": "With some kitbashing, your Engine is now more threatening. Spend 2 Grit, choose a location, and then roll 3G. Anything caught in the debris is inflicted with the Dazed Status of a Severity equal to the number of Hits.",
    "cost": 6
   }
  ]
 }
};
