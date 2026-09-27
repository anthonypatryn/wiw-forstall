// The expansion books' shops and price lists (East Portal Setting Guide, Judgment on the Iron Road), for the Store's
// "Book Shops" tab. Every item has `shop` ("East Portal · Portal General"), `book` and the printed `page`.
// Things the Guidebook already sells (guns, upgrades, Forstalls, mechs, gear) are copies of that catalog item at the
// shop's price, so buying one still lands on the sheet. Specials: `scrapQty` (buying adds that much Scrap to the sheet
// instead of an inventory row) and `rest: 'town'` (a paid night's lodging gives the buyer a Town Rest).
const EP = 'East Portal', IR = 'Iron Road';
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export function buildExpansionCatalog(base) {
  const out = [];
  const byId = Object.fromEntries(base.map((i) => [i.id, i]));
  const shopOf = (book, town, name, page) => ({ shop: `${town} · ${name}`, book, page });
  // an item the Guidebook already sells, at this shop's price (optionally renamed, like the Suremark Stabilizer)
  const copy = (s, baseId, cost, extra = {}) => {
    const b = byId[baseId];
    if (!b) throw new Error(`expansion catalog: no ${baseId}`);
    out.push({ ...b, ...extra, cost, shop: s.shop, book: s.book, page: s.page, base: b.id, id: `x-${slug(s.shop)}-${slug(extra.name || b.name)}` });
  };
  // something new to the Store (goods, services, food, lodging…)
  const goods = (s, name, cost, extra = {}) => out.push({ cat: 'Goods & Services', sub: s.shop, name, cost, shop: s.shop, book: s.book, page: s.page, ...extra, id: `x-${slug(s.shop)}-${slug(name)}` });

  // ---------------- East Portal ----------------
  let s = shopOf(EP, 'East Portal', 'Scrapyard', 19);
  goods(s, 'Scrap (from the Scrapyard)', 3, { scrapQty: 1, note: 'Adds 1 Scrap to your sheet. The Scrapyard also buys Scrap at $1.50 a piece: sell it like anything else you own.' });
  s = shopOf(EP, 'East Portal', 'Bunkhouse', 19);
  goods(s, 'Bunkhouse: Shared Room (per night)', 0.5, { rest: 'town', note: 'A night’s rest in town. Miner’s discount: −$0.10.' });
  goods(s, 'Bunkhouse: Private Room (per night)', 0.75, { rest: 'town', note: 'A night’s rest in town. Miner’s discount: −$0.10.' });
  s = shopOf(EP, 'East Portal', 'Mess Hall', 20);
  [['Beef and Barley Soup', 0.15], ['Fried Mush or Grits', 0.08], ['Stewed Beans and Salt Pork', 0.12], ['Pickled Vegetables', 0.05], ['Molasses Cookie', 0.03]].forEach(([n, c]) => goods(s, n, c));
  s = shopOf(EP, 'East Portal', 'Painted Spade Hotel', 23);
  goods(s, 'Hotel: Single Bed (per night)', 1.5, { rest: 'town', note: 'A night’s rest in town, courtesy of Hannah Perry.' });
  goods(s, 'Hotel: Family Room (per night)', 2.5, { rest: 'town', note: 'A night’s rest in town, courtesy of Hannah Perry.' });
  goods(s, 'Hotel: Premier Room (per night)', 3, { rest: 'town', note: 'A night’s rest in town, courtesy of Hannah Perry.' });
  goods(s, 'Hotel Breakfast', 0.15);
  s = shopOf(EP, 'East Portal', 'Waterton Mortuary', 29);
  [['Coffin (Plain Pine Box)', 4], ['Coffin (Stained Wood)', 10], ['Engraved Headstone', 16], ['Funeral Arrangements', 12]].forEach(([n, c]) => goods(s, n, c));
  s = shopOf(EP, 'East Portal', 'Forstall Workshop (Ivan Ward)', 32);
  copy(s, 'models-backpack-forstall', 50); copy(s, 'models-saddlebag-forstall', 70); copy(s, 'models-mech-forstall', 100); copy(s, 'models-town-forstall', 200);
  s = shopOf(EP, 'East Portal', 'Title Office', 33);
  [['In-Town Residential (per acre)', 100], ['In-Town Commercial (per acre)', 120], ['Rural Farmland (per acre)', 5], ['+ House (1–2 Rooms)', 75], ['+ House (3–4 Rooms)', 150], ['+ Storefront (Modest)', 200], ['+ Storefront (Extravagant)', 500]]
    .forEach(([n, c]) => goods(s, `Deed: ${n}`, c, { note: 'Property in or around East Portal, recorded by Victor Finley. Houses and storefronts are built on land you own.' }));
  s = shopOf(EP, 'East Portal', 'Delgado Leather Goods', 35);
  goods(s, 'Satchel or Courier Bag', 3); goods(s, 'Pistol, Shotgun, or Rifle Holster', 2, { note: '$2.00 to $3.50 depending on the gun. Beetle shell inlay costs extra.' }); goods(s, 'Riding Boots & Gloves', 8.5);
  s = shopOf(EP, 'East Portal', 'Barry’s Barbershop', 38);
  [['Haircut', 0.25, 'Roll 1B for what Barry lets slip (Book Tables).'], ['Beard Trim or Mustache Styling', 0.1], ['Straight Razor Shave', 0.15, 'Roll 1B for what Barry lets slip (Book Tables).'], ['Cologne Dab', 0.05], ['Unwanted Advice', 0]].forEach(([n, c, note]) => goods(s, n, c, note ? { note } : {}));
  s = shopOf(EP, 'East Portal', 'Gunnwater Arms', 40);
  [['Basic Cleaning and Oil', 0.25], ['Barrel Realignment', 1.5], ['Trigger or Hammer Adjustment', 0.5], ['Stock Repair or Refasten', 2]].forEach(([n, c]) => goods(s, `Gun repair: ${n}`, c));
  copy(s, 'pistols-lockheed-iron-works-hj-87-negotiator', 25); copy(s, 'pistols-finncaster-company-green', 47); copy(s, 'shotguns-lockheed-iron-works-lt-63-executor', 33);
  copy(s, 'shotguns-brig-jones-co-model-630', 58); copy(s, 'rifles-brig-jones-co-model-930', 45); copy(s, 'rifles-finncaster-company-red', 50);
  copy(s, 'for-purchase-overcharge-chamber', 15); copy(s, 'for-purchase-kickguard-stabilizer', 10); copy(s, 'for-purchase-rangefinder-lens', 38);
  copy(s, 'for-purchase-charged-holster-battery-required', 68); copy(s, 'for-purchase-dart-launcher', 18); copy(s, 'for-purchase-heartbeat-sensor', 8);
  s = shopOf(EP, 'East Portal', 'Wilde Critters Taxidermy', 45);
  [['Tiny/Small Monster Mount or Tanned Hide', 5], ['Medium Monster Mount or Tanned Hide', 12], ['Large Monster Mount or Tanned Hide', 30], ['Trophy Plaque and Engraving', 2.5], ['Skull or Bone Cleaning and Polishing', 6]].forEach(([n, c]) => goods(s, n, c));
  s = shopOf(EP, 'East Portal', 'Black Canyon Mule Depot', 48);
  copy(s, 'classes-dowitcher-mech', 125); copy(s, 'classes-piper-mech', 150); copy(s, 'classes-dromedary-mech', 400); copy(s, 'classes-mule-mech', 250);
  s = shopOf(EP, 'East Portal', 'Appendage Replacement Shop', 51);
  copy(s, 'mechanical-prosthetics-hand', 20); copy(s, 'mechanical-prosthetics-arm', 50); copy(s, 'mechanical-prosthetics-face-or-eye', 150); copy(s, 'mechanical-prosthetics-leg', 100);
  s = shopOf(EP, 'East Portal', 'Portal General', 52);
  copy(s, 'general-goods-bedding-bedroll', 1.5); copy(s, 'general-goods-bedding-canvas-tarp', 2); copy(s, 'general-goods-lighting-kerosene-lantern', 1.75); copy(s, 'general-goods-lighting-flashlight', 2.5);
  copy(s, 'general-goods-clothing-coat', 7.5); copy(s, 'general-goods-clothing-wide-brimmed-hat', 3.5); copy(s, 'general-goods-clothing-leather-boots', 6.75); copy(s, 'general-goods-musical-instruments-harmonica', 2.5);
  [['Flour (per pound)', 0.04], ['Sugar (per pound)', 0.07], ['Bread (per loaf)', 0.06], ['Cheese (per pound)', 0.18], ['Beef (per pound)', 0.08], ['Chicken (per pound)', 0.12], ['Beans (per pound)', 0.04], ['Fruits/Vegetables (per bushel)', 0.5], ['Coffee (per glass)', 0.05], ['Milk (per glass)', 0.04]].forEach(([n, c]) => goods(s, n, c));
  s = shopOf(EP, 'East Portal', 'Better Gold Saloon', 56);
  [['Beer (per pour)', 0.05], ['Whiskey (per pour)', 0.08], ['Brandy (per pour)', 0.12], ['Rum (per pour)', 0.08]].forEach(([n, c]) => goods(s, n, c));
  // the Gunnison's fish (East Portal p. 13 names them; the book gives no prices, so these are house prices)
  s = shopOf(EP, 'East Portal', 'Fish from the Gunnison', 13);
  [['Rainbow Trout', 0.5], ['Firefish', 1], ['Gilded Catfish', 2]].forEach(([n, c]) => goods(s, n, c, { house: true, note: 'A catch from the Gunnison. House price (the book names the fish but gives no price); sell it for about half.' }));

  // ---------------- Judgment on the Iron Road ----------------
  s = shopOf(IR, 'Port Kansas', 'The Crooked Crow', 45);
  [['Salted Catfish and Corn Grits', 0.35], ['Fried Corn Cakes', 0.15], ['Pickled Egg and Crackers', 0.2], ['Missouri Mash Whiskey (per pour)', 0.15], ['Crow’s Signature Punch', 0.1], ['Sarsaparilla', 0.1]].forEach(([n, c]) => goods(s, n, c));
  s = shopOf(IR, 'Port Kansas', 'Merchant Pier Blacksmith', 47);
  [['Shoe a Horse (full set)', 1], ['Wagon Wheel Repair', 3], ['Tool Repair or Sharpening', 0.15], ['Custom Tool Making', 1.25], ['Gunmetal Work (minor repair)', 1.5], ['Decorative Ironwork', 2], ['Custom Branding Iron', 2], ['Metal Patch for Boat Hull', 2], ['Rudder or Anchor Repair', 1.5]].forEach(([n, c]) => goods(s, n, c));
  s = shopOf(IR, 'Port Kansas', 'Blakely’s Boat Parts', 48);
  [['Wooden Oar', 0.75], ['Tar or Pitch (per bucket)', 0.5], ['Bilge Pump (hand-operated)', 3], ['Paddle Wheel Slat (single)', 0.5], ['Steam Valve', 2.5], ['Pressure Gauge', 3], ['Bailer Patch Kit', 2], ['Piston Ring', 1.25], ['Steam Whistle', 4]].forEach(([n, c]) => goods(s, n, c));
  s = shopOf(IR, 'Port Kansas', 'Fresh Fish & Crustacean Stand', 48);
  [['Catfish', 0.75], ['Northern Pike', 0.6], ['Vampire Trout (per pound)', 1.5], ['Burrowing Mudbug (per pound)', 1.5], ['Mussels (per dozen)', 0.2]].forEach(([n, c]) => goods(s, n, c));
  s = shopOf(IR, 'Port Kansas', '“The Port” Trading Post', 49);
  copy(s, 'tools-fishing-pole', 0.75); goods(s, 'Whetstone', 0.15); copy(s, 'general-goods-lighting-kerosene-lantern', 1.5); goods(s, 'Journal', 0.05); goods(s, 'Signal Mirror', 0.3);
  copy(s, 'first-aid-snake-oil', 1); copy(s, 'first-aid-pain-pills', 0.5); copy(s, 'first-aid-antidote', 4); copy(s, 'general-goods-bedding-canvas-tarp', 2.25); copy(s, 'general-goods-bedding-bedroll', 1.75);
  goods(s, 'Hardtack (one week’s rations)', 0.4); copy(s, 'melee-eastling-arsenal-hatchet', 11); copy(s, 'pistols-brig-jones-co-model-310', 18); copy(s, 'rifles-used-rifle', 20);
  s = shopOf(IR, 'Omaha', 'Traveling Carnival & Museum', 62);
  goods(s, 'Carnival ticket', 0.25); goods(s, 'Uncivilized West Museum admission', 0.5, { page: 70, note: 'Free if you come with Harrison Bishop or mention his name to Mack.' });
  s = shopOf(IR, 'The Great Plains', 'Max & Valerie Wright (traveling)', 86);
  copy(s, 'for-purchase-oscillation-modulator', 25); copy(s, 'for-purchase-rangefinder-lens', 38); copy(s, 'for-purchase-heartbeat-sensor', 8); copy(s, 'models-saddlebag-forstall', 70);
  goods(s, 'Spokelines', 14, { cat: 'Gear', sub: 'Tools', note: 'A pair of handheld radio boxes tuned to the same frequency, good up to 1 mile apart. Often crackly, always handy.' });
  [['Latcher Head', 1, 'Crushed into a powder: +1B to your next Nerve roll to relieve the Poisoned Status.'],
    ['Lightning Bug Bioluminescent Abdomen', 8, 'Recharges a Forstall battery up to 2 Charges, or shake it for Short Range light for 10 minutes (10 uses).'],
    ['Prairie Wolf Skull', 5, 'Made into masks worn by 2 or more players in combat: every enemy within Long Range starts the fight with Afraid [1G].'],
    ['Bloodsucker Sucker Pouch', 2.5, 'A squeeze container that holds up to three liters of liquid.'],
    ['Red-Striped Skunk Sulfur Gland', 12, 'When popped, explodes in a Short Range radius, inflicting Dazed [2B] and Poisoned [2B].']].forEach(([n, c, note]) => goods(s, `Trophy: ${n}`, c, { page: 87, note }));
  [['Prairie Wolf: 1-0-6740', 12], ['Firefox: 6-8-6549', 13.5], ['Dusting Moth: 3-7-8089', 18], ['Opossum: 8-8-7631', 22.5], ['Terror Bird: 4-6-3212', 25]]
    .forEach(([n, c]) => goods(s, `Kurtz frequency: ${n}`, c, { page: 88, note: 'Written on a scrap of paper. (Warden: the Opossum and Terror Bird ones are wrong, and Max and Valerie know it. Intuition target 4 spots it.)' }));
  [['Flint (per piece)', 0.1], ['Refined Quartz Crystal', 4.5], ['Gold (per ounce)', 20]].forEach(([n, c]) => goods(s, n, c, { page: 88 }));
  goods(s, 'Scrap Metal (per piece)', 2.5, { page: 88, scrapQty: 1, note: 'Adds 1 Scrap to your sheet.' });
  s = shopOf(IR, 'Rackline Roost', 'Nightingale Forge & Mercantile', 128);
  copy(s, 'ranged-weapon-upgrades-ranged-weapon-accuracy-level-2', 20, { name: 'Suremark Stabilizer (L2 Accuracy)', note: 'A device that helps stabilize micro-vibrations with a target-assist processor.' });
  out.push({ cat: 'Upgrades', sub: 'For Purchase', name: 'Torchwire Strobe (battery required)', cost: 8, type: 'Utility', appliesTo: 'Rifle, Shotgun, Pistol, Bow, Melee',
    upgrade: 'Torch mode lights dark areas; Strobe mode: spend 2 Grit to inflict Dazed [1B].', shop: s.shop, book: IR, page: 128, id: `x-${slug(s.shop)}-torchwire-strobe` });
  copy(s, 'mech-upgrades-mech-speed-level-2', 40, { name: 'Ankle-Joint Servos (Mech L2 Speed)', note: 'Precise control over acceleration, letting the mech push off harder and faster.' });
  s = shopOf(IR, 'Colorado Springs', 'Mech Depot (Pip Schäfer)', 169);
  copy(s, 'classes-dowitcher-mech', 125); copy(s, 'classes-piper-mech', 150); copy(s, 'classes-mule-mech', 250); copy(s, 'classes-dromedary-mech', 400);
  goods(s, 'Mech repairs (per 1 Mech Health)', 2); copy(s, 'mech-upgrades-mech-health-level-1', 45); copy(s, 'mech-upgrades-mech-speed-level-2', 40); copy(s, 'mech-upgrades-mech-armor-level-2', 75);
  return out;
}
