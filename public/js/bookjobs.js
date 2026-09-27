// Ready-made bounties and jobs from the expansion books, for the Warden's "New poster" and "New quest" forms.
// Rewards are the books' own; where a book gives none, it's left blank for the Warden to set.

export const BOOK_POSTERS = [
  { label: 'Alpha (Hogwild Gang)', src: 'Iron Road p. 46–47', name: 'Alpha', alias: 'Leader of the Hogwild Gang', crime: 'Leading the Hogwild Gang in raids against the Railroad and the Rosewoods.', reward: 500, terms: 'Dead or Alive', town: 'port-kansas' },
  { label: 'Bill Kane', src: 'East Portal p. 57', name: 'Bill Kane', alias: 'Bloodshot', crime: 'Robbery at The River Bank.', reward: 100, terms: 'Dead or Alive', town: 'east-portal',
    note: 'Said to have $100,000 of stolen cash hidden in a cave midway up the Black Canyon cliffs, the entrance well hidden, or maybe it doesn’t exist at all (East Portal p. 66).' },
  { label: 'The Hodag', src: 'Iron Road p. 106', name: 'Hodag', alias: 'Wild beast', crime: 'A rancher near Dobytown saw a wild beast that matches the Hodag’s description.', reward: '', terms: 'Dead only', town: 'dobytown',
    note: 'Adda Grove heard about it and will tell the posse where to go if they split the bounty with her.' },
  { label: 'Horse thief', src: 'Iron Road p. 170', name: '', alias: '', crime: 'Horse theft.', reward: '', terms: 'Dead or Alive', town: 'colorado-springs' },
  { label: 'Railroad slanderer', src: 'Iron Road p. 170', name: '', alias: '', crime: 'Disrespecting the U.S. Railroad Co.', reward: '', terms: 'Alive only', town: 'colorado-springs' },
];

const steps = (...list) => list.map((text) => ({ text, hidden: false, done: false }));
export const BOOK_JOBS = [
  // Port Kansas job board (Iron Road p. 46)
  { label: 'Beached Barge', src: 'Iron Road p. 46', title: 'Beached Barge', where: 'port-kansas', reward: '$6.00',
    text: '“My cargo barge got run aground upstream, been sittin’ there like a gutted fish for two days. I need strong backs or clever minds to help float her free ’fore scavengers beat me to the hold.” Signed Captain Beauregard Flint.',
    steps: steps('Find the barge upstream', 'Float her free', 'Collect from Captain Flint') },
  { label: 'Fishing Hands', src: 'Iron Road p. 46', title: 'Fishing Hands', where: 'port-kansas', reward: '$0.25 per fish and a hot meal',
    text: 'The Crooked Crow is running low on fresh catch. Hike upstream and fish the shallows; the fish are spooked by the low water, so mind your shadow and set the bait right. Signed Grizz Cotter.',
    steps: steps('Fish the shallows upstream', 'Bring the catch to Grizz at the Crooked Crow') },
  { label: 'Freight Loaders', src: 'Iron Road p. 46', title: 'Freight Loaders', where: 'port-kansas', reward: '$2.50',
    text: 'A barge came in heavy and half the crew is laid up with river fever. Load crates from the hold to the warehouse. Don’t open nothin’, don’t ask questions. Signed Foreman Tomás Navarro.',
    steps: steps('Show up at first bell', 'Load every crate', 'Get paid') },
  { label: 'Missing Persons', src: 'Iron Road p. 46', title: 'Missing Persons', where: 'port-kansas', reward: '$10.00 for confirmation, $25.00 if brought back alive',
    text: 'Two Rosewood agents, Rico and Fallon, went upriver last week to scout what’s stopping the water flow and never came back. “I need eyes on that bend and answers, not guesses.” Signed Deputy Lorraine Wu.',
    steps: steps('Head upriver to the bend', 'Find out what happened to Rico and Fallon', 'Report to Deputy Wu') },
  // East Portal community board (East Portal p. 57–58)
  { label: 'Vampire trout bounty', src: 'East Portal p. 57', title: 'Vampire Trout Infestation', where: 'east-portal', reward: '$5.00 each, dead',
    text: 'Vampire trout infestation in the Gunnison. The town pays for every one brought in dead.', steps: steps('Fish or hunt Vampire Trout in the Gunnison', 'Bring them in') },
  { label: 'Mech couriers', src: 'East Portal p. 57', title: 'Package to Topaz Creek', where: 'east-portal', reward: '',
    text: 'Mech couriers needed. Package delivery to Topaz Creek. Signed, Glinda Flintwood.', steps: steps('Pick up the package from Glinda Flintwood', 'Deliver it to Topaz Creek') },
  { label: 'Movers for Matilda', src: 'East Portal p. 57', title: 'Movers Needed', where: 'east-portal', reward: '',
    text: 'Old lady Matilda needs help moving her furniture and belongings from her current house to a new one.', steps: steps('Load up Matilda’s things', 'Move them to the new house') },
  { label: 'Birdwatching guide', src: 'East Portal p. 57', title: 'Birdwatchers Seek a Guide', where: 'east-portal', reward: '',
    text: 'Birdwatching enthusiasts seek a guide. A rare bird was seen nesting in deep monster territory.', steps: steps('Meet the birdwatchers', 'Guide them to the nest', 'Get everyone back alive') },
  { label: 'Archaeological dig', src: 'East Portal p. 57', title: 'Help at the Dig Site', where: 'east-portal', reward: '',
    text: 'Help needed at a new archaeological digging site due north of here. Contact the Prospectors Guild.', steps: steps('Talk to the Prospectors Guild', 'Work the dig site') },
  { label: 'Bow hunting challenge', src: 'East Portal p. 57', title: 'Bow Hunting Challenge', where: 'east-portal', reward: 'A new Outrider Tech Compound Bow with two L1 upgrades',
    text: 'Bow hunting challenge. The winner gets a brand new Outrider Tech Compound Bow (comes with two L1 upgrades of choice).', steps: steps('Enter the challenge', 'Bring back the best kill with a bow') },
  { label: 'Substitute teacher', src: 'East Portal p. 57', title: 'Substitute Teacher', where: 'east-portal', reward: '',
    text: 'In need of a substitute school teacher for two days. “They are the sweetest children when they want to be.” Signed, Mary Limon.', steps: steps('Teach the class for two days') },
  { label: 'Buster the dog', src: 'East Portal p. 57', title: 'Bring Buster Home', where: 'east-portal', reward: '',
    text: 'Dog skipped town. Need help retrieving him. Name’s Buster.', steps: steps('Track Buster down', 'Bring him home') },
  { label: 'Field trip escorts', src: 'East Portal p. 58', title: 'Field Trip Escorts', where: 'east-portal', reward: '',
    text: 'Field trip next week. Armed escorts needed beyond Town Forstall range.', steps: steps('Escort the schoolchildren', 'Bring every one of them back') },
  { label: 'Lumber for the bridge', src: 'East Portal p. 58', title: 'Lumber for the Bridge', where: 'east-portal', reward: '',
    text: 'Lumber needed for bridge repairs. Douglas Fir preferred. Not carnivorous.', steps: steps('Cut Douglas Fir (not the carnivorous kind)', 'Haul it to the Bridge') },
  { label: 'Huck Wendall’s death', src: 'East Portal p. 58', title: 'The Death of Huck Wendall', where: 'east-portal', reward: '',
    text: 'The Sheriff’s office is looking for evidence or information related to the death of a Huck Wendall.', steps: steps('Find evidence', 'Bring it to Sheriff Burnside') },
  { label: 'Lock-picker wanted', src: 'East Portal p. 58', title: 'Grandmother’s Inheritance Chest', where: 'east-portal', reward: '',
    text: 'Lock-picker wanted. Lost the key to my grandmother’s inheritance chest.', steps: steps('Pick the lock on the chest') },
  { label: 'Rock climbing contest', src: 'East Portal p. 57', title: 'Rock Climbing Contest', where: 'east-portal', reward: '',
    text: 'Rock climbing contest: more competitors desired.', steps: steps('Sign up', 'Climb') },
];
