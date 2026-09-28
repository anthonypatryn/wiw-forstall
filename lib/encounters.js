// Encounter builder (Run the Game → Start Something): monsters and people by terrain and book, rated for this posse
// by its Prestige tier. The books give no habitat field, so TERRAIN is the kit's own tagging from each monster's name
// and description, using the Guidebook's terrain names (Seasons & Weather, pp. 198–199). Adjust freely.
export const TERRAINS = ['Desert', 'Forest', 'Glaciers', 'Bayou', 'Lakeside', 'Pacific Coast', 'Mountains', 'Plains', 'Subterranean', 'Volcanoes', 'Towns'];
export const TERRAIN = {
  'Alligator Snapping Turtle': ['Bayou', 'Lakeside'], 'Alpine Bigfoot': ['Mountains', 'Glaciers'], 'American Bullfrog': ['Bayou', 'Lakeside'],
  'American Mastodon': ['Plains', 'Glaciers'], Antlion: ['Desert'], 'Badlands Sasquatch': ['Desert', 'Mountains'], 'Bark Watcher': ['Forest'],
  'Black Widow and Spawn': ['Desert', 'Plains', 'Subterranean'], Bloodsucker: ['Bayou', 'Lakeside'], 'Bone-Carver Ant': ['Desert', 'Plains'],
  'Bull Jackalope': ['Plains', 'Desert'], 'Burrowing Mudbugs': ['Bayou', 'Lakeside'], 'Canadian Beaver Bear': ['Forest', 'Lakeside'],
  'Carnivorous Pine': ['Forest', 'Mountains'], Chupacabra: ['Desert', 'Plains', 'Towns'], 'Desert Scorpion': ['Desert'],
  'Dire Wolf Pack': ['Plains', 'Forest', 'Mountains', 'Towns'], 'Dusting Moth': ['Forest', 'Plains'], 'Feral Hog Cyclops': ['Plains', 'Forest', 'Towns'],
  Firefox: ['Forest'], 'Giant Centipede': ['Subterranean', 'Forest'], 'Glowing Cave Worm': ['Subterranean'], 'Golden Bear': ['Forest', 'Mountains'],
  'Golden Eagle': ['Mountains', 'Plains'], 'Grand Canyon Tarantula': ['Desert', 'Mountains'], 'Great Golden Elk': ['Forest', 'Mountains'],
  'Great Horned Owl': ['Forest'], Hodag: ['Forest'], 'Horned Lizard': ['Desert'], 'Hundred-Year Hydra': ['Subterranean', 'Bayou'],
  'Invasive Woodpecker': ['Forest', 'Towns'], 'King Cottonmouth': ['Bayou', 'Lakeside'], 'Lake Guardian Moose': ['Lakeside', 'Forest'],
  Latcher: ['Bayou', 'Forest'], 'Lightning Bug': ['Bayou', 'Forest'], 'Livewire Mudcat': ['Lakeside', 'Bayou'], 'Lumberjack Mouse': ['Forest', 'Towns'],
  'Lurking Moss': ['Forest', 'Bayou', 'Subterranean'], 'Mississippi Lobster': ['Lakeside', 'Bayou'], 'North American Anaconda': ['Bayou', 'Lakeside'],
  'Opal Beetle': ['Subterranean'], Opossum: ['Forest', 'Bayou', 'Towns'], 'Ozark Howler': ['Forest', 'Mountains'], 'Plains Shepherd Bison': ['Plains'],
  'Pondweed Peril': ['Lakeside', 'Bayou'], 'Prairie Wolf': ['Plains'], 'Queen Condor': ['Desert', 'Mountains'], 'Quill Archer': ['Forest', 'Mountains'],
  'Range Troll': ['Plains'], 'Red Horned Devil': ['Subterranean'], 'Red Mine Spider': ['Subterranean'], 'Red-Striped Skunk': ['Plains', 'Forest'],
  'Road Runner': ['Desert'], 'Sabertooth Mountain Lion': ['Mountains'], 'Shasta Skullface': ['Mountains', 'Volcanoes'],
  'Silver-Ringed Octopus': ['Lakeside', 'Pacific Coast', 'Subterranean'], 'Slide Rock Bolter': ['Mountains'], 'Southern Death Worm': ['Desert'],
  'Spotted Whiptail': ['Desert'], 'Sun Warden': ['Desert'], 'Terror Bird': ['Plains', 'Desert'], 'Trapdoor Spider': ['Forest', 'Plains', 'Desert'],
  'Tunneling Grub': ['Subterranean'], 'Twin Diamondback': ['Desert'], 'Vampire Bat': ['Subterranean'], 'Vampire Trout': ['Lakeside'],
  'Vasthorn Ram': ['Mountains'], 'Western Hellbender': ['Lakeside'], 'Winter Wolverine': ['Glaciers', 'Mountains', 'Forest'], 'Yellowjacket Swarm': ['Forest', 'Plains'],
};
export const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Titan'];
// by the posse's Prestige tier: the sizes that make a fair fight (a step smaller is Easy, a step bigger Hard, two Deadly)
export const TIER_FAIR = { Tenderfoot: ['Tiny', 'Small'], Cowpoke: ['Small', 'Medium'], Trailblazer: ['Medium', 'Large'], Roughrider: ['Large', 'Huge'], Wrangler: ['Huge'], Legend: ['Huge', 'Titan'] };
// people fight like monsters of this size, by Health
export const personSize = (health) => (health <= 7 ? 'Small' : health <= 11 ? 'Medium' : 'Large');
export const RATINGS = ['Easy', 'Fair', 'Hard', 'Deadly'];
// how tough `count` of a `size` are for a posse of `posse` characters at `tier`
export function rate(size, tier, count = 1, posse = 3) {
  const fair = (TIER_FAIR[tier] || TIER_FAIR.Tenderfoot).map((s) => SIZES.indexOf(s)), i = SIZES.indexOf(size);
  let step = i < fair[0] ? -1 : i > fair[fair.length - 1] ? i - fair[fair.length - 1] : 0; // −1 easy, 0 fair, 1 hard, 2+ deadly
  if (count > Math.max(1, Math.ceil(posse / 2))) step += 1; // a crowd is a step tougher
  if (count > posse + 1) step += 1;
  return RATINGS[Math.max(0, Math.min(3, step + 1))];
}
