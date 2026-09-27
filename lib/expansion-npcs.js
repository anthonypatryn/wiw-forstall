// NPCs from the expansion books: East Portal Setting Guide and Judgment on the Iron Road.
// Generated from the books' text (scratchpad npcgen.py). `profile` = a stat block shaped like booknpcs.js faction figures;
// GENERIC = ready-made enemies like the Guidebook's p. 191 combatants.
export const X_NPCS = [
 {
  "name": "Samuel Burnside",
  "role": "Sheriff",
  "faction": "",
  "where": "Sheriff’s Office, East Portal",
  "book": "East Portal",
  "page": 21,
  "group": "East Portal townsfolk",
  "desc": "Male, 56 years. A cream-colored wide brim hat sits atop Samuel’s furrowed brow. His thick mustache is trimmed with precision and his eyes are flint-gray, forever measuring, forever judging. A bronze sheriff’s badge adorns his tweed vest and white collared shirt. Everything about him appears neat and orderly. Samuel has never forgiven his parents for giving him the name Samuel. Too many people call him Sam, which he hates. His name is Samuel, nothing more, nothing less. His passion is law and order and his greatest satisfaction is to make sure others are upholding it. Everything he spends his time doing is to ensure he’s better equipped to do his job. He wasn’t voted in as sheriff because he’s personable, but because he’s thorough. He’s got a razor sharp quick draw with a deadly aim."
 },
 {
  "name": "Robert Kremling",
  "role": "Banker",
  "faction": "",
  "where": "The River Bank, East Portal",
  "book": "East Portal",
  "page": 22,
  "group": "East Portal townsfolk",
  "desc": "Male, 62 years. A stout man with a large belly but puny eyes behind thick eyeglasses. Robert wears a black bowler hat with a bright red feather to cover his bald head when he goes outside under the hot sun. A black suit coat covers his red vest and white buttoned shirt. His short legs move briskly and his eyes dart left and right wherever he goes. Born Sergey Izakov in New York City to poor Eastern European immigrant parents, Robert fought his way through childhood. He helped his parents at their small grocery store and discovered his natural gift with money, which allowed him to save up for business school. He went into banking and became quite successful, but got greedy and involved with some unsavory characters. After a deal with the wrong people went sour, a series of events led to him faking his death and heading west with the new name, Robert Kremling. He’s quiet and reserved, but not timid. He never talks about his past and he doesn’t like being asked about it. He’s kept away from anything resembling outlaws out West so as not to repeat his former life. He made mistakes with people. But he never makes mistakes with his numbers."
 },
 {
  "name": "Hannah Perry",
  "role": "Hotelier",
  "faction": "",
  "where": "Painted Spade Hotel, East Portal",
  "book": "East Portal",
  "page": 23,
  "group": "East Portal townsfolk",
  "desc": "Female, 67 years. Half-moon eyeglasses sit on the bridge of Hannah’s thin nose, in front of a tight bun of blonde hair. She wears a long light blue dress with puffy sleeves at her shoulders. Long, thin fingers scan leather-bound ledgers on a tidy desk. Hannah has a busy personality and her passion is luxury. She works hard to present her establishment as a place of culture and refinement. She’s constantly complaining about her limited access to luxury in East Portal and that everyone in the West is lacking in culture. She talks of moving back to the big city every spring, but her perpetual improvement projects on the hotel will likely ensure that that never happens."
 },
 {
  "name": "Don Diego de los Robles",
  "role": "Watchmaker & mechanic",
  "faction": "",
  "where": "His tented workstation, East Portal",
  "book": "East Portal",
  "page": 25,
  "group": "East Portal townsfolk",
  "desc": "Don Diego de los Robles is a highly-talented watchmaker but has great interest in all machines. As the youngest son of a noble family in Spain, he knew his prospects were limited compared to his older brothers. They barely paid him any attention. He sought fortune in Mexico to no avail, but heard of fantastic machines further North. Diego brought his traveling watch and general repair shop to East Portal. He secretly hopes to someday return to Spain with Western technology to claim the fame he feels owed.",
  "hooks": "Diego wants to take a closer look at a modified Piper mech belonging to a member of the Tulos. Too bad he’ll have to pay someone to steal it, if anyone is willing. He’s just short of the Scrap he needs to finish an upgrade to his Forstall. If you could provide 12 Scrap, he’d be happy to complete any upgrade at half cost for you.",
  "profile": {
   "name": "Don Diego de los Robles",
   "book": "East Portal",
   "page": 26,
   "health": "10",
   "defense": "-",
   "speed": "Normal",
   "charm": "2B1G",
   "finesse": "4G",
   "intuition": "3B",
   "nerve": "2B",
   "talents": "Finesse, Mechs",
   "abilities": [
    "Mech Doctor (2/day). Diego spends 3 Grit and rolls 6G, repairing a Mech and restoring an amount of Health equal to the number of Hits.",
    "Clockwork Tracker. Diego manufactures his own proprietary tracking system and can follow the ping from miles away. For sale to the right buyer..."
   ],
   "attacks": [
    {
     "weapon": "Concealed Pocket Pistol",
     "ranges": [
      {
       "range": "Arm's Reach",
       "grit": "2",
       "damage": "1B"
      },
      {
       "range": "Short Range",
       "grit": "2",
       "damage": "1B2G"
      }
     ],
     "notes": "Upgrades: L1 Utility Coppercoil Battery, Charged Holster"
    }
   ],
   "items": ""
  }
 },
 {
  "name": "Dr. Stephen Brogan-Hoff",
  "role": "Doctor",
  "faction": "",
  "where": "Doctor’s Office, East Portal",
  "book": "East Portal",
  "page": 28,
  "group": "East Portal townsfolk",
  "desc": "Male, 44 years. Sunken cheeks and close-cropped gray hair show the effects of many stressful years in his profession helping those in need. He wears a stained apron that hangs over his shirt and suspenders, pockets heavy with clamps and scissors. Cracked-lens spectacles rest low on his perfectly straight nose which is now desensitized to the rubbing alcohol and ointments used on the daily. Steve got his start in medicine as a medic in the United States Cavalry. After his military service he got formal training back home in Philadelphia and became a traveling surgeon for the Railroad. He got fed up with the railroad and now owns a small practice in East Portal. His methods are pragmatic and efficient, but be warned, he’s not known for being very sympathetic with his patients."
 },
 {
  "name": "Isabelle Waterton",
  "role": "Coroner",
  "faction": "",
  "where": "Waterton Mortuary, East Portal",
  "book": "East Portal",
  "page": 29,
  "group": "East Portal townsfolk",
  "desc": "Female, 38 years. Dressed in clean white aprons no matter the time of day, Isabelle keeps her dark hair in a tight bun and her scalpel always close at hand. Her uniform smells faintly of lavender oil and embalming salts, and she hums cheerful hymns while she works. Her bright green eyes sparkle with curiosity as she fills a black leather journal with sketches, notes, and observations. Despite working with corpses as a job, Isabelle is bright and cheerful. Attempting to explain why she is so unaffected by death, she once said, “saddle bags are only as valuable as their contents.” The metaphor was lost on the person who asked the question. Isabelle gets bored of the typical cases and is always hoping for mysteries to solve."
 },
 {
  "name": "Rev. Jon Dawson",
  "role": "Pastor",
  "faction": "",
  "where": "First Chapel of East Portal",
  "book": "East Portal",
  "page": 30,
  "group": "East Portal townsfolk",
  "desc": "Male, 55 years. A middle-aged man with a limp in his left leg, Rev. Dawson carries a carved walking stick and wears a long black coat. His accent carries a stronger drawl than most, nearly to the point of giving unintelligible sermons, but that don’t stop him from pouring his heart out to the people over the pulpit. A leather cord around his neck holds a small metal charm smoothed from years of wear. Jonathan Dawson was born in Kentucky and moved west. Like most people, he went in search of adventure and gold. Jon was rough and rowdy and was constantly getting into trouble wherever he went. In his twenties, he was almost eaten by an Antlion. The monstrous bug was about to pull him down into its lair when it was crushed by a boulder. The rock had been unexplainably dislodged from the mountainside high above and landed on the creature, but not him, preserving Jon’s life. His leg was damaged permanently, but he was alive. He decided to become a minister in the town of East Portal where he met his wife Martha."
 },
 {
  "name": "Mary Limon",
  "role": "School teacher",
  "faction": "",
  "where": "Schoolhouse, East Portal",
  "book": "East Portal",
  "page": 31,
  "group": "East Portal townsfolk",
  "desc": "Female, 23 years. Spectacles slightly too large rest on Mary’s small face, framed by tight black curls pinned neatly to a bonnet atop her head. Her dark skin is often dusted with chalk, the same as her well-worn dresses. She carries a satchel full of books, paper, and sweets for her students. Her voice is gentle but firm. Mary loves teaching. There aren’t many children in the town, so Mary is overly fond and protective of each of them. Mary is constantly learning herself and sharing what she’s learned with others. She spends most of her small income on orders of new books from back east. Other than the kids, Mary’s goal has been to ensure everyone in the town of East Portal can read and write. Because of that, she’s loved by everyone."
 },
 {
  "name": "Ivan Ward",
  "role": "Forstall technician",
  "faction": "",
  "where": "Forstall Workshop, East Portal",
  "book": "East Portal",
  "page": 32,
  "group": "East Portal townsfolk",
  "desc": "Male, 27 years. A lean man with short sleeves rolled to the elbow and dark smudges on his hands (sometimes his jaw line as well). A thin scar runs from his temple to his ear, half-hidden beneath his pushed-back brown hair. Tools hang from his belt and his fingers seem to always be twitching as if they’re ready to measure, grasp, tighten, and adjust some Scrap even when idle. Ivan barely looks up from his workstation, over his spectacles, but when he does it’s only for a moment. He’s a man with intense focus. He came to the west obsessed with the technology and science of Forstalls. He was trained by one of the last remaining pioneers of the technology who came out west after Edison’s death and is constantly refining the performance and range of his machines. He keeps the town’s grid up and running and can construct anything for the right price."
 },
 {
  "name": "Victor Finley",
  "role": "Title officer",
  "faction": "",
  "where": "Title Office, East Portal",
  "book": "East Portal",
  "page": 33,
  "group": "East Portal townsfolk",
  "desc": "Male, 34 years. Victor wears earth-toned shirts and neat vests, his hair always parted and his boots polished, rain or shine. He speaks softly, smiles often, and listens more than he talks. When he’s not behind a desk sorting deeds, he’s most likely in the back room munching down on some biscuits, the crumbs of which will sometimes stick to the wool fabric he’s wearing. Victor is one of those forgettable types, not in a bad way, but because he doesn’t cause a single bit of drama. He’s known for attending every public function and often volunteers in the kitchen for town cookouts."
 },
 {
  "name": "Oliver Fairfield",
  "role": "Mayor",
  "faction": "",
  "where": "Town Hall, East Portal",
  "book": "East Portal",
  "page": 34,
  "group": "East Portal townsfolk",
  "desc": "Male, 46 years. Short and broad-shouldered with slick black hair and a wide grin, Mayor Fairfield wears pinstripe trousers and colorful cravats that tend to match well with his mood each day. He’s rarely seen without a cigar or a story, and his voice carries easily through open windows and crowded rooms. His best quality has to be that memory of his. It miraculously allows him to remember everyone’s name, even the kids who’ve never voted for him. Born in Chicago, Oliver comes from a wealthy family of short stocky Italians. Oliver was raised on basil, baseball, and politics. He’s quite smiley and personable and while he has a mediocre understanding of policy, he has a gifted understanding of human behavior. He has the money to pay for his own campaigns, but hasn’t relied on it to be the sole source of his political success. He’s an excellent conversationalist and it’s easy to see how he won the hearts of the people of East Portal."
 },
 {
  "name": "José Delgado",
  "role": "Tanner",
  "faction": "",
  "where": "Delgado Leather Goods, East Portal",
  "book": "East Portal",
  "page": 35,
  "group": "East Portal townsfolk",
  "desc": "Male, 34 years. Thick forearms and darkened skin speak to years of working hides under the sun and over the smoke. José wears a heavy leather apron with a bone-handled knife in the chest pocket, long working gloves tucked into his belt, and intricately crafted boots of his own design. His eyebrows never grew back quite right after a workshop fire, however, that has never stopped him from raising them dramatically whenever a customer balks at his prices. José is laid back and always has a smile on his face. He plays guitar beautifully and is always singing and whistling little tunes to himself while he works. Don’t let his casual demeanor fool you, he is an excellent craftsman. He can make any type of leather good you can think of and will give you your money’s worth. And if you’re looking for something eye-catching, his specialty is beetle shell inlay, but it’ll cost ya. The one person in town that José doesn’t get along with is Samuel Burnside, who brought his holsters back a total of four times for imperfections he found. José refuses to do work for him anymore."
 },
 {
  "name": "Barry Tungsten",
  "role": "Barber",
  "faction": "",
  "where": "Barry’s Barbershop, East Portal",
  "book": "East Portal",
  "page": 38,
  "group": "East Portal townsfolk",
  "desc": "Male, 51 years. Barry wears brightly patterned shirts with the sleeves rolled high. His hair is always styled, even if it changes week to week, and he keeps a straight razor tucked neatly into his waistband. He walks with a relaxed sway and cuts customers’ hair with the same rhythm. Barry is from New Orleans. His mom was from the Bahaman Islands and his father was a chef on a large Atlantic cargo ship. Naturally gifted with his hands and free spirited, he’s done many different things to make a living throughout his life. One of his many skills is cutting hair. He presents as a happy-go-lucky guy, but is very layered and calculated. He keeps a lot of secrets and enjoys pulling strings. People share a lot with their barbers and barbers can pick and choose what information goes where. Visit often and tip well, it’s wise to be on his good side."
 },
 {
  "name": "Sally Severance",
  "role": "Gunsmith",
  "faction": "The Iron Sights",
  "where": "Gunnwater Arms, East Portal",
  "book": "East Portal",
  "page": 40,
  "group": "East Portal townsfolk",
  "desc": "Female, 39 years. Ms. Severance is small and sharp-featured, with soot on her face and cracked, oversized goggles pulled low over her eyes. Her coat is stitched over with patches (she could care less about proper fashion in the workshop). She rarely speaks to people, but often mutters to the weapons on her bench. The townsfolk find entertainment in guessing what she might be whispering to said weapons. Guns run in Sally’s blood. Her father was an engineer who worked for multiple of the large arms manufacturers before branching off and making custom weapons for wealthy private collectors and specialists. Sally followed in her father’s footsteps and is constantly tinkering and tuning any weapon she can get her hands on. Her upgrades and customizations are renowned in the West. When she moved to East Portal, her talents with gunsmithing were instantly noticed by Job Tarryall, who invited her into the Iron Sights and offered a good deal on rent."
 },
 {
  "name": "Job Tarryall",
  "role": "Leader of the East Portal Iron Sights",
  "faction": "The Iron Sights",
  "where": "Iron Sights Den, East Portal",
  "book": "East Portal",
  "page": 43,
  "group": "East Portal townsfolk",
  "desc": "Male, 43 years. Job’s face is weathered and scarred, with a silver beard and sharp amber eyes that miss nothing. His right leg is a battered iron prosthetic, and his left sleeve hangs empty. A red squirrel perches on the back of his chair, flicking its tail as it waits for his next command. Job has spent almost all of his long life as a monster hunter. Now in his old age, and with his physical impairments, he was forced to retire. Not by his own choice, but forced to by the Iron Sights. Instead he was sent to East Portal to put his experience to use organizing hunts and providing some much needed advice to any rookie monster hunters."
 },
 {
  "name": "James Wilde",
  "role": "Taxidermist",
  "faction": "",
  "where": "Wilde Critters Taxidermy, East Portal",
  "book": "East Portal",
  "page": 45,
  "group": "East Portal townsfolk",
  "desc": "Male, 22 years. James is tall and pale with neatly combed hair and spotless clothes, no matter what he’s been working on. His eyes are a little too still when he talks, and his smile never quite reaches them. He wears long black gloves even when he isn’t handling specimens, and has a habit of tilting his head slightly when someone’s speaking, as if he’s studying a display. Everyone in the town is wary about James. Nothing about him is particularly or noticeably off-putting, but everyone who talks to him can’t help but leave their conversations uneasy. His voice and demeanor are shockingly calm and his sincerity is as unnerving and mysterious as his smile. The town doesn’t know much about him and they honestly prefer it that way. His work preserving trophies and preparing them for sale is too good to ruin with unnecessary information."
 },
 {
  "name": "Greg “Gearbox” Freust",
  "role": "Mulesmith",
  "faction": "Hogwild Gang",
  "where": "Black Canyon Mule Depot, East Portal",
  "book": "East Portal",
  "page": 48,
  "group": "East Portal townsfolk",
  "desc": "Male, 15 years. Greg’s coveralls hang a size too big on his narrow frame, and his pockets bulge with bolts, fuses, and other small bits of Scrap. Blond hair escapes below the stretched knitted hat but his freckles could never be hidden. Greg will never be found without his favorite tool in hand–a hand-crank precision calibrator. Don’t ask why. Greg is a wizard of all things mechanical. The running joke is that he was born on a shop floor and started taking apart and rebuilding Mules ever since. At 15, he may be young, but his skills with moving parts are a sight to behold. Giving any of the older mechanics in the large towns a run for their money."
 },
 {
  "name": "Thomas “Four-eyes” Thompson",
  "role": "Hogwild",
  "faction": "Hogwild Gang",
  "where": "Black Canyon Mule Depot, East Portal",
  "book": "East Portal",
  "page": 49,
  "group": "East Portal townsfolk",
  "desc": "Male, 16 years. Thin, bland, and always hunched over whittling something with his pocket knife. Thomas wears oversized spectacles thick enough to use as a magnifying glass which easily give away his darting eyes. His trousers are too short, showing mismatched socks and scuffed boots patched with wire, and he’s constantly fidgeting with a pencil behind his ear. Thomas met Gregory in Mary’s class when they were young. He got dragged into joining the Hogwilds by Gunther, who convinced the gang to take Thomas on, despite their skepticism due to his small and scrawny limbs. While Gunther is all brawn, Thomas is all brain. He has an undying loyalty to Gunther’s goals, and because of that Gunther is loyal in return. Nobody bothers him out of fear of Gunther."
 },
 {
  "name": "Gunther “Bulldog” Freust",
  "role": "Mulesmith",
  "faction": "Hogwild Gang",
  "where": "Black Canyon Mule Depot, East Portal",
  "book": "East Portal",
  "page": 50,
  "group": "East Portal townsfolk",
  "desc": "Male, 22 years. Gunther is broad and scarred. He moves like a loaded Mule with a cracked regulator; that is, slow, heavy, and hard to stop. His knuckles stay bruised from tuning Scrap and settling scores, and a boar’s tooth hangs from a rough twine around his thick neck. Unlike his brother Gregory who builds with his hands, Gunther breaks with his hands. The driving force of his life is defending his reputation, and fighting the rails. Because of his brutish nature, the Hogwilds noticed him from a young age, and he has since risen through the ranks and become a success in his own right. While his parents don’t view Gunther’s occupation as honorable as his brother’s, they are still proud to see him defending the family name."
 },
 {
  "name": "James Pimsle",
  "role": "Repairman (prosthetics)",
  "faction": "",
  "where": "Appendage Replacement Shop, East Portal",
  "book": "East Portal",
  "page": 51,
  "group": "East Portal townsfolk",
  "desc": "Male, 37 years. James is clean-cut and well-groomed. He can usually be found with navy suspenders over a spotless white shirt and pressed sleeves. A brass monocle fitted with rotating lenses hangs from a chain on his vest and he snorts with a sense of humor that no one else understands. Born in Virginia, James had a strikingly vivid imagination from childhood and his greatest desire was to grow up to be a mighty inventor. His father was a surgeon and his mother often took him to the library where he gravitated toward books on mechanics. He quickly discovered the limitations of steam power and couldn’t stop thinking of the rumors of the wild machines being developed out west. Combining what he learned from his father’s practice and his love for mechanics naturally lead him into the field he’s in."
 },
 {
  "name": "Martha Dawson",
  "role": "Shopkeeper",
  "faction": "",
  "where": "Portal General, East Portal",
  "book": "East Portal",
  "page": 52,
  "group": "East Portal townsfolk",
  "desc": "Female, 47 years. Martha has shoulder-length chestnut hair usually tied back in a loose braid and warm eyes that crinkle when she smiles. One of her front teeth is slightly chipped from trying to open a bottle of sarsaparilla with it (something she still insists will work). Her apron is often coated with flour or pipe ash, and a pearl-handled revolver rests just behind the counter. Martha is sweet as a gumdrop, and dangerous as a cottonmouth. Nobody can forget the time the famed outlaw, Rory Shelton came to town and threatened her husband at gunpoint. Without hesitation she shot him and half his gang dead from behind. The town couldn’t figure out whether it was right for a reverend’s wife to act that way, but figured she was probably ok because it was Rory Shelton. When she’s not threatened, she’s like an adoring grandmother. She keeps her store stocked with everything anyone might need and is known for throwing in free goodies and home made baked goods for her customers."
 },
 {
  "name": "Jim Van Grim",
  "role": "Saloon owner & bartender",
  "faction": "",
  "where": "Better Gold Saloon, East Portal",
  "book": "East Portal",
  "page": 56,
  "group": "East Portal townsfolk",
  "desc": "Male, 52 years. Jim has a thick red mustache and rough dry skin especially around the TNT tattoo on his wrist. His vest is always half-buttoned, and a faded bandana hangs loosely around his neck. A gold nugget dangles from his watch chain, more for luck than for show. Jim was a master prospector. His ability to find gold is uncanny. He came to the West because he loved digging for gold, but all he could think about while isolated in the mountains were people. Everything he wanted to spend his gold on were good times with people. He realized he didn’t want to use up his best years beating himself up in the pursuit of gold far away from people, so he went all in on and purchased the saloon in East Portal which he owns and operates. While he may never achieve the level of wealth he could have, he’s far happier with the new life he’s chosen."
 },
 {
  "name": "John Harbener",
  "role": "Prospectors Guild marshal",
  "faction": "Prospectors Guild",
  "where": "Processing Mill, East Portal",
  "book": "East Portal",
  "page": 59,
  "group": "East Portal townsfolk",
  "desc": "Male, 41 years. John’s beard is long but neatly combed, the color of iron ore streaked with ash. His wide-brimmed hat is always tilted just right. A guildmaster’s badge hangs from a leather strap around his neck, and a pale scar traces the edge of his jaw like a signature left behind by the mine itself. The current leader of the Prospectors Guild in East Portal. He agrees with Jeffrey Hall and thinks they are better equipped now to go deeper into the cavern than ever before, but he respects and trusts Guy Mansfield (see East Portal Mine). Thus, he hesitates to work with Ivan Ward, the local Forstall expert. John doesn’t want to simply ignore Guy’s warnings and proceed deeper into the mine when he knows how Guy feels about it."
 },
 {
  "name": "Guy Mansfield",
  "role": "Mine warden",
  "faction": "Prospectors Guild",
  "where": "East Portal Mine",
  "book": "East Portal",
  "page": 61,
  "group": "East Portal townsfolk",
  "desc": "Male, 46 years. Guy stands tall with the posture of a surveyor more than a miner. His coat is tailored canvas, faded but well kept, and his boots are polished even when caked in dust–a stark contrast from the times he’d return from the mine shafts, filthy and pungent. One of the men on the first tunneling team that discovered the East Portal cave systems, Guy has been in the town since day one. He’s a veteran of below-ground mining and hunting expeditions, and knows as much as anyone about the dangers below. He’s the last remaining member of the original team, and let’s just say the others didn’t die of old age. Guy is a great judge of readiness and won’t let anyone enter the caves unprepared."
 },
 {
  "name": "Jeffrey Hall",
  "role": "Mining superintendent",
  "faction": "Prospectors Guild",
  "where": "East Portal Mine",
  "book": "East Portal",
  "page": 61,
  "group": "East Portal townsfolk",
  "desc": "Male, 39 years. With slicked-back hair, old brimmed hardhat, and a miner’s “tan”, Jeffrey is always ready to lead his fellow miners down into the tunnels. He wears a thick yellow poncho and the brightest headlamp you’ve even seen. When outside of the mines, he’s constantly clicking the headlamp on and off while talking, like punctuation he can’t quite control. Jeffrey thinks Guy is way too cautious, and wants to go full steam ahead on Guild mining operations into the Dark. Times have changed, and now they need to be aggressive in exploiting the riches of the cavern. Ivan thinks he has a way to go deeper, but Guy doesn’t want to risk it."
 },
 {
  "name": "Lester Samuel Hill",
  "role": "Trapper",
  "faction": "",
  "where": "His cabin in the canyon country",
  "book": "East Portal",
  "page": 71,
  "group": "Around the Black Canyon",
  "desc": "Lester Samuel Hill approaches with a slight limp he earned during a fight with a possum that played dead in order to surprise attack him. As a trapper, he’s learned to never let his guard down. Lester approaches trapping like a passionate inventor, a trait he’s tried to pass on to his eight children, specifically his four boys. Some of his favorite traps activate from overhead in the trees, and others underwater. He collects trophies from his kills and his adoring daughters weave the feathers and smaller pieces into his clothing. Lester’s love for his family surpasses even his proudest inventions and collections.",
  "hooks": "Lester could use a hand tracking and trapping an elusive albino mountain lion. It’s been stealing from his traps and he wouldn’t mind having its pelt on his wall. An order for some fruit, vegetables, and Scrap was supposed to come in from town a while back, but has yet to arrive. Did those pesky Hogwilds intercept the delivery?",
  "profile": {
   "name": "Lester Samuel Hill",
   "book": "East Portal",
   "page": 72,
   "health": "12",
   "defense": "1B",
   "speed": "Normal",
   "charm": "2B",
   "finesse": "3B",
   "intuition": "2B3G",
   "nerve": "2B",
   "talents": "Rifles, Traps",
   "abilities": [
    "Tough Love (2/day). Lester uses his fatherly voice to talk an enemy down. Doing so reduces that enemy’s Grit by 2 on their next turn."
   ],
   "attacks": [
    {
     "weapon": "Lockheed Iron Works - OT-49 “Defender”",
     "ranges": [
      {
       "range": "Short Range",
       "grit": "2",
       "damage": "3B"
      },
      {
       "range": "Long Range",
       "grit": "2",
       "damage": "1B3G"
      }
     ],
     "notes": "Upgrades: L2 Optic"
    },
    {
     "weapon": "Beaver Bear Trap",
     "ranges": [
      {
       "range": "Arm's Reach",
       "grit": "3",
       "damage": "Damage [2] + Trapped [2B2G]"
      }
     ],
     "notes": ""
    },
    {
     "weapon": "Hanging Sapling Snare",
     "ranges": [
      {
       "range": "Arm's Reach",
       "grit": "3",
       "damage": "Trapped [2G]"
      }
     ],
     "notes": ""
    }
   ],
   "items": ""
  }
 },
 {
  "name": "“Country” Cayson O’Leary",
  "role": "Outlaw legend",
  "faction": "",
  "where": "Unknown",
  "book": "East Portal",
  "page": 84,
  "group": "Around the Black Canyon",
  "desc": "The characters come across a small band of treasure hunters. One of them has a map signed by the infamous outlaw “Country” Cayson O’Leary."
 },
 {
  "name": "“Bloodshot” Bill Kane",
  "role": "Bank robber",
  "faction": "",
  "where": "Somewhere in the Black Canyon",
  "book": "East Portal",
  "page": 66,
  "group": "Around the Black Canyon",
  "desc": "It’s said that Bloodshot Bill Kane has one hundred thousand dollars of stolen cash hidden inside a cave around here. The entrance is supposedly found midway up the cliff side but it’s very well concealed by the cracks and shadows of the rough terrain …or perhaps doesn’t really exist at all."
 },
 {
  "name": "Harrison Bishop",
  "role": "Mentor (secretly Hugh Burton)",
  "faction": "",
  "where": "St. Louis, then the train west",
  "book": "Iron Road",
  "page": 26,
  "group": "The Heartland Titan & St. Louis",
  "desc": "Male, 61 years. Harrison is an older man with a heavy brow, pale eyes, and smells faintly of burnt copper. His fingertips are stained and calloused from years of wirework and sparks landing on his skin. He wears a patched canvas coat layered over a soot-darkened vest and keeps a small set of insulated pliers clipped to the underside of his pistol holster. Harrison is an expert inventor, learning from his master Thomas Edison those many years ago. Through his time in the West, he quickly learned the dos and don’ts of survival and monster hunting. He also learned how lifesaving and valuable a Forstall can be to deter even the largest of monsters. Though he speaks plainly and keeps to himself, there is a quiet intensity to him. He doesn’t smile often, but when he does, it comes slowly and deliberately, like a man who understands how things work. He carries a cylindrical container around his shoulder which holds the priceless schematics for a new Forstall component."
 },
 {
  "name": "Virginia “Ginny” Clayton",
  "role": "Reluctant heir",
  "faction": "",
  "where": "Aboard the Heartland Titan",
  "book": "Iron Road",
  "page": 27,
  "group": "The Heartland Titan & St. Louis",
  "desc": "Female, 24 years. She wears a heavy duster over an expensive but travel-worn dress. Her dark hair looks as if it was quickly tied into a practical bun on the back of her head. She wears a stoic look on her face, occasionally betrayed by a nervous glance between the people around her and a lockbox under her feet. Ms. Clayton is the reluctant and only surviving heir to a prosperous ranch south of Dodge City. The ranch was owned and operated by an uncle of hers. She was told that a monstrous creature attacked the ranch, disposing of her uncle and his ranch hands. She’s traveling there with a lock box that contains important legal documents proving her relation."
 },
 {
  "name": "Augustin Broussard",
  "role": "Gambler",
  "faction": "",
  "where": "Aboard the Heartland Titan",
  "book": "Iron Road",
  "page": 27,
  "group": "The Heartland Titan & St. Louis",
  "desc": "Male, 42 years. A wiry man with slicked-back brown hair and a pencil moustache that sits atop a permanent smirk. He wears a colorful vest over a ruffled shirt with slightly fraying cuffs. He holds a deck of playing cards in his hands, shuffling and cutting them with a deft touch. His green eyes scan the train car, never bothering to look down. Mr. Broussard is a self-proclaimed gambling master of riverboats in Bayou Country, admitting that he loses his fortunes as quickly as he wins them. His latest streak of luck ended when a Rosewood agent claimed he cheated at a card game, stealing his own small fortune. Denying these claims, Augustin fled across the Mississippi River, undoubtedly with bounty hunters and hired guns on his tail. He hopes to disappear into the desert and start his own casino where the food is actually cooked with care."
 },
 {
  "name": "Morgan Calhoun",
  "role": "Protest spokesperson",
  "faction": "",
  "where": "St. Louis train station",
  "book": "Iron Road",
  "page": 22,
  "group": "The Heartland Titan & St. Louis",
  "desc": "Goes by the name of Morgan Calhoun, is wearing snake-skin boots, loose overalls, and a worn brimmed hat that they tip as curious people approach with questions or polarizing opinions. As anyone approaches, they’ll recite, “What’s your stance on electricity, partner? Is it all that dangerous or just misunderstood?” Morgan will wait to see if the player’s opinion aligns with theirs."
 },
 {
  "name": "Lyle Jessop",
  "role": "Rosewood recruit",
  "faction": "The Rosewood Security Agency",
  "where": "The train wreck, then Port Kansas",
  "book": "Iron Road",
  "page": 35,
  "group": "The Heartland Titan & St. Louis",
  "desc": "The agent, a passionate new recruit named Lyle Jessop, is confident their comrades will be able to help if they can just make it to the edge of the Missouri river."
 },
 {
  "name": "Grizz Cotter",
  "role": "Bartender, The Crooked Crow",
  "faction": "",
  "where": "The Crooked Crow, Port Kansas",
  "book": "Iron Road",
  "page": 45,
  "group": "Port Kansas",
  "desc": "The bartender, Grizz Cotter, loves to tell this story because the chandelier feels so out of place and sticks out like a diamond in a pigpen."
 },
 {
  "name": "Catherine “Knots” McKay",
  "role": "Smuggler",
  "faction": "",
  "where": "The docks, Port Kansas",
  "book": "Iron Road",
  "page": 51,
  "group": "Port Kansas",
  "desc": "Female, 21 years. She stands a hair under average height and dresses light so as to stay quick on her feet. Her sandy-blonde hair is usually pulled into a loose braid, with strands falling across her face. Her tired, hazel-green eyes never seem to linger for too long–always observant, always diligent. Young Cate was given the nickname “Knots” by her father. He always said it was because “you tie everything together.” As an adult, she uses these talents to weave her contracts and relationships with people in a way only she seems to know how to untie. That is, until she got in too deep with the Tulos Mob in Deadwood. She didn’t mean to, but now she wants to disappear into the frontier forever and start over. There’s something unfinished about Cate. She looks like somebody who’s used to surviving but on the edge of living for something more."
 },
 {
  "name": "Roy Greeves",
  "role": "Rosewood agent",
  "faction": "The Rosewood Security Agency",
  "where": "The pier, Port Kansas",
  "book": "Iron Road",
  "page": 51,
  "group": "Port Kansas",
  "desc": "Agent Roy Greeves is angry and slightly drunk, knocking over barrels and throwing supplies into the water. However, he’s sober enough to know the merchant had help because the barge is too complex for one person to operate."
 },
 {
  "name": "Luther Banks",
  "role": "Merchant (smuggler)",
  "faction": "",
  "where": "The pier, Port Kansas",
  "book": "Iron Road",
  "page": 51,
  "group": "Port Kansas",
  "desc": "A middle-aged merchant that Agent Roy Greeves catches at the pier for smuggling “dangerous technologies”. The barge is too complex for one person to operate, so Greeves knows he had help (Cate McKay)."
 },
 {
  "name": "Robin Callahan",
  "role": "Prisoner",
  "faction": "",
  "where": "Rosewood Office, Port Kansas",
  "book": "Iron Road",
  "page": 50,
  "group": "Port Kansas",
  "desc": "This individual, Robin Callahan, was arrested for not paying their taxes to the Rosewoods and resisting to comply. A handcrafted bow and arrows seized during the arrest hang on the opposite wall."
 },
 {
  "name": "Mack Houser",
  "role": "Museum curator",
  "faction": "",
  "where": "The Uncivilized West Museum, Omaha",
  "book": "Iron Road",
  "page": 71,
  "group": "Omaha",
  "desc": "Male, 63. A man large in stature with a shaved head and a waxed mustache, Mack is the perfect blend of rugged and sophisticated. He never leaves the museum without his long tweed coat that smells faintly of old books. Though his hands are calloused from years of fieldwork, he keeps his attitude polished and his deep voice precise. He wears a tiny hummingbird skeleton around his neck, perfectly preserved in a cylindrical glass locket. It was the first creature he ever taxidermied, and he wears it as a symbol of his reverence for life. Mack isn’t just a museum curator. He’s an exceptional trapper, tinkerer, librarian, taxidermist, poet, and flutist. His travels across the continent and overseas have opened his eyes to the beauty of the world as well as the many opportunities that are available in the West. His vision for freedom aligns with the likes of Harrison Bishop, his old friend.",
  "profile": {
   "name": "Mack Houser",
   "book": "Iron Road",
   "page": 71,
   "health": "11",
   "defense": "1B",
   "speed": "Normal",
   "charm": "1B2G",
   "finesse": "2B",
   "intuition": "4G",
   "nerve": "3B",
   "talents": "Forstalls, Traps",
   "abilities": [
    "Trapper’s Appraisal. With a quick glance, Mack can learn any current Statuses affecting a monster and the Severity, as well as the monster’s Frenzy threshold."
   ],
   "attacks": [
    {
     "weapon": "Outrider Tech - Recurve Bow",
     "ranges": [
      {
       "range": "Short Range",
       "grit": "3",
       "damage": "2B2G"
      },
      {
       "range": "Long Range",
       "grit": "3",
       "damage": "1B1G"
      }
     ],
     "notes": "Upgrades: L2 Optic"
    },
    {
     "weapon": "Tethered Stakes",
     "ranges": [
      {
       "range": "Arm's Reach",
       "grit": "2",
       "damage": "Trapped [1G] + 1 Damage + Electrocuted [2]"
      }
     ],
     "notes": "Upgrades: Ironcore Battery"
    }
   ],
   "items": "Backpack Forstall: Short Range (4 Grit) 2B Sweep"
  }
 },
 {
  "name": "Nansehi Washaba",
  "role": "Stable hand",
  "faction": "",
  "where": "Horse stable, Omaha",
  "book": "Iron Road",
  "page": 72,
  "group": "Omaha",
  "desc": "Female, 17. Her dark, braided hair tied in a long cord matches her calm, watchful eyes. A colorful woven sash wraps around her waist and she wears scuffed boots, worn down by her dedicated efforts to keep the horses safe and fed."
 },
 {
  "name": "Max & Valerie Wright",
  "role": "Traveling salespeople",
  "faction": "",
  "where": "On the plains, aboard their Piper mech",
  "book": "Iron Road",
  "page": 85,
  "group": "The Great Plains",
  "desc": "Married couple, 48. Max is hunched over for his age, with a face covered in freckles. His patchy beard is stained with smoke and his wide-brimmed hat is crushed on one side. His coat pockets bulge with dried herbs and strange vials that make a clinking sound when he moves. His mischievous smile and loud chuckle make his wife’s eyes roll. Valerie wears a worn and faded prairie dress with tools, scissors, and measuring spoons strapped around her waist in something like a gunslinger’s belt. Her loud voice carries through walls, but when she smiles there’s a feeling of genuine warmth behind it. She’s the brains and the backbone of everything Max ever tried to take credit for."
 },
 {
  "name": "Linus Kelly",
  "role": "Leader of the Tin Heads Gang",
  "faction": "",
  "where": "Bank of the Platte River",
  "book": "Iron Road",
  "page": 91,
  "group": "The Great Plains",
  "desc": "Linus is an Aussie immigrant who has come to the American West with ambitions to start his own gang, like his bushranger cousin Ned did back home– but better! He’s no less of a gunslinger despite his injury, and he doesn’t let it slow down his drive for action-packed, make-or-break danger. When the Tin Heads Gang has a reputation beyond him and he finally carries out his dream of riding a flying creature, he’ll consider his ambitious life fulfilled.",
  "hooks": "Linus is always eager to take revenge on those “Rosies”. He could use your help ambushing a group of them that are abusing their power in a nearby town. He’s also heard word of a wealthy banker taking a chest full of silver bars by Mule to a client east of here. Linus needs some extra fighters in case things get hairy.",
  "profile": {
   "name": "Linus Kelly",
   "book": "Iron Road",
   "page": 92,
   "health": "10",
   "defense": "2G",
   "speed": "Slow",
   "charm": "3B",
   "finesse": "2B",
   "intuition": "3G",
   "nerve": "4G",
   "talents": "Defense, Shotguns",
   "abilities": [
    "Strategic Defense (2/day). Linus can convert any Hits to Aces on his Defense roll. This can be decided after the roll."
   ],
   "attacks": [
    {
     "weapon": "Brig & Jones Co. - Model 630 Shotgun",
     "ranges": [
      {
       "range": "Short Range",
       "grit": "3",
       "damage": "3B4G"
      },
      {
       "range": "Long Range",
       "grit": "3",
       "damage": "1B"
      }
     ],
     "notes": "Upgrades: L3 Damage"
    },
    {
     "weapon": "Handcraft - Boomerang",
     "ranges": [
      {
       "range": "Arm's Reach",
       "grit": "3",
       "damage": "1B"
      },
      {
       "range": "Short Range",
       "grit": "3",
       "damage": "2B"
      }
     ],
     "notes": ""
    }
   ],
   "items": ""
  }
 },
 {
  "name": "Jimmy Flinders",
  "role": "Tin Heads new recruit",
  "faction": "",
  "where": "Bank of the Platte River",
  "book": "Iron Road",
  "page": 94,
  "group": "The Great Plains",
  "desc": "Male, 33 years. Standing at a mere 5 foot 4 inches tall, Jimmy Flinders is prone to a chaotic and short-tempered arrogance. Platinum blonde-white curly hair and beard cover his head, and he always seems to be chewing a thick strip of rawhide. He moves with a curious swagger, and keen observers might notice a mechanical rattling sound when he walks or moves too quickly, although it would be difficult to pinpoint the location of this sound. He wears a bandolier across his chest filled with expensive ammunition. Jimmy Flinders is one who’s quick to draw and yell loudly at the wrong time. He enjoys his independence but has a difficult time following any guidelines, even if they’re laid out for him clearly. Massively protective of his personal property, Jimmy Flinders don’t put up with pompousness. If you call him “Jim”, them’s fightin’ words. His name is “Jimmy Flinders”, first and last. He once killed a man for mistakenly calling him “Bruce”. But be mindful–his bark is meaner than his underbite."
 },
 {
  "name": "Adda Grove",
  "role": "Owner of the Passing Purpose",
  "faction": "",
  "where": "The Passing Purpose, Dobytown",
  "book": "Iron Road",
  "page": 105,
  "group": "The Great Plains",
  "desc": "Adda Grove is a former bounty hunter that took ownership of the Passing Purpose bar when its prior owner gouged her eyes in an attempt to kill her. He was an outlaw and mistakenly thought she had come to collect his bounty before she killed him in self-defense. She adapted quickly to the loss of her sight with other heightened senses. However, Adda knows leaving town would be too risky amongst the monsters. Besides bartending, she has become a savvy information broker thanks to her impressive hearing and a small network of informants. After a well-placed warning shot, the more rowdy individuals in her establishment learn quickly that her gunslinging skills ain’t so rusty. A soft mechanical whirring sound suggests that might be due to a hidden aid...",
  "hooks": "Adda overheard a conversation between a few Tulos that were planning to shake down a family to collect their debt. She’s very worried the Tulos might take their punishment too far. There’s a bounty for a Hodag and Adda thinks she overheard a rancher talking about a wild beast that might match the monster’s description. She can tell you where to go if you’re willing to split the bounty.",
  "profile": {
   "name": "Adda Grove",
   "book": "Iron Road",
   "page": 106,
   "health": "10",
   "defense": "-",
   "speed": "Normal",
   "charm": "3B",
   "finesse": "4G",
   "intuition": "2B1G",
   "nerve": "2G",
   "talents": "Finesse, Pistols",
   "abilities": [
    "Technological Aid. Adda’s earpiece uses vibrations and audible beeps only she can hear to instantly dial in her shots without looking."
   ],
   "attacks": [
    {
     "weapon": "Finncaster Company - Green (chrome, ivory grip)",
     "ranges": [
      {
       "range": "Short Range",
       "grit": "2",
       "damage": "4G"
      },
      {
       "range": "Long Range",
       "grit": "2",
       "damage": "1B"
      }
     ],
     "notes": "Upgrades: L1 Damage, L1 Accuracy"
    },
    {
     "weapon": "Finncaster Company - Green (blue-back, mahogany grip)",
     "ranges": [
      {
       "range": "Short Range",
       "grit": "2",
       "damage": "3G"
      },
      {
       "range": "Long Range",
       "grit": "2",
       "damage": "1B"
      }
     ],
     "notes": ""
    }
   ],
   "items": ""
  }
 },
 {
  "name": "Charles (“Chuck”)",
  "role": "Tulos collector",
  "faction": "The Tulos Mob",
  "where": "The Passing Purpose, Dobytown",
  "book": "Iron Road",
  "page": 113,
  "group": "The Great Plains",
  "desc": "Charles says that if he returns to the Tulos family home in Deadwood without the payment, Adda will have a storm on her doorstep within days."
 },
 {
  "name": "Rex McGregor",
  "role": "Veteran hunter",
  "faction": "The Iron Sights",
  "where": "Rackline Roost, the Badlands",
  "book": "Iron Road",
  "page": 120,
  "group": "Rackline Roost (Badlands)",
  "desc": "Male, 56 years. It’s true that the years are starting to catch up to him, but he acts like a man half his age. He stands as tall and muscular as he did in his fighting days. Despite the long periods of time spent in the wilderness, his light-brown head is shaved tight and his graying-white beard stays trimmed, reflecting his dedication to exactness and precision. Two decorated and very upgraded pistols are carried high on an expensive belt. Above his worn, black combat fatigues, Rex proudly wears expertly crafted remnants of an Opal Beetle’s armored shell on his chest and shoulders - a memory of his first hunt after joining the Iron Sights guild so long ago. Once a captain in an army now forgotten, Rex has shifted the focus of his training to hunting, gunsmithing, and passing on his experience and wealth of knowledge to those who are new to the West. He is an old friend of Harrison Bishop’s, and they share common goals. With such high expectations, Rex isn’t an easy friend to make. However, once you’ve proven yourself with integrity, there’s no one in the West more loyal."
 },
 {
  "name": "Shikoba",
  "role": "Firekeeper",
  "faction": "The Iron Sights",
  "where": "Shikoba’s Fire Circle, Rackline Roost",
  "book": "Iron Road",
  "page": 126,
  "group": "Rackline Roost (Badlands)",
  "desc": "Male, 67 years. A long-haired Native elder wrapped in wolf pelts, always seated cross-legged at the edge of the fire. He keeps the fire burning and asks thought provoking questions."
 },
 {
  "name": "Darnell Pike",
  "role": "Cartographer",
  "faction": "The Iron Sights",
  "where": "Mapmaker’s Library, Rackline Roost",
  "book": "Iron Road",
  "page": 126,
  "group": "Rackline Roost (Badlands)",
  "desc": "Male, 44 years. A former surveyor with the posture of an experienced soldier. Keeps the camp’s routes updated with intense accuracy. No one’s gotten lost following his trails… not again."
 },
 {
  "name": "Maela Vance",
  "role": "Blacksmith",
  "faction": "The Iron Sights",
  "where": "Nightingale Forge & Mercantile, Rackline Roost",
  "book": "Iron Road",
  "page": 128,
  "group": "Rackline Roost (Badlands)",
  "desc": "Female, 38 years. Strong, broad-shoulders, soot-streaked skin, and a child-like face. Always has a piece of jerky hanging out the side of her mouth to free up her hands for meticulous electrical work, yet can talk till the cows come home."
 },
 {
  "name": "Tim Delroy",
  "role": "Watchman",
  "faction": "The Iron Sights",
  "where": "Crow’s Nest, Rackline Roost",
  "book": "Iron Road",
  "page": 129,
  "group": "Rackline Roost (Badlands)",
  "desc": "Male, 17 years. A quirky but sharp-eyed teen with a crooked smile and a short cloak made of bird feathers. Prefers taking watch alone in the watchtower away from the noises and people in camp."
 },
 {
  "name": "Holly “Stitch” Greer",
  "role": "Repairwoman (medic)",
  "faction": "The Iron Sights",
  "where": "Repair Tent, Rackline Roost",
  "book": "Iron Road",
  "page": 129,
  "group": "Rackline Roost (Badlands)",
  "desc": "Female, 54 years. Calm and steady-handed, with sleeves always rolled to her elbows and a spot of someone else’s dried blood somewhere. Has one glass eye and a laugh that puts even gut-shot hunters at ease."
 },
 {
  "name": "Donnie Rooker",
  "role": "Stable hand",
  "faction": "The Iron Sights",
  "where": "Stables, Rackline Roost",
  "book": "Iron Road",
  "page": 130,
  "group": "Rackline Roost (Badlands)",
  "desc": "Male, 21 years. Twine hat with 6 too many feathers tucked into the band. Sings goofy lullabies to the horses at night and gossips to them about the rumors and conversations he hears around camp."
 },
 {
  "name": "Fiadh “Fee” Velchul",
  "role": "Doctor",
  "faction": "Frontier Conservation Society",
  "where": "The ruins of Dodge",
  "book": "Iron Road",
  "page": 143,
  "group": "Dodge & Colorado Springs",
  "desc": "Fiadh “Fee” Velchul didn’t come out West for quiet work behind clinic walls. After working years in the Chicago stockyards and an apothecary, she learned early that medicine means getting your hands dirty and even risking your own life. A dreadful bear attack left Fee with a mangled right arm and scars on an otherwise beautiful face as stark reminders of just how dangerous the West can truly be. As a member of the Frontier Conservation Society, she’s searching the wilderness for new cures, but right now, Fee just wants to keep these people alive. The explosion–or whatever it was–left too many wounded with not enough time.",
  "hooks": "Help Fee find her supply crate back on the train that has First Aid Kits to help the injured here. She may let you have a couple to keep. Fee saw a child earlier that ran away in fear when she tried to approach him. Find the kid and make sure he gets to his parents.",
  "profile": {
   "name": "Fiadh “Fee” Velchul",
   "book": "Iron Road",
   "page": 144,
   "health": "10",
   "defense": "-",
   "speed": "Normal",
   "charm": "2B1G",
   "finesse": "1B2G",
   "intuition": "4G",
   "nerve": "2B",
   "talents": "Intuition, First Aid",
   "abilities": [
    "Personal Apothecary. Fee has a vial for any Status that can afflict a person. Relieve 1 Status Severity for 1 player within Short Range.",
    "Perfect Remedy (1/day). You can always trust Fee’s prescription. Remove any Status’ lasting effect from a person."
   ],
   "attacks": [
    {
     "weapon": "Brig & Jones Co. - Field Model 330",
     "ranges": [
      {
       "range": "Arm's Reach",
       "grit": "1",
       "damage": "1B"
      },
      {
       "range": "Short Range",
       "grit": "1",
       "damage": "1B1G"
      },
      {
       "range": "Long Range",
       "grit": "1",
       "damage": "1B"
      }
     ],
     "notes": "Upgrades: L1 Accuracy"
    }
   ],
   "items": ""
  }
 },
 {
  "name": "Owen Brinkerhoff",
  "role": "Citizen mechanic",
  "faction": "",
  "where": "Town Hall Forstall, Dodge",
  "book": "Iron Road",
  "page": 146,
  "group": "Dodge & Colorado Springs",
  "desc": "Male, 31 years. Rugged in build but soft around the edges. Talks to himself while he works (half encouragement, half self-doubt). He’s got a habit of squinting when he thinks, and let’s just say he’s been squinting a lot as he fiddles with the Scrap and wires."
 },
 {
  "name": "Isabel “La Bomba” Ortega",
  "role": "Young prospector",
  "faction": "Prospectors Guild",
  "where": "Dodge",
  "book": "Iron Road",
  "page": 150,
  "group": "Dodge & Colorado Springs",
  "desc": "Female, 23 years. Isabel is short and strong with curly black hair and a childlike sense of mischief and excitement on her round face. She wears a faded leather jacket that’s two sizes too big for her, covered in patches and scorch marks, with extra pockets sewn into the inside. A thick belt hangs from her hips, carrying hammers, drill bits, and several sticks of dynamite like a bandolier filled with ammunition. “La Bomba” seems to always have a stick of dynamite in her hands, twirling it between her fingers or tapping it against her leg as she talks. She treats it like a casual object, despite the danger it poses. Everything about Isabel screams confidence and danger, but with a warm charm that draws people closer. She’s colorful, loud, and unafraid to be the center of attention. She lost her father in a cave-in, but she lives her life with the same excitement and passion for discovery as he did."
 },
 {
  "name": "Pip Schäfer",
  "role": "Lead mechanic, Mech Depot",
  "faction": "",
  "where": "Mech Depot, Colorado Springs",
  "book": "Iron Road",
  "page": 168,
  "group": "Dodge & Colorado Springs",
  "desc": "The lead mechanic of the Mech Depot, a quirky individual with a thick German accent who greets customers with a jingle: “We patch, we weld, we build brand new. Welcome to the depot, how can we help you?”"
 },
 {
  "name": "Patricia Tulos",
  "role": "Tulos daughter, Deadwood",
  "faction": "The Tulos Mob",
  "where": "Deadwood; comes to Dobytown for Adda",
  "book": "Iron Road",
  "page": 114,
  "group": "The Great Plains",
  "desc": "The Tulos daughter from the Guidebook (p. 127). In Iron Road she comes to Dobytown at sunrise with Mob Enforcers to deal with Adda, and settles only for a High-Noon Duel if the posse talks her down (Charm, target 4).",
  "profile": {
   "name": "Patricia Tulos",
   "book": "Iron Road",
   "page": 114,
   "health": "10",
   "defense": "-",
   "speed": "Normal",
   "charm": "1B3G",
   "finesse": "1B2G",
   "intuition": "1B2G",
   "nerve": "2B",
   "talents": "Charm, Intuition",
   "abilities": [
    "Cunning Gambit. If Patricia rolls successfully with Charm when lying to someone, her next attack against them gains +1G."
   ],
   "attacks": [
    {
     "weapon": "Lockheed Iron Works - EG-92 “Mediator”",
     "ranges": [
      {
       "range": "Short Range",
       "grit": "1",
       "damage": "1B2G"
      },
      {
       "range": "Long Range",
       "grit": "1",
       "damage": "1B"
      }
     ],
     "notes": "Upgrades: L2 Accuracy, L2 Damage"
    },
    {
     "weapon": "Handcraft - Whip",
     "ranges": [
      {
       "range": "Arm's Reach",
       "grit": "3",
       "damage": "4B"
      }
     ],
     "notes": "Upgrades: L2 Damage"
    }
   ],
   "items": ""
  }
 }
];

export const X_GENERIC = [
 {
  "name": "Tin Head Outlaw",
  "book": "Iron Road",
  "page": 95,
  "health": "6",
  "defense": "1G",
  "speed": "Slow",
  "charm": "3B",
  "finesse": "2B",
  "intuition": "2B",
  "nerve": "3B",
  "talents": "Pistols",
  "abilities": [
   "Threatening Presence. The Bandit gets +1G to Charm rolls made to intimidate at gunpoint."
  ],
  "attacks": [
   {
    "weapon": "Brig & Jones Co - Model 310",
    "ranges": [
     {
      "range": "Arm's Reach",
      "grit": "2",
      "damage": "1B"
     },
     {
      "range": "Short Range",
      "grit": "2",
      "damage": "1B1G"
     }
    ],
    "notes": ""
   },
   {
    "weapon": "Eastling Arsenal - Fixed-Blade",
    "ranges": [
     {
      "range": "Arm's Reach",
      "grit": "2",
      "damage": "1B1G"
     },
     {
      "range": "Short Range",
      "grit": "2",
      "damage": "1B (thrown)"
     }
    ],
    "notes": ""
   }
  ],
  "items": "Metal flask of whiskey, leather wallet with $3.75, saddlebags (First Aid Kit, rope, tarp, three Knockback rounds)."
 },
 {
  "name": "Rookie Rosewood Agent",
  "book": "Iron Road",
  "page": 96,
  "health": "6",
  "defense": "-",
  "speed": "Normal",
  "charm": "4B",
  "finesse": "2B",
  "intuition": "3B",
  "nerve": "2B",
  "talents": "Charm, Intuition",
  "abilities": [
   "Gut Feeling. After rolling with Intuition, the Rookie can reroll 1 die of their choice."
  ],
  "attacks": [
   {
    "weapon": "Lockheed Iron Works - HJ-87 “Negotiator”",
    "ranges": [
     {
      "range": "Arm's Reach",
      "grit": "2",
      "damage": "1B"
     },
     {
      "range": "Short Range",
      "grit": "2",
      "damage": "2G"
     }
    ],
    "notes": ""
   },
   {
    "weapon": "Standard Issue - Nightstick",
    "ranges": [
     {
      "range": "Arm's Reach",
      "grit": "3",
      "damage": "2G"
     },
     {
      "range": "Short Range",
      "grit": "3",
      "damage": "1B (thrown)"
     }
    ],
    "notes": ""
   }
  ],
  "items": "Rosewood badge and papers, an interrogation notebook."
 },
 {
  "name": "Tulos Enforcer",
  "book": "Iron Road",
  "page": 114,
  "health": "9",
  "defense": "-",
  "speed": "Normal",
  "charm": "2B",
  "finesse": "2B1G",
  "intuition": "2B",
  "nerve": "3G",
  "talents": "Melee Weapons",
  "abilities": [
   "Snake Eyes. When successful in using an attack that inflicts the Poisoned Status, gain an additional +1 to the Severity of that status."
  ],
  "attacks": [
   {
    "weapon": "Handcraft - Brass Knuckles",
    "ranges": [
     {
      "range": "Arm's Reach",
      "grit": "2",
      "damage": "2G"
     }
    ],
    "notes": ""
   },
   {
    "weapon": "Eastling Arsenal - Colorado Toothpick",
    "ranges": [
     {
      "range": "Arm's Reach",
      "grit": "2",
      "damage": "2G"
     }
    ],
    "notes": ""
   },
   {
    "weapon": "Handcraft - Blowgun",
    "ranges": [
     {
      "range": "Short Range",
      "grit": "3",
      "damage": "2B + Poisoned [1]"
     },
     {
      "range": "Long Range",
      "grit": "3",
      "damage": "1B + Poisoned [1]"
     }
    ],
    "notes": "Upgrades: Poison Darts"
   }
  ],
  "items": ""
 }
];

// What the books add about the Guidebook factions (shown on the Warden's Factions panel).
export const X_FACTION_NOTES = {
 "The Iron Sights": [
  {
   "book": "East Portal",
   "page": 9,
   "text": "Along with the mineral riches of the Dark, a new treasure trove of critters was discovered down there. Everything from the pearlescent shells of the illusive Opal Beetles to the unique venoms of the various glowing cave worms have become sought after items found more easily in East Portal. Cave hunting is extremely dangerous and more mentally taxing than above ground hunts. Insects lack the same expression of empathy that can often be found in the eyes of mammals and rodents and there is nothing worse than being killed by a bug. The group leading the way in the new frontier of cave hunting is the Iron Sights. Drawn in by the unusual difficulty and mental fortitude required to hunt underground, the Sights have made it a point of pride to overcome the subterranean world. The Iron Sights have a precarious relationship with the Prospectors Guild. Miners aren’t used to sharing the underground with anyone not carrying a pickaxe or drill, but cooperation is often necessary for both parties to get what they want. You can speak with Job Tarryall in the Iron Sights Den, or Sally Severance in Gunnwater Arms."
  },
  {
   "book": "Iron Road",
   "page": 120,
   "text": "The players have found refuge amongst the Iron Sights, a guild of hunters whose ranks are open to those who prove themselves with trophies or monster kills. The Iron Sights are honorbound, however, and don’t turn away anyone in need of aid, offering basic amenities to the travelers."
  }
 ],
 "Prospectors Guild": [
  {
   "book": "East Portal",
   "page": 10,
   "text": "After the discovery of the cavern, and because of the pressure of word already getting out, the original Prospectors Guild members began to take more and more risks, despite the dangers, and were killed off one by one by the swarms that ensued after mining began in the cavern. All except one. The old miner named Guy Mansfield waits and watches at the entrance of the cavern. Ensuring that any miners who seek their fortune are well equipped enough to face the horrors inside. He has a lot of mixed feelings about the cave and believes it’s his duty to keep people safe. You can speak with Guy and Jeffrey at the East Portal Mine, or with John at the Processing Mill."
  }
 ],
 "Hogwild Gang": [
  {
   "book": "East Portal",
   "page": 11,
   "text": "Given the spirit of independence and freedom in the west, it’s no surprise that East Portal doesn’t mind the presence of the Hogwilds, even though they can get out of hand sometimes. Better to have too much freedom than not enough. The Hogwilds enjoy access into East Portal. There aren’t any Rosewoods here to bother them. They also feel that their presence in East Portal adds to the insult against the railroad. For the Hogwilds, East Portal represents rebellion against the train lords. You can speak with Gunther, Gregory, and Thomas at the Black Canyon Mule Depot."
  },
  {
   "book": "Iron Road",
   "page": 168,
   "text": "Alpha is the leader of the Hogwild Gang, a dangerous group for hire that prefers anarchy with a capital “A”. He remarks at how the posse handled their encounters with the Tulos Mob, whom he dislikes for competitive reasons, and the Rosewoods who he particularly dislikes for trying to create order in what should only be free. Alpha wants the posse to think about joining the Hogwilds to help him “keep the West free” and make some money while they do it. Alpha isn’t here for long in Colorado Springs, but he’s hoping to cause some trouble for the Rosewood sheriff and railroad in this town. Stealing some of the railroad’s Scrap would look bad on the Rosewoods and give the Hogwilds some extra supplies to upgrade their equipment with. Does the posse care to get involved and make a few extra bucks?"
  }
 ],
 "The Tulos Mob": [
  {
   "book": "Iron Road",
   "page": 110,
   "text": "Months ago, Dobytown was attacked by a wild gang of outlaws with incredible numbers. Most of the permanent population suffered in some way–lives were lost, items were stolen, and property was destroyed. The Tulos family swooped in to bring the town out of the ashes. They provide security, supply chains, and steady work in town through contracts with many of the itinerant and stationary workers alike. To some in town, this aid is welcome and received. They say, “The Tulos take a decent cut of profit from our work, it’s true. But the last time there were raiders or a monster came through town, they handled it.” Others agree that this protection comes with strings attached, saying, “the people of Dobytown are oppressed by a mob. There’s no room for growth because of the Tulos’ complete dominance of the area.” It’s almost guaranteed that the gang that destroyed the town before the Tulos came in were paid by the Tulos to create a power vacuum scenario, giving them an opportunity to move in."
  }
 ],
 "U.S. Railroad Co.": [
  {
   "book": "Iron Road",
   "page": 2,
   "text": "The United States Railroad Company is plowing its way across the west, buying up property deeds and carving into the landscape in order to lay their lines. They view the West in a similar way as many of the people do, which is an open landscape of discovery and opportunity, although their goals and intentions with it are different. While people who believe in western freedom fight for independence, the Railroad Co. (as well as their federal investor) seeks to take advantage of the wide-open land and maintain a structured organization. The Railroad Co. uses its abundance of resources, manpower, and heavy weaponry to fight its way across the West with little regard for anything or anyone that stands in their way. While their heavy weapons make them practically unbeatable in the plains, tight winding canyons drastically reduce their range and visibility. 3 Welcome to the heartland Tunneling is also immensely dangerous due to what you might unearth, making the Rockies a formidable obstacle in their race to the West Coast. It has basically slowed them down to a standstill. Even so, the Railroad Co. refuses to use Forstalls."
  },
  {
   "book": "East Portal",
   "page": 8,
   "text": "While other Factions may occasionally be present, the Rosewood Security Agency and U.S. Railroad Co. are absolutely not welcome here, much to the delight of the Hogwilds."
  }
 ],
 "The Rosewood Security Agency": [
  {
   "book": "East Portal",
   "page": 8,
   "text": "While other Factions may occasionally be present, the Rosewood Security Agency and U.S. Railroad Co. are absolutely not welcome here, much to the delight of the Hogwilds."
  }
 ],
 "Frontier Conservation Society": [
  {
   "book": "Iron Road",
   "page": 62,
   "text": "In Omaha, the Frontier Conservation Society hosts the Traveling Carnival of Wild Oddities and Western Curiosities, dubbed the “The Uncivilized West” by wealthy Easterners. Their goal is to raise funds for their research and awareness of the amazing frontier."
  }
 ]
};
