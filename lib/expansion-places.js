// The expansion books on the Map: the East Portal town map (East Portal Setting Guide, "Town Map" p. vi; places A–EE),
// Black Canyon points of interest and Rackline Roost on the West map, and Iron Road "places here" for Guidebook towns.
// Generated from the books' text by scratchpad placegen.py. Town-map x/y are pixels on /img/east-portal-map.webp.
export const EP_TOWN = {
 "size": {
  "w": 1200,
  "h": 1800
 },
 "img": "/img/east-portal-map.webp",
 "places": [
  {
   "id": "ep-a",
   "letter": "A",
   "name": "City Limits Welcome Sign",
   "kind": "spot",
   "x": 552,
   "y": 1604,
   "page": 18,
   "book": "East Portal",
   "text": "“Welcome to East Portal! Heart of the Black Canyon,” reads the wooden sign, and in bold letters underneath, “NO SWEEPING. TURN OFF YOUR FORSTALL!” A drawing of a skull and crossbones accompanies the warning. The Hogwild’s trademark symbol has been scratched into the wood. You’re close enough now that you can make out the different shapes of the tightly organized buildings and how the river rushes through its center. The faint hum of electricity and the calls between miners can just barely be heard over the sounds of the river echoing off the canyon walls.",
   "people": [],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-b",
   "letter": "B",
   "name": "The Lumberyard",
   "kind": "spot",
   "x": 660,
   "y": 1436,
   "page": 18,
   "book": "East Portal",
   "text": "Logs are being carried into the town by Mules, their four legs traversing the canyon with ease. Once they deposit their loads into the lumberyard, workers begin sawing the trees into useful materials. Electric saws make quick work of the large logs. Dust and the sweet aromas of freshly cut wood fill the air.",
   "people": [],
   "shop": "",
   "rumors": [
    "“Some folks have been feelin’ tremors ‘round the canyon. The Sheriff says it’s just a cave-in. The old-timers reckon something big is waking up below. Hope it ain’t no Antlion.”",
    "“The canyon wall has a massive carving no one remembers ever bein’ there. Some say it’s been uncovered by the wind, others think it appeared overnight. So help me if it’s them darn kids again.”",
    "“Did ya hear ‘bout them folks up north? While cuttin’ down trees they’s discovered a grove of pines that be fightin’ back somehow.”"
   ],
   "tables": []
  },
  {
   "id": "ep-c",
   "letter": "C",
   "name": "The Scrapyard",
   "kind": "spot",
   "x": 900,
   "y": 1336,
   "page": 19,
   "book": "East Portal",
   "text": "Located on the far side of the river, the scrapyard allows you to sell and buy old parts. Things get wrecked and repurposed often in the West, providing the opportunity to make money off scrap collection or rummage through what they have for bits and pieces of old tech. You might be surprised at what you find here. Almost anything can be given a second life.",
   "people": [],
   "shop": "East Portal · Scrapyard",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-d",
   "letter": "D",
   "name": "Bunkhouse",
   "kind": "spot",
   "x": 1136,
   "y": 1116,
   "page": 19,
   "book": "East Portal",
   "text": "A simple wooden structure filled with bunks for the town’s laborers to rest in. It’s only lightly-maintained by those who live there including miners, ranch hands, and seasonal workers. Certainly not as comfortable as the Painted Spade Hotel, but it’ll do for anyone who needs a safe place to lay their head.",
   "people": [],
   "shop": "East Portal · Bunkhouse",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-e",
   "letter": "E",
   "name": "Mess Hall",
   "kind": "spot",
   "x": 960,
   "y": 896,
   "page": 20,
   "book": "East Portal",
   "text": "Next to the Bunkhouse is a small cafeteria for the workers to grab humble meals between their work shifts. Wooden chairs surround round tables to fill a large room. Pots and pans of bland soups and cheap foods are brought from the kitchen to longer tables that line the perimeter. It’s a good place for a quick bite and a great place to gather info from the locals.",
   "people": [],
   "shop": "East Portal · Mess Hall",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-f",
   "letter": "F",
   "name": "The Bridge",
   "kind": "spot",
   "x": 802,
   "y": 874,
   "page": 20,
   "book": "East Portal",
   "text": "Located in the center of the canyon, spanning the river is the Bridge. It’s wide enough and reinforced enough to accommodate most vehicle crossings, which are rare, but not unheard of. The steep canyon descent is what deters most large, legged vehicles. Fishing from the bridge is a common occurrence as the visibility from above is better than on the bank of the river and large fish like to hide in the shadow of the bridge. Both ends of the bridge are equipped with iron mesh that can be electrified in the event of main Forstall failure.",
   "people": [],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-g",
   "letter": "G",
   "name": "Sheriff’s Office",
   "kind": "spot",
   "x": 746,
   "y": 780,
   "page": 21,
   "book": "East Portal",
   "text": "The space inside the sheriff’s office is mostly taken up by the three indoor jail cells. Samuel gave up part of his office to make room for the third cell. The place is spotless and has brick flooring rather than typical wooden floorboards. The locks aren’t the most difficult to crack, but the cells are wired up to an alarm. If a prisoner was to attempt an escape, they’d need to consider that as well.",
   "people": [
    "Samuel Burnside"
   ],
   "shop": "",
   "rumors": [],
   "tables": [
    "ep-sheriff"
   ]
  },
  {
   "id": "ep-h",
   "letter": "H",
   "name": "The River Bank",
   "kind": "spot",
   "x": 600,
   "y": 750,
   "page": 22,
   "book": "East Portal",
   "text": "One of the nicer buildings in town, the Bank has a high ceiling with tall walls covered in expensive wallpaper and ornate trim. Given the unique technologies of the WIW, banks tend to be quite secure, implementing electrified mats and cages to deter any would-be robbers. That being said, some people will always think it’s worth the risk.",
   "people": [
    "Robert Kremling"
   ],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-i",
   "letter": "I",
   "name": "Painted Spade Hotel",
   "kind": "spot",
   "x": 524,
   "y": 696,
   "page": 23,
   "book": "East Portal",
   "text": "The hotel is tastefully decorated and while not as ornate as the hotels in bigger towns, the owner is attentive to detail and it shows. The lobby is small, but has a nice waiting area with a sign warning guests to not sit on the sofa if they’re muddy, wet, dirty, dusty, bloody, soiled, or drunk. There’s a key rack behind the check in counter with eight hooks. There are only four rooms. The second row are spare keys added to make the hotel seem larger.",
   "people": [
    "Hannah Perry"
   ],
   "shop": "East Portal · Painted Spade Hotel",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-j",
   "letter": "J",
   "name": "Doctor’s Office",
   "kind": "spot",
   "x": 550,
   "y": 470,
   "page": 28,
   "book": "East Portal",
   "text": "The doctor’s office has a bench on the patio for waiting patients. Inside, there’s a single long room with an ambiguous smell of trauma that causes everyone to feel nervous and queasy. The room is divided by what used to be white curtains hung on lines string from wall to wall. Medical utensil racks are spread throughout.",
   "people": [
    "Dr. Stephen Brogan-Hoff"
   ],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-k",
   "letter": "K",
   "name": "Waterton Mortuary",
   "kind": "spot",
   "x": 816,
   "y": 426,
   "page": 29,
   "book": "East Portal",
   "text": "The serene yet somber front parlor is used for funerals, lightly decorated with floral arrangements and portraits of lost loved ones. A discrete door leads to the work room where bodies are prepared for viewing. A large wooden table stands in the center of the room, stained in dark colors. Various tools of the coroner’s trade and jars of preserving fluids line several shelves. Stacked against the back wall are wooden coffins of various sizes.",
   "people": [
    "Isabelle Waterton"
   ],
   "shop": "East Portal · Waterton Mortuary",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-l",
   "letter": "L",
   "name": "First Chapel of East Portal",
   "kind": "spot",
   "x": 640,
   "y": 344,
   "page": 30,
   "book": "East Portal",
   "text": "A wood cross adorns the front gable of the large chapel. Two wooden doors open to reveal rows of benches and soft light pouring in through opaque windows. At the far end of the chapel is a shrine to Christ and a podium for the pastor to speak from. Several hymnals and Bibles rest on the pews. A serene reverence washes over visitors as they enter, and they leave with hope in their hearts.",
   "people": [
    "Rev. Jon Dawson"
   ],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-m",
   "letter": "M",
   "name": "Schoolhouse",
   "kind": "spot",
   "x": 436,
   "y": 244,
   "page": 31,
   "book": "East Portal",
   "text": "A small brass bell next to the door signals children to return for classes. Not only does the school teach children to read and write, but it also prepares them with the knowledge necessary to survive in the West. The school’s resources are limited but the children are happy to be there. They gather inside around small writing tables and between short bookshelves, playing and singing as they learn in safety.",
   "people": [
    "Mary Limon"
   ],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-n",
   "letter": "N",
   "name": "Forstall Workshop",
   "kind": "spot",
   "x": 330,
   "y": 344,
   "page": 32,
   "book": "East Portal",
   "text": "Given their importance, one of the highest paid positions funded by the town’s tax dollars is the Senior Forstall Mechanic. The Forstall center is likewise very advanced and modern in comparison with the other town buildings. A collection of machines run loudly in the back and up front is the repairman’s workshop. There’s the senior’s desk and two other workstations for the apprentices.",
   "people": [
    "Ivan Ward"
   ],
   "shop": "East Portal · Forstall Workshop (Ivan Ward)",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-o",
   "letter": "O",
   "name": "Title Office",
   "kind": "spot",
   "x": 260,
   "y": 396,
   "page": 33,
   "book": "East Portal",
   "text": "Located in a small room adjoining town hall, the Title Office is where you can go to purchase properties in and around East Portal. Not much to speak of in the small room aside from filing cabinets and a nice desk for the title officer with a chair on either side.",
   "people": [
    "Victor Finley"
   ],
   "shop": "East Portal · Title Office",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-p",
   "letter": "P",
   "name": "Town Hall",
   "kind": "spot",
   "x": 212,
   "y": 476,
   "page": 34,
   "book": "East Portal",
   "text": "The mayor’s office, located on the second floor facing the street, feels like an afterthought. That’s because it is. The original office is at the other end of the building nestled against the cliff face. The lack of natural light was giving the usually jovial mayor a bad mood, so he had a new office made and turned the original into a storage room. The Fostall on the clock tower is the highest point in town. The hall’s multiple balconies are equipped with machine guns paid for by the town’s general defense fund.",
   "people": [
    "Oliver Fairfield"
   ],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-q",
   "letter": "Q",
   "name": "Delgado Leather Goods",
   "kind": "spot",
   "x": 144,
   "y": 536,
   "page": 35,
   "book": "East Portal",
   "text": "Nestled against the cliffside next to the Town Hall is the best shop for leather goods you’ll ever find. At least, some townsfolk boast that the quality and craftsmanship is better than anything they’ve experienced back east. Maybe it’s the tanner, maybe it’s the technique, or maybe it’s the monster hide, but it’s certainly not the establishment. The wooden planks supporting the roof lack structural integrity and lean to one side. Luckily, they’ve been reinforced with a combination of scrap metal and leather bands, the tanner’s speciality.",
   "people": [
    "José Delgado"
   ],
   "shop": "East Portal · Delgado Leather Goods",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-r",
   "letter": "R",
   "name": "Barry’s Barbershop",
   "kind": "spot",
   "x": 114,
   "y": 670,
   "page": 38,
   "book": "East Portal",
   "text": "Barry’s is a narrow one chair shop decorated with a few hanging musical instruments, crafts, and obscure artwork. There’s a small stairwell in the back leading up to Barry’s small studio apartment upstairs.",
   "people": [
    "Barry Tungsten"
   ],
   "shop": "East Portal · Barry’s Barbershop",
   "rumors": [],
   "tables": [
    "ep-barry"
   ]
  },
  {
   "id": "ep-s",
   "letter": "S",
   "name": "Gunnwater Arms",
   "kind": "spot",
   "x": 88,
   "y": 786,
   "page": 40,
   "book": "East Portal",
   "text": "A partitioned-off wing of the Iron Sights Den. The shop is small and unimpressive. There’s a rifle rack behind the counter with a few long guns to choose from. The glass display case in the counter has equally few pistols to choose from. It’s clear the main source of business comes from the repair and upgrade room in the back.",
   "people": [
    "Sally Severance"
   ],
   "shop": "East Portal · Gunnwater Arms",
   "rumors": [],
   "tables": [
    "ep-sally"
   ]
  },
  {
   "id": "ep-t",
   "letter": "T",
   "name": "Iron Sights Den",
   "kind": "spot",
   "x": 262,
   "y": 814,
   "page": 43,
   "book": "East Portal",
   "text": "A separate entrance to the side of Gunnwater Arms leads curious visitors down a long hall to a big open room. The back wall is clearly carved into the cliff side and decorated with taxidermied monster trophies of various sizes. The most notable of which is a Golden Bear towering over a throne of antlers and bone-carved side tables. Lounged hunters take a break here with feet propped up, heads tipped back, and a favorable drink in their hands. Their stories flow without end.",
   "people": [
    "Job Tarryall"
   ],
   "shop": "",
   "rumors": [
    "“One of ours returned with a trophy horn the size of a man. Said the beast it came from is still out there, wounded and angry.”",
    "“A gunslinger rode in talkin’ ‘bout a monster up in the hills that mimics human voices. No one believed him but soon folks started going missin’. I think it was the trigger-happy gunslinger that done it.”",
    "“They say a hunter brought back a beast’s head last week. The thing had eyes that shot blood and tough spiked skin. The Sights paid him a fortune.”"
   ],
   "tables": [
    "ep-job"
   ]
  },
  {
   "id": "ep-u",
   "letter": "U",
   "name": "Wilde Critters Taxidermy",
   "kind": "spot",
   "x": 86,
   "y": 974,
   "page": 45,
   "book": "East Portal",
   "text": "It’s exactly what you’d expect from a taxidermist in a monster infested West. The same tools and chemicals, but bigger tools and larger quantities of chemicals. There are different tables and workstations depending on the size of the critter, with a large hoist that can be moved between each station.",
   "people": [
    "James Wilde"
   ],
   "shop": "East Portal · Wilde Critters Taxidermy",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-v",
   "letter": "V",
   "name": "Black Canyon Mule Depot",
   "kind": "spot",
   "x": 334,
   "y": 1124,
   "page": 48,
   "book": "East Portal",
   "text": "With a single rolling bay door and an outdoor hoist frame, this small Mule depot is not made to handle repairs on anything larger than a schooner. Out back is a small fenced in lot with a freshly converted Mule and repair parts for sale. A nondescript door behind the counter of the Depot opens into a stairwell that descends down to the secret Hogwild hideout. While the town is certainly aware of the Hogwild Gang and their members, the secret room below allows for them to plot and hide what they don’t want others to know.",
   "people": [
    "Greg “Gearbox” Freust",
    "Thomas “Four-eyes” Thompson",
    "Gunther “Bulldog” Freust"
   ],
   "shop": "East Portal · Black Canyon Mule Depot",
   "rumors": [],
   "tables": [
    "ep-foureyes",
    "ep-bulldog"
   ]
  },
  {
   "id": "ep-w",
   "letter": "W",
   "name": "Appendage Replacement Shop",
   "kind": "spot",
   "x": 420,
   "y": 1056,
   "page": 51,
   "book": "East Portal",
   "text": "Cleaner and more sterile than even the doctor’s facility, the Appendage Replacement Shop contains technology reflective of a wealthy and successful business. In the West, working limbs are often a matter of life and death. Unless you want to stay cooped as a beggar in a town for the rest of your life, you want your arms and legs. The shop has a large operation table surrounded by mechanical assistant arms built by James himself. There’s a large bay door at the back and a covered area for horse repairs. Good horses are hard to come by and it’s not a bad look if you can afford to spend money like that on a horse.",
   "people": [
    "James Pimsle"
   ],
   "shop": "East Portal · Appendage Replacement Shop",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-x",
   "letter": "X",
   "name": "Portal General",
   "kind": "spot",
   "x": 590,
   "y": 948,
   "page": 52,
   "book": "East Portal",
   "text": "Located in the center of the town, the general store is always hopping with activity and life. Originally, the building was constructed as a small home and was purchased by the Dawsons, who made a number of additions including a store front. Prices here vary from other towns. Some resources are more expensive because they have to be hauled over great distances. Others are cheaper and more readily available in the area.",
   "people": [
    "Martha Dawson"
   ],
   "shop": "East Portal · Portal General",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-y",
   "letter": "Y",
   "name": "Better Gold Saloon",
   "kind": "spot",
   "x": 342,
   "y": 862,
   "page": 56,
   "book": "East Portal",
   "text": "The double batwing doors open up to a large hall. There’s a small but well stocked bar on the back left wall. To the right lies a small stage and a piano. A central staircase leads up to a mezzanine with extra seating and a couple small side rooms. The walls of the saloon are decorated with the trophies of large creatures and kerosene sconces. There’s always a group ready to take your money at the card table.",
   "people": [
    "Jim Van Grim"
   ],
   "shop": "East Portal · Better Gold Saloon",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-z",
   "letter": "Z",
   "name": "Community Board",
   "kind": "spot",
   "x": 400,
   "y": 662,
   "page": 57,
   "book": "East Portal",
   "text": "Right in the busiest part of town is the community board. Here you’ll find general announcements from the mayor’s office, job listings, and local advertisements. (Its job postings are in the Journal’s New quest form, “From the job boards”.)",
   "people": [],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-aa",
   "letter": "AA",
   "name": "Storage Shed",
   "kind": "spot",
   "x": 718,
   "y": 1128,
   "page": 58,
   "book": "East Portal",
   "text": "The town’s storage shed is kept locked up and only the Mayor and Sheriff have keys to access it. Inside the shed are preserved foods and medicines in case the town ever has a dire need. There’s ample space in the shed for anything large that might need a secret place to hide. The Sheriff checks the shed frequently for critters that may be trying to find an easy meal.",
   "people": [],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-bb",
   "letter": "BB",
   "name": "Watchtower",
   "kind": "spot",
   "x": 438,
   "y": 1366,
   "page": 58,
   "book": "East Portal",
   "text": "Guards take shifts watching from high up on this watchtower. A single ladder ascends to the top where you can find a rudimentary flashlight, a kerosene lantern, and a Lockheed Iron Works - OT-49 “Defender” rifle with a level-2 optic upgrade scope and a level-1 accuracy upgrade stock. The guards watch the river, canyon entries, and the sky for signs of any possible dangers. They wind the crank on a loud alarm if the townspeople should prepare to defend the town.",
   "people": [],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-cc",
   "letter": "CC",
   "name": "The Dam",
   "kind": "spot",
   "x": 164,
   "y": 1466,
   "page": 58,
   "book": "East Portal",
   "text": "A wooden dam holds the Gunnison River on its natural course rather than spilling into the opening of the East Portal Mine. Metal sheets have been patched on to the logs to reinforce the quick work that was done years ago to retain the river’s bank after creation of the mine. A walkway along the top of the short dam is a common spot for miners to take a break while they watch the sun’s light shimmer on the water.",
   "people": [],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-dd",
   "letter": "DD",
   "name": "Processing Mill",
   "kind": "spot",
   "x": 364,
   "y": 1570,
   "page": 59,
   "book": "East Portal",
   "text": "The Processing Mill has an upper floor with access limited to members of the Prospectors Guild. The actual mill is busy with workers operating machinery to transform the mined ore into valuable minerals. Some workers are recording and packing the ore to be transported and sold. On the Prospectors Guild’s floor, electric fans blow to cool a large central room decorated with lavish furniture. A small bar with various spirits waits in the corner. A map of the East Portal Mine lies on a large table while a map of the United States hangs on the wall. Different scribbles on both maps mark areas where the Prospectors Guild holds interest. A large circle surrounds an area of the mine’s map, labeled The Dark.",
   "people": [
    "John Harbener"
   ],
   "shop": "",
   "rumors": [
    "“A prospector says she found a fossil bigger than a wagon wheel. For whatever reason, she’s tried to keep it a secret, and no one else has seen the thing.”",
    "“The Hogwilds claim The Dark is home to a massive monster that only resurfaces after its hundred-year hibernation. Some say they’re just trying to scare the miners away.”",
    "“Some folks reckon The Dark’s got a second entrance beyond the canyon. Problem is, the last crew that went in never came out.”"
   ],
   "tables": [
    "ep-john"
   ]
  },
  {
   "id": "ep-ee",
   "letter": "EE",
   "name": "East Portal Mine",
   "kind": "spot",
   "x": 134,
   "y": 1670,
   "page": 61,
   "book": "East Portal",
   "text": "What was originally the water tunnel has been repurposed and named the East Portal Mine. The man-made portion of the mine is a long straight tunnel with a very shallow grade downward. After about a thousand feet, the tunnel breaks into a large cavern filled with a darkness, cold and heavy. Faint glows of long thin worms hang from the ceilings while low growls echo from unknown monsters hidden beyond this point. The townsfolk fear that the worst and most vicious monsters make their homes deep within “The Dark”.",
   "people": [
    "Guy Mansfield",
    "Jeffrey Hall"
   ],
   "shop": "",
   "rumors": [],
   "tables": [
    "ep-jeffrey"
   ]
  },
  {
   "id": "ep-lift",
   "letter": "",
   "name": "The Cable Lift",
   "kind": "spot",
   "x": 1080,
   "y": 300,
   "page": 66,
   "book": "East Portal",
   "text": "Multiple Routes in and out of the Canyon exist in any direction travelling away from East Portal. However, there is a lift system that can carry people and cargo to the top of either side. It often saves a weary explorer’s legs but more importantly, it limits exposure to potential threats thanks to the kitbashed Forstall installed on the lift. Once out of range of the Forstall’s signals wildlife and monsters are abundant. It’s said that Bloodshot Bill Kane has one hundred thousand dollars of stolen cash hidden inside a cave around here. The entrance is supposedly found midway up the cliff side but it’s very well concealed by the cracks and shadows of the rough terrain …or perhaps doesn’t really exist at all.",
   "people": [],
   "shop": "",
   "rumors": [],
   "tables": []
  },
  {
   "id": "ep-to-crystal-creek",
   "name": "To Crystal Creek",
   "kind": "exit",
   "x": 850,
   "y": 60,
   "page": 67,
   "book": "East Portal",
   "text": "Just outside of the south end of town, a rusted trailhead sign reads, “Crystal Creek Trail”. Then etched into the old weathered metal below are the words, “Beware of Vasthorn Ram”. The trail ascends the steep canyon walls through various switchbacks, leading travelers along for some breathtaking views. At the top, it follows the meandering spine of the canyon rim where a few horned beasts graze. Taking on a Vasthorn is one thing, but taking one on at the top of a sheer rock face is another. Talk about two-steppin’ with a two-ton sheep! Luckily, most folk are smart enough to take the cable lift in and out of the canyon these days.",
   "goes": "crystal-creek"
  },
  {
   "id": "ep-to-painted-wall",
   "name": "To The Painted Wall",
   "kind": "exit",
   "x": 32,
   "y": 1046,
   "page": 68,
   "book": "East Portal",
   "text": "Following the Gunnison River to the north of East Portal will eventually lead to The Painted Wall, the tallest cliff face for hundreds of miles. This landmark stands out not only for its size but also because of the light-colored veins of pinkish granite and pegmatite that look like hand-painted brushstrokes. Some explorers are convinced The Painted Wall was created by an ancient Titan that crawled the cliff sides, leaving behind an acidic residue that changed the chemical makeup of the rock. Others believe it’s sacred and often come here to ponder and meditate before heading out into the dangers of the world. But regardless of what anyone thinks, it’s a wonder and sight to behold, even in monster territory.",
   "goes": "painted-wall"
  },
  {
   "id": "ep-to-montrose",
   "name": "To Montrose",
   "kind": "exit",
   "x": 410,
   "y": 1752,
   "page": 68,
   "book": "East Portal",
   "text": "The neighboring town of Montrose is one littered with Railroad workers and Rosewoods — no Hogwilds or guild members feel very welcome. Bitterness towards the citizens of East Portal is also evident. Every time an explorer passes through Montrose to East Portal, they give the citizens looks of distrust as if expecting a quickdraw instead of a handshake. Must be the rumors Montrose is spreading. While the town is growing because of the Railroad Co.’s dominate presence, it’s been slowed by the absence of a consistent water source — a problem that would have been avoided with the completion of the East Portal tunnel. Now, lawmakers have resorted to establishing a strict water usage law during the dry seasons so steam engines would still operate properly and keep the economy alive.",
   "goes": "montrose"
  }
 ]
};

export const X_POIS = [
 {
  "id": "crystal-creek",
  "name": "Crystal Creek",
  "kind": "poi",
  "x": 1016,
  "y": 772,
  "page": 67,
  "book": "East Portal",
  "text": "Just outside of the south end of town, a rusted trailhead sign reads, “Crystal Creek Trail”. Then etched into the old weathered metal below are the words, “Beware of Vasthorn Ram”. The trail ascends the steep canyon walls through various switchbacks, leading travelers along for some breathtaking views. At the top, it follows the meandering spine of the canyon rim where a few horned beasts graze. Taking on a Vasthorn is one thing, but taking one on at the top of a sheer rock face is another. Talk about two-steppin’ with a two-ton sheep! Luckily, most folk are smart enough to take the cable lift in and out of the canyon these days."
 },
 {
  "id": "elephant-arch-mine",
  "name": "Elephant Arch Mine",
  "kind": "poi",
  "x": 968,
  "y": 806,
  "page": 67,
  "book": "East Portal",
  "text": "This iconic mine was discovered soon after East Portal was established as a settlement and is located southwest in red rock country. Its name was given by explorers because of the large archway formed from the plateau that resembles the trunk of an elephant between two flat ears. Before it was mined for valuable fluorite crystals, these explorers used it as a landmark to guide them from Santa Fe to Grand Junction to Lake Bonneville. Once the Railroad Co. was pushed out of East Portal, they purchased Elephant Mine from its founders, Everett and Sable Marsh, as a power move to compete directly with the East Portal Mine. At the time, it was less about what was found inside the mine and more about the economic and political control that would come from ownership. However, the Railroad Co. would soon hit a substantial deposit of uranium ore that would boost revenue enough to fully fund the construction of the railroad from St. Louis to San Francisco. Their buyer? The U.S. Government."
 },
 {
  "id": "gunnison-river",
  "name": "Gunnison River",
  "kind": "poi",
  "x": 982,
  "y": 742,
  "page": 67,
  "book": "East Portal",
  "text": "Flowing westward from Gunnison to Grand Junction, the Gunnison River is responsible for the deep, majestic canyons it carves so effortlessly over time. Its greenish-gray waters are home to many species of plant life, wildlife, and of course monsters. Fishermen regularly catch trout, sucker fish, and sometimes Kokanee salmon. Travelers use this river to save precious time traversing the difficult terrain of the Colorado territories, but often risk their lives as whitewater rapids try to sink their boats. The Vampire Trout sure enjoy it when that happens."
 },
 {
  "id": "painted-wall",
  "name": "The Painted Wall",
  "kind": "poi",
  "x": 996,
  "y": 724,
  "page": 68,
  "book": "East Portal",
  "text": "Following the Gunnison River to the north of East Portal will eventually lead to The Painted Wall, the tallest cliff face for hundreds of miles. This landmark stands out not only for its size but also because of the light-colored veins of pinkish granite and pegmatite that look like hand-painted brushstrokes. Some explorers are convinced The Painted Wall was created by an ancient Titan that crawled the cliff sides, leaving behind an acidic residue that changed the chemical makeup of the rock. Others believe it’s sacred and often come here to ponder and meditate before heading out into the dangers of the world. But regardless of what anyone thinks, it’s a wonder and sight to behold, even in monster territory."
 },
 {
  "id": "rackline-roost",
  "name": "Rackline Roost",
  "kind": "poi",
  "x": 1188,
  "y": 540,
  "page": 119,
  "book": "Iron Road",
  "text": "Despite being populated with hunters, trappers, and what you’d assume are rowdy mountain folk, this Iron Sights camp (dubbed “Rackline Roost”) is disciplined and well-maintained. Nothing here is flashy–only hard-won and cared for with pride. The folks here live united by their skills, quiet resilience, and a reverence for the hunt.\n\nThe players have found refuge amongst the Iron Sights, a guild of hunters whose ranks are open to those who prove themselves with trophies or monster kills. The Iron Sights are honorbound, however, and don’t turn away anyone in need of aid, offering basic amenities to the travelers."
 }
];

export const X_SPOTS = {
 "east-portal": [
  {
   "name": "The town today",
   "page": 8,
   "book": "East Portal",
   "text": "The town has a constant population of about 50 including the temporary workers, and you can expect about 10 more visitors at any given time. Newcomers are an expected part of East Portal, but not everyone is very friendly toward them. Mind your manners, give as much as you take, and you’ll be fine."
  },
  {
   "name": "Law & order",
   "page": 12,
   "book": "East Portal",
   "text": "The elected sheriff, Samuel Burnside (see Sheriff’s Office), has a few deputies that help him keep things in line when a dispute gets a little too rowdy. You cause much mischief in East Portal and you’re sure to find the quick judgment of Sheriff Burnside. He ain’t a Rosewood. The town trusts him to preserve their peace and their freedoms. And when things get real dangerous, whether it’s monsters or bandits, the town folk are well equipped to defend East Portal. Luckily, and thanks to local resident Ivan Ward, a Town Forstall and series of Repeaters have been built around East Portal’s perimeter. East Portal has its fair share of rowdiness, from Faction disputes to general Hogwild antics. Everyone seems fine by it as long as it don’t get too violent or involves others’ property. You won’t get in trouble for no noise ordinances though, that’s for darn sure!"
  }
 ],
 "port-kansas": [
  {
   "name": "The Crooked Crow",
   "page": 45,
   "book": "Iron Road",
   "text": "Port Kansas’ most popular saloon and eatery. It’s named The Crooked Crow because of the warped wooden floorboards that’s caused by river water splashing up onto them from below. All the tables and chairs rock back and forth due to the floor’s unevenness but no one seems to really mind except for new customers. In the middle of the building hangs a large crystal chandelier that was an imported product from Portugal but never got delivered to its buyer. It sat in a wooden crate at the port for years before there was a blind auction held and the saloon owner ended up with the top bid. The bartender, Grizz Cotter, loves to tell this story because the chandelier feels so out of place and sticks out like a diamond in a pigpen."
  },
  {
   "name": "The Docks",
   "page": 46,
   "book": "Iron Road",
   "text": "During the day, the docks are bustling with life as workers haul heavy loads to and from the flat-bottomed barges like a colony of Bone-Carver Ants. At night, dim lantern light illuminates circular patches of the dock for a much smaller shift of workers to maneuver in between. Armed Rosewoods keep watch for hungry Bloodsuckers (Official Guidebook pg. 147) and curious Lightning Bugs (Official Guidebook pg. 164). Every once in a while, the townsfolk will be awakened from their slumber by echoing gunfire at a nocturnal monster. It’s nothing they’re not used to."
  },
  {
   "name": "Merchant Pier",
   "page": 47,
   "book": "Iron Road",
   "text": "On the opposite side of town from the commercial docks and closer to the permanent dwellings, there lies a wide pier of shops and eager shop owners. Business has been tight lately and the owners are coming off more aggressive in their sales pitches. Some have opted for standing outside their establishments with creative displays to attract customers while shouting the same phrase over and over again. The plethora of noises make the merchant pier sound much busier than it actually is."
  },
  {
   "name": "Rosewood Office",
   "page": 50,
   "book": "Iron Road",
   "text": "Stationed at the highest, driest point of the town is a two-story building with reinforced walls, covered patio, and a single Rosewood badge carved into the beam above the door. A pair of Rosewood agents stand posted at their station on either side of the entrance walkway. They never smile while on duty, but they somehow still seem approachable in an older sibling sort of way. Directly inside the building is a reception desk where reports are filed and paperwork stacks higher than the well-dressed receptionist’s head when seated. Just beyond that, another few desks are positioned at an angle towards the door followed by six oversized holding cells secured by a fat iron lock. A single person occupies one of the cells with their head hung low and long greasy hair hiding their face from plain sight. This individual, Robin Callahan, was arrested for not paying their taxes to the Rosewoods and resisting to comply. A handcrafted bow and arrows seized during the arrest hang on the opposite wall."
  }
 ],
 "omaha": [
  {
   "name": "A town divided",
   "page": 60,
   "book": "Iron Road",
   "text": "The city of Omaha is divided. Physically, by a natural rock formation that cuts the land in half from east to west, as well as politically along the same line. The southern side of the city wants to maintain the integrity of the East and supports the government’s attempts to expand westward with order and control. The northern side supports the movement west to find freedom without the presence of a controlling power."
  },
  {
   "name": "Hot air balloons",
   "page": 60,
   "book": "Iron Road",
   "text": "Four tethered hot air balloons hover above the buildings from late at night to early morning, searching the horizon for monsters. It’s an innovative but costly solution to keeping unwanted monsters from entering the town’s perimeter. Two gunners per basket stand guard with Long Range rifles in hand. If a monster is sighted, gunshots are fired in a rhythmic pattern like Morse code: three quick, three slow, and three quick again (SOS). This is done to both scare off the beast and warn the citizens. There’s never a week that goes by without hearing these warning shots at least once."
  },
  {
   "name": "The Traveling Carnival",
   "page": 63,
   "book": "Iron Road",
   "text": "The carnival, held on the southern side of town near the railroad, is filled with steam-powered mechanical rides, trapeze artists, games with prizes to be won, and sideshows presenting mythical beasts. The carnies work with the Frontier Conservation Society to track and trap unique monsters for the sideshows at the carnival and to observe behaviors for research in their exhibits. All of the featured monsters are smaller than a covered wagon. This is an intentional choice driven by the Society for easier sedation and handling without the need for any cruel methods of control."
  },
  {
   "name": "The Uncivilized West Museum",
   "page": 70,
   "book": "Iron Road",
   "text": "Not even a half miles walk from the carnival is a sturdy, two-story building labeled “The Uncivilized West Museum”. Inside, visitors are welcomed by Mr. Mack Houser, the museum owner and trapping enthusiast. He greets all his visitors with the biggest smile and a firm handshake, ensuring a positive interaction from the beginning. Because of his charm, the museum is constantly buzzing with friends and family of those who had previously visited. Word travels fast among the many tourists."
  },
  {
   "name": "Horse stable",
   "page": 72,
   "book": "Iron Road",
   "text": "Stationed at the far west side of town where the road meets the prairie grasses once again, is a humble stable. It’s been equally worn by the burning sun and countless horses but still holds up strong like a stubborn mule. The wooden stalls line Omaha’s border and are stalked with hay, barley, and a trough filled with fresh water. If you keep a keen eye out, you may even meet Nansehi Washaba, the young and confident stable hand who will undoubtedly ask for an extra tip."
  }
 ],
 "dobytown": [
  {
   "name": "The adobe town",
   "page": 103,
   "book": "Iron Road",
   "text": "One of the most important stops for travelers moving from east to west is a place called Dobytown. It’s important not because of its size (the handful of buildings rest on a plot of land no bigger than a single measly acre), and it surely doesn’t have every amenity (the dry dust bowl it rests in doesn’t do a great job attracting new permanent residents). It’s important because of its location. Dobytown is a crucial rest stop before embarking into another wide stretch of prairie land where your next meal or watering hole could be weeks away. The buildings that make up this paltry town are constructed from cracking adobe and salvaged wooden pallets. They lean against each other for support, flaking under the heat of the dry plains. In Dobytown, there’s no church bell, no mayor’s office, and no law–only the sound of dice hitting the saloon table, a half-broken piano playing out of tune, and a dry breeze making a weak attempt to cool off wandering strangers."
  },
  {
   "name": "The Passing Purpose",
   "page": 103,
   "book": "Iron Road",
   "text": "The most popular place in town is known as The Passing Purpose saloon–a two-story adobe building rich with gambling, drinking, and live music. During the day it’s slow and nearly silent, but at night, the establishment comes to life. Poker tables surround the center stage that rotates slowly for all to see, and music fills the musky room with ragtime chords and stomping feet. The melody carries outside to the mech drivers who are served food and drinks atop their machines through an innovative electric pulley system. The food is plated, a switch is hit, and the cables pull orders up to the top of the second story. It sure is a sight to see."
  }
 ],
 "rackline-roost": [
  {
   "name": "The Rackline",
   "page": 125,
   "book": "Iron Road",
   "text": "At the dead center of camp is a series of three 50-foot long racks made up of heavy wooden cross beams supported by 8 foot tall cedar posts. At the outer rim of these racks are slightly elevated wooden platforms that can be used as individual workstations or a large stage, depending on the need. Flags, leather strips, feathers, and more adorn the Rackline and signify it as the heart of the Roost. The Rackline is central to the operations of the camp. Elders meet here to discuss needs or make announcements, young hunters are celebrated as they display their first trophies, and every footpath in the Roost converges here."
  },
  {
   "name": "Shikoba’s Fire Circle",
   "page": 126,
   "book": "Iron Road",
   "text": "The main fire ring isn’t at the center of the camp, it’s tucked away from most footpaths in a sheltered hollow surrounded by logs and large boulders. Guild members gather here at the end of the day to swap stories, offer advice, teach something new, celebrate victories, and mourn losses. Participants must earn their seat at this fire."
  },
  {
   "name": "Mapmaker’s Library",
   "page": 126,
   "book": "Iron Road",
   "text": "A round dome made of woven branches rests next to an enormous boulder. Inside, the rock face serves as the community map of the area. Trails, sightings, and kills are all documented here. Some areas are marked in blood as danger zones. Dozens of more localized maps on large sheets of paper and parchment are rolled up and stashed vertically in deep barrels."
  },
  {
   "name": "Nightingale Forge & Mercantile",
   "page": 128,
   "book": "Iron Road",
   "text": "A Dromedary-class mech that doubles as a mobile blacksmith station parked near the Rackline. During the day, the Forge is alive with sparks and the sound of a hammer on hot metal. Weapons are repaired, upgrades are constructed, Scrap is renewed, and traps are tightened here. Beside the services offered at the Forge, it also acts as a mercantile shop for those who are a part of the guild, offering technological upgrades, weapons, special ammunition, camouflage, and other useful items fit for survival."
  },
  {
   "name": "Crow’s Nest",
   "page": 129,
   "book": "Iron Road",
   "text": "Near the entrance of the Roost is a 30 foot tall tower made of massive logs. A flagpole and large antenna rest at the highest point–the latter connected to a power box and thick cables weaving their way down to the ground. This slightly crude looking watchtower is used to alert members of the camp of incoming danger. From the top of the tower, watchers can see far into the valley and across the tallest hills. Guild members usually rotate through this responsibility, but some are known to request this job more frequently."
  },
  {
   "name": "Repair Tent",
   "page": 129,
   "book": "Iron Road",
   "text": "This active corner of the Roost is reserved for healing the sick and wounded, but it doubles as a place of instruction and learning. Strings of electrical lights hang above rows of cots, where some hunters lie bandaged in a slow state of healing. Inside this tent, wounds are sewn shut, bones are set, and lessons are reiterated time and time again. Want to know how to handle venomous bites? Ask the Repair Tent. Need to know how to close up a laceration bigger than your own hand? Stitch can help."
  },
  {
   "name": "Stables",
   "page": 130,
   "book": "Iron Road",
   "text": "The stables occupy an area of camp that’s out of the way but not easily forgotten. Horses, Piper- and Mule-class mechs are essential for hunters and trappers, carrying heavy equipment and lugging large carcasses back to camp. The broken horses have learned to pay no mind to the mechanized carts and wagons, but the unbroken ones have yet to become comfortable. A wider section of the stables is set apart for them, as the sound of pistons, gears, and grinding metal disturb them something fierce."
  },
  {
   "name": "Prove yourself",
   "page": 124,
   "book": "Iron Road",
   "text": "Each respectful kill must be done with honor, no matter the size. Trophies from monsters larger than Small may earn a spot on the Rackline, with the additional bonuses found below."
  }
 ],
 "dodge": [
  {
   "name": "Town Hall Forstall",
   "page": 146,
   "book": "Iron Road",
   "text": "While in town, the players may come across one of the survivors attempting to fix the town’s Forstall at the top of a wood pile that was once a two-story town hall. With a successful Intuition roll (target 2) it’s clear to the posse that this individual is struggling and could use some assistance. His name is Owen Brinkerhoff and he’s no mechanic–just a shaken up citizen trying to do his part to help the community. If approached, Owen will gladly accept any help offered. He’ll mention that he’s figured out how the Forstall Module connects with the antennas but all the wiring on the circuit board is a tangle mess. He needs the posse’s help to connect the right wires to the appropriate nodes."
  },
  {
   "name": "The Recovered Mine (Cielos Verdes)",
   "page": 151,
   "book": "Iron Road",
   "text": "Miles west of Dodge, off the trail to Colorado Springs, an old abandoned mine is hidden amongst the sagebrush. The only entrance to the mine (that Isabel is aware of) is a six-foot wide opening in the flat terrain with a rusted elevator shaft heading straight down for who knows how far. The pulley system that raises and lowers the caged platform isn’t trustworthy in the slightest, and the wooden crane arm that supports it appears to be rotted. If the players are able to make it inside the mine, they’ll notice the shaft isn’t as deep as they thought–only about 30 feet down. The floor of the mine is loose soil, confirming once again how long it’s been since anyone has stepped foot down there. After successfully rolling with Intuition (target 3) the players are able to find dusty wires to a string of lights but the battery that powers it is dead. A light source bright enough to fill the narrow shaft reveals three more shafts heading in different directions: left, center, and right. The center shaft is long, level, and tapers down to a point but a soft cool draft can be felt chilling their skin. The right shaft burrows only 20 feet from where the posse stands before it’s blocked top to bottom by what looks like a cave-in. The left shaft seems to lead deeper down using an old rickety ladder, and the sounds of pickaxes and grunting miners echoes from below. Which way will the players choose?"
  }
 ],
 "colorado-springs": [
  {
   "name": "Technology forward",
   "page": 162,
   "book": "Iron Road",
   "text": "This far west, the Railroad Co. has little influence over the community and technology reigns supreme. Even the Rosewoods have been seen using Forstalls and electrical upgrades on their weapons. However, they try to keep it out of sight of their biggest client when possible. In many ways, Colorado Springs is leading the West in technology adoption. Multiple mech charging stations are available for use at major places of business while Forstall Repeaters are lined along well-traveled trails for safety. Unfortunately, due to the town’s fascination with technology, they’ve become overly dependent on Forstalls for protection. No other fortifications have been made to protect themselves from monsters."
  },
  {
   "name": "Mech Depot",
   "page": 168,
   "book": "Iron Road",
   "text": "Wagon parts, cables, pulleys, and bits of metal strewn about the half-fenced property clearly indicate the amount of clients served by this mech engineering shop. A well-calibrated team of mechanics work together to build, repair, and upgrade mechs of all classes. Currently, a Mule mech with an empty Alligator Snapping Turtle shell for a cabin is being constructed. It seems like tedious work but the employees appear to enjoy the challenge."
  },
  {
   "name": "Sheriff’s Office",
   "page": 170,
   "book": "Iron Road",
   "text": "Underneath the tower of the Town Forstall lies the Rosewood sheriff’s office. The sheriff is not at his office when the posse first arrives, allowing them a moment to look around if they wish. A cold oil lantern and a few letters from Rosewood agents lie on the desk beside an inkwell and quill. The sparse furniture of the office is made of rosewood and very beautiful. A drawer in the desk conceals a small electrical flashlight. Several bounty posters are pinned to a bulletin board on the wall featuring criminals wanted for horse theft, disrespecting the U.S. Railroad Co., and murder. A padlocked door in the back with a small iron-barred window seals a set of four empty small holding cells. A prescription bottle can also be found on the desk with a note next to it, “Take with each meal and spare yourself from any high-intensity labor for a while.” Occupying the corner of the office is a weapons cabinet with a glass door. A few leather holsters and cases of ammo occupy the otherwise empty top half. On the bottom sits a beautiful Brig & Jones Co. Model 1210 Rotary Gun which can be mounted at a designated platform on the roof. The sheriff might be willing to loan this gun if the city was in dire need."
  },
  {
   "name": "Railroad Construction Site",
   "page": 170,
   "book": "Iron Road",
   "text": "At the edge of a town is a railroad station in progress. A large wooden board painted with a locomotive advertises, “Coming Soon! Steam-Powered Travel Across the Land of the Free!” The station has a platform, a large ticket office, and a mile stretch of railroad tracks leading east. Groups of laborers carry supplies back and forth, hammer railroad ties, and guide the construction under the hot sun. There’s a rudimentary shed containing materials that could be scavenged for Scrap (4B)."
  }
 ],
 "great-plains": [
  {
   "name": "Buffalo herds",
   "page": 80,
   "book": "Iron Road",
   "text": "Spread through the prairie, large herds of buffalo graze undisturbed for each has its own Shepherd vigilantly watching over to protect. Their numbers grow with only a few greater predators brave enough to attack. Sightings of a Plains Shepherd Bison aren’t rare but it’ll only engage if its herd feels threatened."
  },
  {
   "name": "A tribal village",
   "page": 97,
   "book": "Iron Road",
   "text": "Their village is an hour’s hike away, hidden in the rocks and trees near a deep ravine with cold, flowing water. More than thirty tipis made of monster hide and adorned with valuable trophies border the stream, some even lined with red and black wires although the purpose of those wires is unclear. The people here are hospitable, openly sharing their well-cooked meals and teaching the players which edible plants can be used for medicinal purposes."
  },
  {
   "name": "Mertle’s Acres",
   "page": 99,
   "book": "Iron Road",
   "text": "On the dusty road west, the posse passes by a large, deteriorating wooden sign that says, “Mertle’s Acres” in faded white paint. Several abandoned homesteads and outposts follow, all with crumbling wooden walls and roofs covered in many thick layers of dust."
  }
 ]
};
