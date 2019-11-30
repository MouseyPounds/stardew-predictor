/* stardew-predictor.js
 * https://mouseypounds.github.io/stardew-predictor/
 */

/*jshint browser: true, jquery: true */

(function ($) {
    $.QueryString = (function (a) {
        var i,
            p,
            b = {};
        if (a === "") { return {}; }
        for (i = 0; i < a.length; i += 1) {
            p = a[i].split('=');
            if (p.length === 2) {
                b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
            }
        }
        return b;
    }(window.location.search.substr(1).split('&')));
}(jQuery));

window.onload = function () {
	"use strict";

	// Check for required File API support.
	if (!(window.File && window.FileReader)) {
		document.getElementById('out-summary').innerHTML = '<span class="error">Fatal Error: Could not load the File & FileReader APIs</span>';
		return;
	}

	// "Global" var to cache save info.
	var save = {};
	// Although this stuff isn't really part of the save file, it's a good place to put it so that
	// all the tab functions have access. Some of this could be condensed via some looping, I'm sure.
	// Most of this comes from Data\ObjectInformation.xnb, some from Data\FurnitureInformation.xnb
	// cartItems is a giant hardcoded list so that we can simply look everything up by the random roll
	// Note that the IDs in cartItems are offset by 1 from actual Object Information IDs and there is also a lot
	// of repetition due to 'unapproved' items being replaced by other items.
	save.seasonNames = ['Spring', 'Summer', 'Fall', 'Winter'];
	save.dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	save.cartItems = {
		789: 'Wild Horseradish',
		788: 'Wild Horseradish',
		787: 'Wild Horseradish',
		786: 'Battery Pack',
		785: 'Battery Pack',
		784: 'Battery Pack',
		783: 'Battery Pack',
		782: 'Battery Pack',
		781: 'Battery Pack',
		780: 'Battery Pack',
		779: 'Battery Pack',
		778: 'Battery Pack',
		777: 'Battery Pack',
		776: 'Battery Pack',
		775: 'Battery Pack',
		774: 'Battery Pack',
		773: 'Battery Pack',
		772: 'Life Elixir',
		771: 'Oil of Garlic',
		770: 'Fiber',
		769: 'Fiber',
		768: 'Void Essence',
		767: 'Solar Essence',
		766: 'Bat Wing',
		765: 'Slime',
		764: 'Slime',
		763: 'Slime',
		762: 'Slime',
		761: 'Slime',
		760: 'Slime',
		759: 'Slime',
		758: 'Slime',
		757: 'Slime',
		756: 'Slime',
		755: 'Slime',
		754: 'Slime',
		753: 'Slime',
		752: 'Slime',
		751: 'Slime',
		750: 'Slime',
		749: 'Slime',
		748: 'Slime',
		747: 'Slime',
		746: 'Slime',
		745: 'Slime',
		744: 'Slime',
		743: 'Slime',
		742: 'Slime',
		741: 'Slime',
		740: 'Slime',
		739: 'Slime',
		738: 'Slime',
		737: 'Slime',
		736: 'Slime',
		735: 'Slime',
		734: 'Slime',
		733: 'Woodskip',
		732: 'Woodskip',
		731: 'Crab Cakes',
		730: 'Maple Bar',
		729: 'Lobster Bisque',
		728: 'Escargot',
		727: 'Fish Stew',
		726: 'Chowder',
		725: 'Pine Tar',
		724: 'Oak Resin',
		723: 'Maple Syrup',
		722: 'Oyster',
		721: 'Periwinkle',
		720: 'Snail',
		719: 'Shrimp',
		718: 'Mussel',
		717: 'Cockle',
		716: 'Crab',
		715: 'Crayfish',
		714: 'Lobster',
		713: 'Lobster',
		712: 'Lobster',
		711: 'Lobster',
		710: 'Lobster',
		709: 'Lobster',
		708: 'Hardwood',
		707: 'Halibut',
		706: 'Lingcod',
		705: 'Shad',
		704: 'Albacore',
		703: 'Dorado',
		702: 'Magnet',
		701: 'Chub',
		700: 'Tilapia',
		699: 'Bullhead',
		698: 'Tiger Trout',
		697: 'Sturgeon',
		696: 'Sturgeon',
		695: 'Sturgeon',
		694: 'Cork Bobber',
		693: 'Trap Bobber',
		692: 'Treasure Hunter',
		691: 'Lead Bobber',
		690: 'Barbed Hook',
		689: 'Barbed Hook',
		688: 'Barbed Hook',
		687: 'Barbed Hook',
		686: 'Dressed Spinner',
		685: 'Spinner',
		684: 'Bait',
		683: 'Bug Meat',
		682: 'Bug Meat',
		681: 'Bug Meat',
		680: 'Bug Meat',
		679: 'Bug Meat',
		678: 'Bug Meat',
		677: 'Bug Meat',
		676: 'Bug Meat',
		675: 'Bug Meat',
		674: 'Bug Meat',
		673: 'Bug Meat',
		672: 'Bug Meat',
		671: 'Bug Meat',
		670: 'Bug Meat',
		669: 'Bug Meat',
		668: 'Bug Meat',
		667: 'Bug Meat',
		666: 'Bug Meat',
		665: 'Bug Meat',
		664: 'Bug Meat',
		663: 'Bug Meat',
		662: 'Bug Meat',
		661: 'Bug Meat',
		660: 'Bug Meat',
		659: 'Bug Meat',
		658: 'Bug Meat',
		657: 'Bug Meat',
		656: 'Bug Meat',
		655: 'Bug Meat',
		654: 'Bug Meat',
		653: 'Bug Meat',
		652: 'Bug Meat',
		651: 'Bug Meat',
		650: 'Poppyseed Muffin',
		649: 'Poppyseed Muffin',
		648: 'Fiddlehead Risotto',
		647: 'Coleslaw',
		646: 'Coleslaw',
		645: 'Coleslaw',
		644: 'Coleslaw',
		643: 'Coleslaw',
		642: 'Coleslaw',
		641: 'Coleslaw',
		640: 'Coleslaw',
		639: 'Coleslaw',
		638: 'Coleslaw',
		637: 'Cherry',
		636: 'Pomegranate',
		635: 'Peach',
		634: 'Orange',
		633: 'Apricot',
		632: 'Apple Sapling',
		631: 'Pomegranate Sapling',
		630: 'Peach Sapling',
		629: 'Orange Sapling',
		628: 'Apricot Sapling',
		627: 'Cherry Sapling',
		626: 'Cherry Sapling',
		625: 'Cherry Sapling',
		624: 'Cherry Sapling',
		623: 'Cherry Sapling',
		622: 'Cherry Sapling',
		621: 'Cherry Sapling',
		620: 'Quality Sprinkler',
		619: 'Quality Sprinkler',
		618: 'Quality Sprinkler',
		617: 'Bruschetta',
		616: 'Bruschetta',
		615: 'Bruschetta',
		614: 'Bruschetta',
		613: 'Bruschetta',
		612: 'Apple',
		611: 'Cranberry Candy',
		610: 'Blackberry Cobbler',
		609: 'Fruit Salad',
		608: 'Radish Salad',
		607: 'Pumpkin Pie',
		606: 'Roasted Hazelnuts',
		605: 'Stir Fry',
		604: 'Artichoke Dip',
		603: 'Plum Pudding',
		602: 'Plum Pudding',
		601: 'Plum Pudding',
		600: 'Plum Pudding',
		599: 'Plum Pudding',
		598: 'Sprinkler',
		597: 'Sprinkler',
		596: 'Blue Jazz',
		595: 'Blue Jazz',
		594: 'Fairy Rose',
		593: 'Fairy Rose',
		592: 'Summer Spangle',
		591: 'Summer Spangle',
		590: 'Tulip',
		589: 'Tulip',
		588: 'Tulip',
		587: 'Tulip',
		586: 'Tulip',
		585: 'Tulip',
		584: 'Tulip',
		583: 'Tulip',
		582: 'Tulip',
		581: 'Tulip',
		580: 'Tulip',
		579: 'Tulip',
		578: 'Tulip',
		577: 'Tulip',
		576: 'Tulip',
		575: 'Tulip',
		574: 'Tulip',
		573: 'Tulip',
		572: 'Tulip',
		571: 'Tulip',
		570: 'Tulip',
		569: 'Tulip',
		568: 'Tulip',
		567: 'Tulip',
		566: 'Tulip',
		565: 'Tulip',
		564: 'Tulip',
		563: 'Tulip',
		562: 'Tulip',
		561: 'Tulip',
		560: 'Tulip',
		559: 'Tulip',
		558: 'Tulip',
		557: 'Tulip',
		556: 'Tulip',
		555: 'Tulip',
		554: 'Tulip',
		553: 'Tulip',
		552: 'Tulip',
		551: 'Tulip',
		550: 'Tulip',
		549: 'Tulip',
		548: 'Tulip',
		547: 'Tulip',
		546: 'Tulip',
		545: 'Tulip',
		544: 'Tulip',
		543: 'Tulip',
		542: 'Tulip',
		541: 'Tulip',
		540: 'Tulip',
		539: 'Tulip',
		538: 'Tulip',
		537: 'Tulip',
		536: 'Tulip',
		535: 'Tulip',
		534: 'Tulip',
		533: 'Tulip',
		532: 'Tulip',
		531: 'Tulip',
		530: 'Tulip',
		529: 'Tulip',
		528: 'Tulip',
		527: 'Tulip',
		526: 'Tulip',
		525: 'Tulip',
		524: 'Tulip',
		523: 'Tulip',
		522: 'Tulip',
		521: 'Tulip',
		520: 'Tulip',
		519: 'Tulip',
		518: 'Tulip',
		517: 'Tulip',
		516: 'Tulip',
		515: 'Tulip',
		514: 'Tulip',
		513: 'Tulip',
		512: 'Tulip',
		511: 'Tulip',
		510: 'Tulip',
		509: 'Tulip',
		508: 'Tulip',
		507: 'Tulip',
		506: 'Tulip',
		505: 'Tulip',
		504: 'Tulip',
		503: 'Tulip',
		502: 'Tulip',
		501: 'Tulip',
		500: 'Tulip',
		499: 'Tulip',
		498: 'Ancient Seeds',
		497: 'Winter Seeds',
		496: 'Fall Seeds',
		495: 'Summer Seeds',
		494: 'Spring Seeds',
		493: 'Beet Seeds',
		492: 'Cranberry Seeds',
		491: 'Yam Seeds',
		490: 'Bok Choy Seeds',
		489: 'Pumpkin Seeds',
		488: 'Artichoke Seeds',
		487: 'Eggplant Seeds',
		486: 'Corn Seeds',
		485: 'Starfruit Seeds',
		484: 'Red Cabbage Seeds',
		483: 'Radish Seeds',
		482: 'Wheat Seeds',
		481: 'Pepper Seeds',
		480: 'Blueberry Seeds',
		479: 'Tomato Seeds',
		478: 'Melon Seeds',
		477: 'Rhubarb Seeds',
		476: 'Kale Seeds',
		475: 'Garlic Seeds',
		474: 'Potato Seeds',
		473: 'Cauliflower Seeds',
		472: 'Bean Starter',
		471: 'Parsnip Seeds',
		470: 'Parsnip Seeds',
		469: 'Parsnip Seeds',
		468: 'Parsnip Seeds',
		467: 'Parsnip Seeds',
		466: 'Parsnip Seeds',
		465: 'Deluxe Speed-Gro',
		464: 'Speed-Gro',
		463: 'Speed-Gro',
		462: 'Speed-Gro',
		461: 'Speed-Gro',
		460: 'Speed-Gro',
		459: 'Speed-Gro',
		458: 'Mead',
		457: 'Mead',
		456: 'Pale Broth',
		455: 'Algae Soup',
		454: 'Spangle Seeds',
		453: 'Spangle Seeds',
		452: 'Poppy Seeds',
		451: 'Poppy Seeds',
		450: 'Poppy Seeds',
		449: 'Poppy Seeds',
		448: 'Poppy Seeds',
		447: 'Poppy Seeds',
		446: 'Poppy Seeds',
		445: 'Rabbit\'s Foot',
		444: 'Rabbit\'s Foot',
		443: 'Duck Feather',
		442: 'Duck Feather',
		441: 'Duck Egg',
		440: 'Duck Egg',
		439: 'Wool',
		438: 'Wool',
		437: 'L. Goat Milk',
		436: 'L. Goat Milk',
		435: 'Goat Milk',
		434: 'Goat Milk',
		433: 'Goat Milk',
		432: 'Coffee Bean',
		431: 'Truffle Oil',
		430: 'Sunflower Seeds',
		429: 'Truffle',
		428: 'Jazz Seeds',
		427: 'Cloth',
		426: 'Tulip Bulb',
		425: 'Goat Cheese',
		424: 'Fairy Seeds',
		423: 'Cheese',
		422: 'Cheese',
		421: 'Purple Mushroom',
		420: 'Sunflower',
		419: 'Red Mushroom',
		418: 'Red Mushroom',
		417: 'Crocus',
		416: 'Sweet Gem Berry',
		415: 'Snow Yam',
		414: 'Stepping Stone Path',
		413: 'Crystal Fruit',
		412: 'Crystal Fruit',
		411: 'Winter Root',
		410: 'Cobblestone Path',
		409: 'Blackberry',
		408: 'Crystal Path',
		407: 'Hazelnut',
		406: 'Gravel Path',
		405: 'Wild Plum',
		404: 'Wood Path',
		403: 'Common Mushroom',
		402: 'Common Mushroom',
		401: 'Sweet Pea',
		400: 'Straw Floor',
		399: 'Strawberry',
		398: 'Spring Onion',
		397: 'Grape',
		396: 'Sea Urchin',
		395: 'Spice Berry',
		394: 'Spice Berry',
		393: 'Rainbow Shell',
		392: 'Coral',
		391: 'Nautilus Shell',
		390: 'Nautilus Shell',
		389: 'Stone',
		388: 'Stone',
		387: 'Wood',
		386: 'Wood',
		385: 'Iridium Ore',
		384: 'Iridium Ore',
		383: 'Gold Ore',
		382: 'Gold Ore',
		381: 'Coal',
		380: 'Coal',
		379: 'Iron Ore',
		378: 'Iron Ore',
		377: 'Copper Ore',
		376: 'Copper Ore',
		375: 'Poppy',
		374: 'Poppy',
		373: 'Poppy',
		372: 'Poppy',
		371: 'Clam',
		370: 'Quality Retaining Soil',
		369: 'Basic Retaining Soil',
		368: 'Quality Fertilizer',
		367: 'Basic Fertilizer',
		366: 'Basic Fertilizer',
		365: 'Basic Fertilizer',
		364: 'Basic Fertilizer',
		363: 'Basic Fertilizer',
		362: 'Basic Fertilizer',
		361: 'Basic Fertilizer',
		360: 'Basic Fertilizer',
		359: 'Basic Fertilizer',
		358: 'Basic Fertilizer',
		357: 'Basic Fertilizer',
		356: 'Basic Fertilizer',
		355: 'Basic Fertilizer',
		354: 'Basic Fertilizer',
		353: 'Basic Fertilizer',
		352: 'Basic Fertilizer',
		351: 'Basic Fertilizer',
		350: 'Basic Fertilizer',
		349: 'Juice',
		348: 'Juice',
		347: 'Wine',
		346: 'Rare Seed',
		345: 'Beer',
		344: 'Beer',
		343: 'Jelly',
		342: 'Jelly',
		341: 'Pickles',
		340: 'Pickles',
		339: 'Honey',
		338: 'Honey',
		337: 'Refined Quartz',
		336: 'Iridium Bar',
		335: 'Gold Bar',
		334: 'Iron Bar',
		333: 'Copper Bar',
		332: 'Crystal Floor',
		331: 'Crystal Floor',
		330: 'Weathered Floor',
		329: 'Clay',
		328: 'Stone Floor',
		327: 'Wood Floor',
		326: 'Wood Floor',
		325: 'Wood Floor',
		324: 'Gate',
		323: 'Iron Fence',
		322: 'Stone Fence',
		321: 'Wood Fence',
		320: 'Wood Fence',
		319: 'Wood Fence',
		318: 'Wood Fence',
		317: 'Wood Fence',
		316: 'Wood Fence',
		315: 'Wood Fence',
		314: 'Wood Fence',
		313: 'Wood Fence',
		312: 'Wood Fence',
		311: 'Wood Fence',
		310: 'Pine Cone',
		309: 'Maple Seed',
		308: 'Acorn',
		307: 'Void Mayonnaise',
		306: 'Duck Mayonnaise',
		305: 'Mayonnaise',
		304: 'Void Egg',
		303: 'Hops',
		302: 'Pale Ale',
		301: 'Hops Starter',
		300: 'Grape Starter',
		299: 'Amaranth',
		298: 'Amaranth Seeds',
		297: 'Hardwood Fence',
		296: 'Hardwood Fence',
		295: 'Salmonberry',
		294: 'Salmonberry',
		293: 'Salmonberry',
		292: 'Salmonberry',
		291: 'Salmonberry',
		290: 'Salmonberry',
		289: 'Salmonberry',
		288: 'Salmonberry',
		287: 'Mega Bomb',
		286: 'Bomb',
		285: 'Cherry Bomb',
		284: 'Cherry Bomb',
		283: 'Beet',
		282: 'Holly',
		281: 'Cranberries',
		280: 'Chanterelle',
		279: 'Yam',
		278: 'Yam',
		277: 'Bok Choy',
		276: 'Bok Choy',
		275: 'Pumpkin',
		274: 'Pumpkin',
		273: 'Artichoke',
		272: 'Artichoke',
		271: 'Eggplant',
		270: 'Eggplant',
		269: 'Corn',
		268: 'Corn',
		267: 'Starfruit',
		266: 'Starfruit',
		265: 'Red Cabbage',
		264: 'Red Cabbage',
		263: 'Radish',
		262: 'Radish',
		261: 'Wheat',
		260: 'Wheat',
		259: 'Hot Pepper',
		258: 'Fiddlehead Fern',
		257: 'Blueberry',
		256: 'Morel',
		255: 'Tomato',
		254: 'Tomato',
		253: 'Melon',
		252: 'Melon',
		251: 'Rhubarb',
		250: 'Rhubarb',
		249: 'Kale',
		248: 'Kale',
		247: 'Garlic',
		246: 'Garlic',
		245: 'Garlic',
		244: 'Garlic',
		243: 'Roots Platter',
		242: 'Miner\'s Treat',
		241: 'Dish O\' The Sea',
		240: 'Survival Burger',
		239: 'Farmer\'s Lunch',
		238: 'Stuffing',
		237: 'Cranberry Sauce',
		236: 'Super Meal',
		235: 'Pumpkin Soup',
		234: 'Autumn\'s Bounty',
		233: 'Blueberry Tart',
		232: 'Ice Cream',
		231: 'Rice Pudding',
		230: 'Eggplant Parmesan',
		229: 'Red Plate',
		228: 'Tortilla',
		227: 'Maki Roll',
		226: 'Sashimi',
		225: 'Spicy Eel',
		224: 'Fried Eel',
		223: 'Spaghetti',
		222: 'Cookie',
		221: 'Rhubarb Pie',
		220: 'Pink Cake',
		219: 'Chocolate Cake',
		218: 'Trout Soup',
		217: 'Tom Kha Soup',
		216: 'Tom Kha Soup',
		215: 'Bread',
		214: 'Pepper Poppers',
		213: 'Crispy Bass',
		212: 'Fish Taco',
		211: 'Salmon Dinner',
		210: 'Pancakes',
		209: 'Hashbrowns',
		208: 'Carp Surprise',
		207: 'Glazed Yams',
		206: 'Bean Hotpot',
		205: 'Pizza',
		204: 'Fried Mushroom',
		203: 'Lucky Lunch',
		202: 'Strange Bun',
		201: 'Fried Calamari',
		200: 'Complete Breakfast',
		199: 'Vegetable Medley',
		198: 'Parsnip Soup',
		197: 'Baked Fish',
		196: 'Cheese Cauliflower',
		195: 'Salad',
		194: 'Omelet',
		193: 'Fried Egg',
		192: 'Fried Egg',
		191: 'Potato',
		190: 'Potato',
		189: 'Cauliflower',
		188: 'Cauliflower',
		187: 'Green Bean',
		186: 'Green Bean',
		185: 'Large Milk',
		184: 'Large Milk',
		183: 'Milk',
		182: 'Milk',
		181: 'Large Egg (Brown)',
		180: 'Large Egg (Brown)',
		179: 'Egg (Brown)',
		178: 'Egg (Brown)',
		177: 'Egg (Brown)',
		176: 'Egg (Brown)',
		175: 'Egg (White)',
		174: 'Egg (White)',
		173: 'Large Egg (White)',
		172: 'Large Egg (White)',
		171: 'Large Egg (White)',
		170: 'Large Egg (White)',
		169: 'Large Egg (White)',
		168: 'Large Egg (White)',
		167: 'Large Egg (White)',
		166: 'Joja Cola',
		165: 'Joja Cola',
		164: 'Scorpion Carp',
		163: 'Sandfish',
		162: 'Sandfish',
		161: 'Sandfish',
		160: 'Sandfish',
		159: 'Sandfish',
		158: 'Sandfish',
		157: 'Sandfish',
		156: 'Sandfish',
		155: 'Ghostfish',
		154: 'Super Cucumber',
		153: 'Sea Cucumber',
		152: 'Sea Cucumber',
		151: 'Sea Cucumber',
		150: 'Squid',
		149: 'Red Snapper',
		148: 'Octopus',
		147: 'Eel',
		146: 'Herring',
		145: 'Red Mullet',
		144: 'Sunfish',
		143: 'Pike',
		142: 'Catfish',
		141: 'Carp',
		140: 'Perch',
		139: 'Walleye',
		138: 'Salmon',
		137: 'Rainbow Trout',
		136: 'Smallmouth Bass',
		135: 'Largemouth Bass',
		134: 'Largemouth Bass',
		133: 'Largemouth Bass',
		132: 'Largemouth Bass',
		131: 'Bream',
		130: 'Sardine',
		129: 'Tuna',
		128: 'Anchovy',
		127: 'Pufferfish',
		126: 'Pufferfish',
		125: 'Pufferfish',
		124: 'Pufferfish',
		123: 'Pufferfish',
		122: 'Pufferfish',
		121: 'Pufferfish',
		120: 'Pufferfish',
		119: 'Pufferfish',
		118: 'Pufferfish',
		117: 'Pufferfish',
		116: 'Pufferfish',
		115: 'Pufferfish',
		114: 'Pufferfish',
		113: 'Pufferfish',
		112: 'Pufferfish',
		111: 'Pufferfish',
		110: 'Pufferfish',
		109: 'Pufferfish',
		108: 'Pufferfish',
		107: 'Pufferfish',
		106: 'Pufferfish',
		105: 'Pufferfish',
		104: 'Pufferfish',
		103: 'Pufferfish',
		102: 'Pufferfish',
		101: 'Pufferfish',
		100: 'Pufferfish',
		99: 'Pufferfish',
		98: 'Pufferfish',
		97: 'Pufferfish',
		96: 'Pufferfish',
		95: 'Pufferfish',
		94: 'Pufferfish',
		93: 'Pufferfish',
		92: 'Pufferfish',
		91: 'Sap',
		90: 'Sap',
		89: 'Cactus Fruit',
		88: 'Cactus Fruit',
		87: 'Coconut',
		86: 'Coconut',
		85: 'Coconut',
		84: 'Coconut',
		83: 'Coconut',
		82: 'Coconut',
		81: 'Coconut',
		80: 'Coconut',
		79: 'Coconut',
		78: 'Coconut',
		77: 'Cave Carrot',
		76: 'Cave Carrot',
		75: 'Cave Carrot',
		74: 'Cave Carrot',
		73: 'Cave Carrot',
		72: 'Cave Carrot',
		71: 'Cave Carrot',
		70: 'Cave Carrot',
		69: 'Cave Carrot',
		68: 'Cave Carrot',
		67: 'Cave Carrot',
		66: 'Cave Carrot',
		65: 'Cave Carrot',
		64: 'Cave Carrot',
		63: 'Cave Carrot',
		62: 'Cave Carrot',
		61: 'Cave Carrot',
		60: 'Cave Carrot',
		59: 'Cave Carrot',
		58: 'Cave Carrot',
		57: 'Cave Carrot',
		56: 'Cave Carrot',
		55: 'Cave Carrot',
		54: 'Cave Carrot',
		53: 'Cave Carrot',
		52: 'Cave Carrot',
		51: 'Cave Carrot',
		50: 'Cave Carrot',
		49: 'Cave Carrot',
		48: 'Cave Carrot',
		47: 'Cave Carrot',
		46: 'Cave Carrot',
		45: 'Cave Carrot',
		44: 'Cave Carrot',
		43: 'Cave Carrot',
		42: 'Cave Carrot',
		41: 'Cave Carrot',
		40: 'Cave Carrot',
		39: 'Cave Carrot',
		38: 'Cave Carrot',
		37: 'Cave Carrot',
		36: 'Cave Carrot',
		35: 'Cave Carrot',
		34: 'Cave Carrot',
		33: 'Cave Carrot',
		32: 'Cave Carrot',
		31: 'Cave Carrot',
		30: 'Cave Carrot',
		29: 'Cave Carrot',
		28: 'Cave Carrot',
		27: 'Cave Carrot',
		26: 'Cave Carrot',
		25: 'Cave Carrot',
		24: 'Cave Carrot',
		23: 'Parsnip',
		22: 'Parsnip',
		21: 'Dandelion',
		20: 'Dandelion',
		19: 'Leek',
		18: 'Leek',
		17: 'Daffodil',
		16: 'Daffodil',
		15: 'Wild Horseradish',
		14: 'Wild Horseradish',
		13: 'Wild Horseradish',
		12: 'Wild Horseradish',
		11: 'Wild Horseradish',
		10: 'Wild Horseradish',
		9: 'Wild Horseradish',
		8: 'Wild Horseradish',
		7: 'Wild Horseradish',
		6: 'Wild Horseradish',
		5: 'Wild Horseradish',
		4: 'Wild Horseradish',
		3: 'Wild Horseradish',
		2: 'Wild Horseradish'
	};
	save.cartPrices = {
		'Acorn': 20,
		'Albacore': 75,
		'Algae Soup': 100,
		'Amaranth': 150,
		'Amaranth Seeds': 35,
		'Anchovy': 30,
		'Ancient Seeds': 30,
		'Apple': 100,
		'Apple Sapling': 1000,
		'Apricot': 50,
		'Apricot Sapling': 500,
		'Artichoke': 160,
		'Artichoke Dip': 210,
		'Artichoke Seeds': 15,
		'Autumn\'s Bounty': 350,
		'Bait': 1,
		'Baked Fish': 100,
		'Barbed Hook': 500,
		'Basic Fertilizer': 2,
		'Basic Retaining Soil': 4,
		'Bat Wing': 15,
		'Battery Pack': 500,
		'Bean Hotpot': 100,
		'Bean Starter': 30,
		'Beer': 200,
		'Beet': 100,
		'Beet Seeds': 10,
		'Blackberry': 20,
		'Blackberry Cobbler': 260,
		'Blue Jazz': 50,
		'Blueberry': 50,
		'Blueberry Seeds': 40,
		'Blueberry Tart': 150,
		'Bok Choy': 80,
		'Bok Choy Seeds': 25,
		'Bomb': 50,
		'Bread': 60,
		'Bream': 45,
		'Bruschetta': 210,
		'Bug Meat': 8,
		'Bullhead': 75,
		'Cactus Fruit': 75,
		'Carp': 30,
		'Carp Surprise': 150,
		'Catfish': 200,
		'Cauliflower': 175,
		'Cauliflower Seeds': 40,
		'Cave Carrot': 25,
		'Chanterelle': 160,
		'Cheese': 200,
		'Cheese Cauliflower': 300,
		'Cherry': 80,
		'Cherry Bomb': 50,
		'Cherry Sapling': 850,
		'Chocolate Cake': 200,
		'Chowder': 135,
		'Chub': 50,
		'Clam': 50,
		'Clay': 20,
		'Cloth': 470,
		'Coal': 15,
		'Cobblestone Path': 1,
		'Cockle': 50,
		'Coconut': 100,
		'Coffee Bean': 15,
		'Coleslaw': 345,
		'Common Mushroom': 40,
		'Complete Breakfast': 350,
		'Cookie': 140,
		'Copper Bar': 60,
		'Copper Ore': 5,
		'Coral': 80,
		'Cork Bobber': 250,
		'Corn': 50,
		'Corn Seeds': 75,
		'Crab': 100,
		'Crab Cakes': 275,
		'Cranberries': 75,
		'Cranberry Candy': 175,
		'Cranberry Sauce': 120,
		'Cranberry Seeds': 120,
		'Crayfish': 75,
		'Crispy Bass': 150,
		'Crocus': 60,
		'Crystal Floor': 1,
		'Crystal Fruit': 150,
		'Crystal Path': 1,
		'Daffodil': 30,
		'Dandelion': 40,
		'Deluxe Speed-Gro': 40,
		'Dish O\' The Sea': 220,
		'Dorado': 100,
		'Dressed Spinner': 500,
		'Duck Egg': 95,
		'Duck Feather': 125,
		'Duck Mayonnaise': 375,
		'Eel': 85,
		'Egg (White)': 50,
		'Egg (Brown)': 50,
		'Eggplant': 60,
		'Eggplant Parmesan': 200,
		'Eggplant Seeds': 10,
		'Escargot': 125,
		'Fairy Rose': 290,
		'Fairy Seeds': 100,
		'Fall Seeds': 45,
		'Farmer\'s Lunch': 150,
		'Fiber': 1,
		'Fiddlehead Fern': 90,
		'Fiddlehead Risotto': 350,
		'Fish Stew': 175,
		'Fish Taco': 500,
		'Fried Calamari': 150,
		'Fried Eel': 120,
		'Fried Egg': 35,
		'Fried Mushroom': 200,
		'Fruit Salad': 450,
		'Garlic': 60,
		'Garlic Seeds': 20,
		'Gate': 4,
		'Ghostfish': 45,
		'Glazed Yams': 200,
		'Goat Cheese': 375,
		'Goat Milk': 225,
		'Gold Bar': 250,
		'Gold Ore': 25,
		'Grape': 80,
		'Grape Starter': 30,
		'Gravel Path': 1,
		'Green Bean': 40,
		'Halibut': 80,
		'Hardwood': 15,
		'Hardwood Fence': 10,
		'Hashbrowns': 120,
		'Hazelnut': 90,
		'Herring': 30,
		'Holly': 80,
		'Honey': 100,
		'Hops': 25,
		'Hops Starter': 30,
		'Hot Pepper': 40,
		'Ice Cream': 120,
		'Iridium Bar': 1000,
		'Iridium Ore': 100,
		'Iron Bar': 120,
		'Iron Fence': 6,
		'Iron Ore': 10,
		'Jazz Seeds': 15,
		'Jelly': 160,
		'Joja Cola': 25,
		'Juice': 150,
		'Kale': 110,
		'Kale Seeds': 35,
		'L. Goat Milk': 345,
		'Large Egg (White)': 95,
		'Large Egg (Brown)': 95,
		'Large Milk': 190,
		'Largemouth Bass': 100,
		'Lead Bobber': 150,
		'Leek': 60,
		'Life Elixir': 500,
		'Lingcod': 120,
		'Lobster': 120,
		'Lobster Bisque': 205,
		'Lucky Lunch': 250,
		'Magnet': 15,
		'Maki Roll': 220,
		'Maple Bar': 300,
		'Maple Seed': 5,
		'Maple Syrup': 200,
		'Mayonnaise': 190,
		'Mead': 200,
		'Mega Bomb': 50,
		'Melon': 250,
		'Melon Seeds': 40,
		'Milk': 125,
		'Miner\'s Treat': 200,
		'Morel': 150,
		'Mussel': 30,
		'Nautilus Shell': 120,
		'Oak Resin': 150,
		'Octopus': 150,
		'Oil of Garlic': 1000,
		'Omelet': 125,
		'Orange': 100,
		'Orange Sapling': 1000,
		'Oyster': 40,
		'Pale Ale': 300,
		'Pale Broth': 150,
		'Pancakes': 80,
		'Parsnip': 35,
		'Parsnip Seeds': 10,
		'Parsnip Soup': 120,
		'Peach': 140,
		'Peach Sapling': 1500,
		'Pepper Poppers': 200,
		'Pepper Seeds': 20,
		'Perch': 55,
		'Periwinkle': 20,
		'Pickles': 100,
		'Pike': 100,
		'Pine Cone': 5,
		'Pine Tar': 100,
		'Pink Cake': 480,
		'Pizza': 300,
		'Plum Pudding': 260,
		'Pomegranate': 140,
		'Pomegranate Sapling': 1500,
		'Poppy': 140,
		'Poppy Seeds': 50,
		'Poppyseed Muffin': 250,
		'Potato': 80,
		'Potato Seeds': 25,
		'Pufferfish': 200,
		'Pumpkin': 320,
		'Pumpkin Pie': 385,
		'Pumpkin Seeds': 50,
		'Pumpkin Soup': 300,
		'Purple Mushroom': 250,
		'Quality Fertilizer': 10,
		'Quality Retaining Soil': 5,
		'Quality Sprinkler': 450,
		'Rabbit\'s Foot': 565,
		'Radish': 90,
		'Radish Salad': 300,
		'Radish Seeds': 20,
		'Rainbow Shell': 300,
		'Rainbow Trout': 65,
		'Rare Seed': 200,
		'Red Cabbage': 260,
		'Red Cabbage Seeds': 50,
		'Red Mullet': 75,
		'Red Mushroom': 75,
		'Red Plate': 400,
		'Red Snapper': 50,
		'Refined Quartz': 50,
		'Rhubarb': 220,
		'Rhubarb Pie': 400,
		'Rhubarb Seeds': 50,
		'Rice Pudding': 260,
		'Roasted Hazelnuts': 270,
		'Roots Platter': 100,
		'Salad': 110,
		'Salmon': 75,
		'Salmon Dinner': 300,
		'Salmonberry': 5,
		'Sandfish': 75,
		'Sap': 2,
		'Sardine': 40,
		'Sashimi': 75,
		'Scorpion Carp': 150,
		'Sea Cucumber': 75,
		'Sea Urchin': 160,
		'Shad': 60,
		'Shrimp': 60,
		'Slime': 5,
		'Smallmouth Bass': 50,
		'Snail': 65,
		'Snow Yam': 100,
		'Solar Essence': 40,
		'Spaghetti': 120,
		'Spangle Seeds': 25,
		'Speed-Gro': 20,
		'Spice Berry': 80,
		'Spicy Eel': 175,
		'Spinner': 250,
		'Spring Onion': 8,
		'Spring Seeds': 35,
		'Sprinkler': 100,
		'Squid': 80,
		'Starfruit': 750,
		'Starfruit Seeds': 200,
		'Stepping Stone Path': 1,
		'Stir Fry': 335,
		'Stone': 0,
		'Stone Fence': 2,
		'Stone Floor': 1,
		'Strange Bun': 225,
		'Straw Floor': 1,
		'Strawberry': 120,
		'Stuffing': 165,
		'Sturgeon': 200,
		'Summer Seeds': 55,
		'Summer Spangle': 90,
		'Sunfish': 30,
		'Sunflower': 80,
		'Sunflower Seeds': 20,
		'Super Cucumber': 250,
		'Super Meal': 220,
		'Survival Burger': 180,
		'Sweet Gem Berry': 3000,
		'Sweet Pea': 50,
		'Tiger Trout': 150,
		'Tilapia': 75,
		'Tom Kha Soup': 250,
		'Tomato': 60,
		'Tomato Seeds': 25,
		'Tortilla': 50,
		'Trap Bobber': 200,
		'Treasure Hunter': 250,
		'Trout Soup': 100,
		'Truffle': 625,
		'Truffle Oil': 1065,
		'Tulip': 30,
		'Tulip Bulb': 10,
		'Tuna': 100,
		'Vegetable Medley': 120,
		'Void Egg': 65,
		'Void Essence': 50,
		'Void Mayonnaise': 275,
		'Walleye': 105,
		'Weathered Floor': 1,
		'Wheat': 25,
		'Wheat Seeds': 5,
		'Wild Horseradish': 50,
		'Wild Plum': 80,
		'Wine': 400,
		'Winter Root': 70,
		'Winter Seeds': 30,
		'Wood': 2,
		'Wood Fence': 1,
		'Wood Floor': 1,
		'Wood Path': 1,
		'Woodskip': 75,
		'Wool': 340,
		'Yam': 160,
		'Yam Seeds': 30
	};
	save.cartItems_1_4 = {
		16: 'Wild Horseradish',
		18: 'Daffodil',
		20: 'Leek',
		22: 'Dandelion',
		24: 'Parsnip',
		78: 'Cave Carrot',
		88: 'Coconut',
		90: 'Cactus Fruit',
		92: 'Sap',
		128: 'Pufferfish',
		129: 'Anchovy',
		130: 'Tuna',
		131: 'Sardine',
		132: 'Bream',
		136: 'Largemouth Bass',
		137: 'Smallmouth Bass',
		138: 'Rainbow Trout',
		139: 'Salmon',
		140: 'Walleye',
		141: 'Perch',
		142: 'Carp',
		143: 'Catfish',
		144: 'Pike',
		145: 'Sunfish',
		146: 'Red Mullet',
		147: 'Herring',
		148: 'Eel',
		149: 'Octopus',
		150: 'Red Snapper',
		151: 'Squid',
		154: 'Sea Cucumber',
		155: 'Super Cucumber',
		156: 'Ghostfish',
		164: 'Sandfish',
		165: 'Scorpion Carp',
		167: 'Joja Cola',
		174: 'Large Egg (White)',
		176: 'Egg (Brown)',
		180: 'Egg (Brown)',
		182: 'Large Egg (Brown)',
		184: 'Milk',
		186: 'Large Milk',
		188: 'Green Bean',
		190: 'Cauliflower',
		192: 'Potato',
		194: 'Fried Egg',
		195: 'Omelet',
		196: 'Salad',
		197: 'Cheese Cauliflower',
		198: 'Baked Fish',
		199: 'Parsnip Soup',
		200: 'Vegetable Medley',
		201: 'Complete Breakfast',
		202: 'Fried Calamari',
		203: 'Strange Bun',
		204: 'Lucky Lunch',
		205: 'Fried Mushroom',
		206: 'Pizza',
		207: 'Bean Hotpot',
		208: 'Glazed Yams',
		209: 'Carp Surprise',
		210: 'Hashbrowns',
		211: 'Pancakes',
		212: 'Salmon Dinner',
		213: 'Fish Taco',
		214: 'Crispy Bass',
		215: 'Pepper Poppers',
		216: 'Bread',
		218: 'Tom Kha Soup',
		219: 'Trout Soup',
		220: 'Chocolate Cake',
		221: 'Pink Cake',
		222: 'Rhubarb Pie',
		223: 'Cookie',
		224: 'Spaghetti',
		225: 'Fried Eel',
		226: 'Spicy Eel',
		227: 'Sashimi',
		228: 'Maki Roll',
		229: 'Tortilla',
		230: 'Red Plate',
		231: 'Eggplant Parmesan',
		232: 'Rice Pudding',
		233: 'Ice Cream',
		234: 'Blueberry Tart',
		235: 'Autumn\'s Bounty',
		236: 'Pumpkin Soup',
		237: 'Super Meal',
		238: 'Cranberry Sauce',
		239: 'Stuffing',
		240: 'Farmer\'s Lunch',
		241: 'Survival Burger',
		242: 'Dish O\' The Sea',
		243: 'Miner\'s Treat',
		244: 'Roots Platter',
		248: 'Garlic',
		250: 'Kale',
		251: 'Tea Sapling',
		252: 'Rhubarb',
		253: 'Triple Shot Espresso',
		254: 'Melon',
		256: 'Tomato',
		257: 'Morel',
		258: 'Blueberry',
		259: 'Fiddlehead Fern',
		260: 'Hot Pepper',
		262: 'Wheat',
		264: 'Radish',
		265: 'Seafoam Pudding',
		266: 'Red Cabbage',
		267: 'Flounder',
		268: 'Starfruit',
		269: 'Midnight Carp',
		270: 'Corn',
		271: 'Unmilled Rice',
		272: 'Eggplant',
		273: 'Rice Shoot',
		274: 'Artichoke',
		276: 'Pumpkin',
		278: 'Bok Choy',
		280: 'Yam',
		281: 'Chanterelle',
		282: 'Cranberries',
		283: 'Holly',
		284: 'Beet',
		286: 'Cherry Bomb',
		287: 'Bomb',
		288: 'Mega Bomb',
		293: 'Brick Floor',
		296: 'Salmonberry',
		298: 'Hardwood Fence',
		299: 'Amaranth Seeds',
		300: 'Amaranth',
		301: 'Grape Starter',
		302: 'Hops Starter',
		303: 'Pale Ale',
		304: 'Hops',
		306: 'Mayonnaise',
		307: 'Duck Mayonnaise',
		309: 'Acorn',
		310: 'Maple Seed',
		311: 'Pine Cone',
		322: 'Wood Fence',
		323: 'Stone Fence',
		324: 'Iron Fence',
		325: 'Gate',
		328: 'Wood Floor',
		329: 'Stone Floor',
		330: 'Clay',
		331: 'Weathered Floor',
		333: 'Crystal Floor',
		334: 'Copper Bar',
		335: 'Iron Bar',
		336: 'Gold Bar',
		337: 'Iridium Bar',
		338: 'Refined Quartz',
		340: 'Honey',
		342: 'Pickles',
		344: 'Jelly',
		346: 'Beer',
		347: 'Rare Seed',
		348: 'Wine',
		350: 'Juice',
		368: 'Basic Fertilizer',
		369: 'Quality Fertilizer',
		370: 'Basic Retaining Soil',
		371: 'Quality Retaining Soil',
		372: 'Clam',
		376: 'Poppy',
		378: 'Copper Ore',
		380: 'Iron Ore',
		382: 'Coal',
		384: 'Gold Ore',
		386: 'Iridium Ore',
		388: 'Wood',
		390: 'Stone',
		392: 'Nautilus Shell',
		393: 'Coral',
		394: 'Rainbow Shell',
		396: 'Spice Berry',
		397: 'Sea Urchin',
		398: 'Grape',
		399: 'Spring Onion',
		400: 'Strawberry',
		401: 'Straw Floor',
		402: 'Sweet Pea',
		404: 'Common Mushroom',
		405: 'Wood Path',
		406: 'Wild Plum',
		407: 'Gravel Path',
		408: 'Hazelnut',
		409: 'Crystal Path',
		410: 'Blackberry',
		411: 'Cobblestone Path',
		412: 'Winter Root',
		414: 'Crystal Fruit',
		415: 'Stepping Stone Path',
		416: 'Snow Yam',
		418: 'Crocus',
		420: 'Red Mushroom',
		421: 'Sunflower',
		422: 'Purple Mushroom',
		424: 'Cheese',
		425: 'Fairy Seeds',
		426: 'Goat Cheese',
		427: 'Tulip Bulb',
		428: 'Cloth',
		429: 'Jazz Seeds',
		430: 'Truffle',
		431: 'Sunflower Seeds',
		432: 'Truffle Oil',
		433: 'Coffee Bean',
		436: 'Goat Milk',
		438: 'L. Goat Milk',
		440: 'Wool',
		442: 'Duck Egg',
		444: 'Duck Feather',
		445: 'Caviar',
		446: 'Rabbit\'s Foot',
		453: 'Poppy Seeds',
		455: 'Spangle Seeds',
		456: 'Algae Soup',
		457: 'Pale Broth',
		459: 'Mead',
		465: 'Speed-Gro',
		466: 'Deluxe Speed-Gro',
		472: 'Parsnip Seeds',
		473: 'Bean Starter',
		474: 'Cauliflower Seeds',
		475: 'Potato Seeds',
		476: 'Garlic Seeds',
		477: 'Kale Seeds',
		478: 'Rhubarb Seeds',
		479: 'Melon Seeds',
		480: 'Tomato Seeds',
		481: 'Blueberry Seeds',
		482: 'Pepper Seeds',
		483: 'Wheat Seeds',
		484: 'Radish Seeds',
		485: 'Red Cabbage Seeds',
		486: 'Starfruit Seeds',
		487: 'Corn Seeds',
		488: 'Eggplant Seeds',
		489: 'Artichoke Seeds',
		490: 'Pumpkin Seeds',
		491: 'Bok Choy Seeds',
		492: 'Yam Seeds',
		493: 'Cranberry Seeds',
		494: 'Beet Seeds',
		495: 'Spring Seeds',
		496: 'Summer Seeds',
		497: 'Fall Seeds',
		498: 'Winter Seeds',
		499: 'Ancient Seeds',
		591: 'Tulip',
		593: 'Summer Spangle',
		595: 'Fairy Rose',
		597: 'Blue Jazz',
		599: 'Sprinkler',
		604: 'Plum Pudding',
		605: 'Artichoke Dip',
		606: 'Stir Fry',
		607: 'Roasted Hazelnuts',
		608: 'Pumpkin Pie',
		609: 'Radish Salad',
		610: 'Fruit Salad',
		611: 'Blackberry Cobbler',
		612: 'Cranberry Candy',
		613: 'Apple',
		614: 'Green Tea',
		618: 'Bruschetta',
		621: 'Quality Sprinkler',
		628: 'Cherry Sapling',
		629: 'Apricot Sapling',
		630: 'Orange Sapling',
		631: 'Peach Sapling',
		632: 'Pomegranate Sapling',
		633: 'Apple Sapling',
		634: 'Apricot',
		635: 'Orange',
		636: 'Peach',
		637: 'Pomegranate',
		638: 'Cherry',
		648: 'Coleslaw',
		649: 'Fiddlehead Risotto',
		651: 'Poppyseed Muffin',
		684: 'Bug Meat',
		685: 'Bait',
		686: 'Spinner',
		687: 'Dressed Spinner',
		691: 'Barbed Hook',
		692: 'Lead Bobber',
		693: 'Treasure Hunter',
		694: 'Trap Bobber',
		695: 'Cork Bobber',
		698: 'Sturgeon',
		699: 'Tiger Trout',
		700: 'Bullhead',
		701: 'Tilapia',
		702: 'Chub',
		703: 'Magnet',
		704: 'Dorado',
		705: 'Albacore',
		706: 'Shad',
		707: 'Lingcod',
		708: 'Halibut',
		709: 'Hardwood',
		715: 'Lobster',
		716: 'Crayfish',
		717: 'Crab',
		718: 'Cockle',
		719: 'Mussel',
		720: 'Shrimp',
		721: 'Snail',
		722: 'Periwinkle',
		723: 'Oyster',
		724: 'Maple Syrup',
		725: 'Oak Resin',
		726: 'Pine Tar',
		727: 'Chowder',
		728: 'Fish Stew',
		729: 'Escargot',
		730: 'Lobster Bisque',
		731: 'Maple Bar',
		732: 'Crab Cakes',
		733: 'Shrimp Cocktail',
		734: 'Woodskip',
		766: 'Slime',
		767: 'Bat Wing',
		768: 'Solar Essence',
		769: 'Void Essence',
		771: 'Fiber',
		772: 'Oil of Garlic',
		773: 'Life Elixir',
		787: 'Battery Pack',
	};
	save.cartPrices_1_4 = {
		'Acorn': 20,
		'Albacore': 75,
		'Algae Soup': 100,
		'Amaranth': 150,
		'Amaranth Seeds': 35,
		'Anchovy': 30,
		'Ancient Seeds': 30,
		'Apple': 100,
		'Apple Sapling': 1000,
		'Apricot': 50,
		'Apricot Sapling': 500,
		'Artichoke': 160,
		'Artichoke Dip': 210,
		'Artichoke Seeds': 15,
		'Autumn\'s Bounty': 350,
		'Bait': 1,
		'Baked Fish': 100,
		'Barbed Hook': 500,
		'Basic Fertilizer': 2,
		'Basic Retaining Soil': 4,
		'Bat Wing': 15,
		'Battery Pack': 500,
		'Bean Hotpot': 100,
		'Bean Starter': 30,
		'Beer': 200,
		'Beet': 100,
		'Beet Seeds': 10,
		'Blackberry': 20,
		'Blackberry Cobbler': 260,
		'Blue Jazz': 50,
		'Blueberry': 50,
		'Blueberry Seeds': 40,
		'Blueberry Tart': 150,
		'Bok Choy': 80,
		'Bok Choy Seeds': 25,
		'Bomb': 50,
		'Bread': 60,
		'Bream': 45,
		'Brick Floor': 1,
		'Bruschetta': 210,
		'Bug Meat': 8,
		'Bullhead': 75,
		'Cactus Fruit': 75,
		'Carp': 30,
		'Carp Surprise': 150,
		'Catfish': 200,
		'Cauliflower': 175,
		'Cauliflower Seeds': 40,
		'Cave Carrot': 25,
		'Caviar': 500,
		'Chanterelle': 160,
		'Cheese': 230,
		'Cheese Cauliflower': 300,
		'Cherry': 80,
		'Cherry Bomb': 50,
		'Cherry Sapling': 850,
		'Chocolate Cake': 200,
		'Chowder': 135,
		'Chub': 50,
		'Clam': 50,
		'Clay': 20,
		'Cloth': 470,
		'Coal': 15,
		'Cobblestone Path': 1,
		'Cockle': 50,
		'Coconut': 100,
		'Coffee Bean': 15,
		'Coleslaw': 345,
		'Common Mushroom': 40,
		'Complete Breakfast': 350,
		'Cookie': 140,
		'Copper Bar': 60,
		'Copper Ore': 5,
		'Coral': 80,
		'Cork Bobber': 250,
		'Corn': 50,
		'Corn Seeds': 75,
		'Crab': 100,
		'Crab Cakes': 275,
		'Cranberries': 75,
		'Cranberry Candy': 175,
		'Cranberry Sauce': 120,
		'Cranberry Seeds': 120,
		'Crayfish': 75,
		'Crispy Bass': 150,
		'Crocus': 60,
		'Crystal Floor': 1,
		'Crystal Fruit': 150,
		'Crystal Path': 1,
		'Daffodil': 30,
		'Dandelion': 40,
		'Deluxe Speed-Gro': 40,
		'Dish O\' The Sea': 220,
		'Dorado': 100,
		'Dressed Spinner': 500,
		'Duck Egg': 95,
		'Duck Feather': 125,
		'Duck Mayonnaise': 375,
		'Eel': 85,
		'Egg (Brown)': 50,
		'Eggplant': 60,
		'Eggplant Parmesan': 200,
		'Eggplant Seeds': 10,
		'Escargot': 125,
		'Fairy Rose': 290,
		'Fairy Seeds': 100,
		'Fall Seeds': 45,
		'Farmer\'s Lunch': 150,
		'Fiber': 1,
		'Fiddlehead Fern': 90,
		'Fiddlehead Risotto': 350,
		'Fish Stew': 175,
		'Fish Taco': 500,
		'Flounder': 100,
		'Fried Calamari': 150,
		'Fried Eel': 120,
		'Fried Egg': 35,
		'Fried Mushroom': 200,
		'Fruit Salad': 450,
		'Garlic': 60,
		'Garlic Seeds': 20,
		'Gate': 4,
		'Ghostfish': 45,
		'Glazed Yams': 200,
		'Goat Cheese': 400,
		'Goat Milk': 225,
		'Gold Bar': 250,
		'Gold Ore': 25,
		'Grape': 80,
		'Grape Starter': 30,
		'Gravel Path': 1,
		'Green Bean': 40,
		'Green Tea': 100,
		'Halibut': 80,
		'Hardwood': 15,
		'Hardwood Fence': 10,
		'Hashbrowns': 120,
		'Hazelnut': 90,
		'Herring': 30,
		'Holly': 80,
		'Honey': 100,
		'Hops': 25,
		'Hops Starter': 30,
		'Hot Pepper': 40,
		'Ice Cream': 120,
		'Iridium Bar': 1000,
		'Iridium Ore': 100,
		'Iron Bar': 120,
		'Iron Fence': 6,
		'Iron Ore': 10,
		'Jazz Seeds': 15,
		'Jelly': 160,
		'Joja Cola': 25,
		'Juice': 150,
		'Kale': 110,
		'Kale Seeds': 35,
		'L. Goat Milk': 345,
		'Large Egg (Brown)': 95,
		'Large Egg (White)': 95,
		'Large Milk': 190,
		'Largemouth Bass': 100,
		'Lead Bobber': 150,
		'Leek': 60,
		'Life Elixir': 500,
		'Lingcod': 120,
		'Lobster': 120,
		'Lobster Bisque': 205,
		'Lucky Lunch': 250,
		'Magnet': 15,
		'Maki Roll': 220,
		'Maple Bar': 300,
		'Maple Seed': 5,
		'Maple Syrup': 200,
		'Mayonnaise': 190,
		'Mead': 200,
		'Mega Bomb': 50,
		'Melon': 250,
		'Melon Seeds': 40,
		'Midnight Carp': 150,
		'Milk': 125,
		'Miner\'s Treat': 200,
		'Morel': 150,
		'Mussel': 30,
		'Nautilus Shell': 120,
		'Oak Resin': 150,
		'Octopus': 150,
		'Oil of Garlic': 1000,
		'Omelet': 125,
		'Orange': 100,
		'Orange Sapling': 1000,
		'Oyster': 40,
		'Pale Ale': 300,
		'Pale Broth': 150,
		'Pancakes': 80,
		'Parsnip': 35,
		'Parsnip Seeds': 10,
		'Parsnip Soup': 120,
		'Peach': 140,
		'Peach Sapling': 1500,
		'Pepper Poppers': 200,
		'Pepper Seeds': 20,
		'Perch': 55,
		'Periwinkle': 20,
		'Pickles': 100,
		'Pike': 100,
		'Pine Cone': 5,
		'Pine Tar': 100,
		'Pink Cake': 480,
		'Pizza': 300,
		'Plum Pudding': 260,
		'Pomegranate': 140,
		'Pomegranate Sapling': 1500,
		'Poppy': 140,
		'Poppy Seeds': 50,
		'Poppyseed Muffin': 250,
		'Potato': 80,
		'Potato Seeds': 25,
		'Pufferfish': 200,
		'Pumpkin': 320,
		'Pumpkin Pie': 385,
		'Pumpkin Seeds': 50,
		'Pumpkin Soup': 300,
		'Purple Mushroom': 250,
		'Quality Fertilizer': 10,
		'Quality Retaining Soil': 5,
		'Quality Sprinkler': 450,
		'Rabbit\'s Foot': 565,
		'Radish': 90,
		'Radish Salad': 300,
		'Radish Seeds': 20,
		'Rainbow Shell': 300,
		'Rainbow Trout': 65,
		'Rare Seed': 200,
		'Red Cabbage': 260,
		'Red Cabbage Seeds': 50,
		'Red Mullet': 75,
		'Red Mushroom': 75,
		'Red Plate': 400,
		'Red Snapper': 50,
		'Refined Quartz': 50,
		'Rhubarb': 220,
		'Rhubarb Pie': 400,
		'Rhubarb Seeds': 50,
		'Rice Pudding': 260,
		'Rice Shoot': 20,
		'Roasted Hazelnuts': 270,
		'Roots Platter': 100,
		'Salad': 110,
		'Salmon': 75,
		'Salmon Dinner': 300,
		'Salmonberry': 5,
		'Sandfish': 75,
		'Sap': 2,
		'Sardine': 40,
		'Sashimi': 75,
		'Scorpion Carp': 150,
		'Sea Cucumber': 75,
		'Sea Urchin': 160,
		'Seafoam Pudding': 300,
		'Shad': 60,
		'Shrimp': 60,
		'Shrimp Cocktail': 160,
		'Slime': 5,
		'Smallmouth Bass': 50,
		'Snail': 65,
		'Snow Yam': 100,
		'Solar Essence': 40,
		'Spaghetti': 120,
		'Spangle Seeds': 25,
		'Speed-Gro': 20,
		'Spice Berry': 80,
		'Spicy Eel': 175,
		'Spinner': 250,
		'Spring Onion': 8,
		'Spring Seeds': 35,
		'Sprinkler': 100,
		'Squid': 80,
		'Starfruit': 750,
		'Starfruit Seeds': 200,
		'Stepping Stone Path': 1,
		'Stir Fry': 335,
		'Stone': 2,
		'Stone Fence': 2,
		'Stone Floor': 1,
		'Strange Bun': 225,
		'Straw Floor': 1,
		'Strawberry': 120,
		'Stuffing': 165,
		'Sturgeon': 200,
		'Summer Seeds': 55,
		'Summer Spangle': 90,
		'Sunfish': 30,
		'Sunflower': 80,
		'Sunflower Seeds': 20,
		'Super Cucumber': 250,
		'Super Meal': 220,
		'Survival Burger': 180,
		'Sweet Pea': 50,
		'Tea Sapling': 500,
		'Tiger Trout': 150,
		'Tilapia': 75,
		'Tom Kha Soup': 250,
		'Tomato': 60,
		'Tomato Seeds': 25,
		'Tortilla': 50,
		'Trap Bobber': 200,
		'Treasure Hunter': 250,
		'Triple Shot Espresso': 450,
		'Trout Soup': 100,
		'Truffle': 625,
		'Truffle Oil': 1065,
		'Tulip': 30,
		'Tulip Bulb': 10,
		'Tuna': 100,
		'Unmilled Rice': 30,
		'Vegetable Medley': 120,
		'Void Essence': 50,
		'Walleye': 105,
		'Weathered Floor': 1,
		'Wheat': 25,
		'Wheat Seeds': 5,
		'Wild Horseradish': 50,
		'Wild Plum': 80,
		'Wine': 400,
		'Winter Root': 70,
		'Winter Seeds': 30,
		'Wood': 2,
		'Wood Fence': 1,
		'Wood Floor': 1,
		'Wood Path': 1,
		'Woodskip': 75,
		'Wool': 340,
		'Yam': 160,
		'Yam Seeds': 30,
	};
	save.cartFurniture = {
		0: "Oak Chair",
		3: "Walnut Chair",
		6: "Birch Chair",
		9: "Mahogany Chair",
		12: "Red Diner Chair",
		15: "Blue Diner Chair",
		18: "Country Chair",
		21: "Breakfast Chair",
		24: "Pink Office Chair",
		27: "Purple Office Chair",
		30: "Green Office Stool",
		31: "Orange Office Stool",
		64: "Dark Throne",
		67: "Dining Chair",
		70: "Dining Chair",
		73: "Green Plush Seat",
		76: "Pink Plush Seat",
		79: "Winter Chair",
		82: "Groovy Chair",
		85: "Cute Chair",
		88: "Stump Seat",
		91: "Metal Chair",
		94: "Green Stool",
		95: "Blue Stool",
		128: "King Chair",
		192: "Oak Bench",
		197: "Walnut Bench",
		202: "Birch Bench",
		207: "Mahogany Bench",
		212: "Modern Bench",
		288: "Blue Armchair",
		294: "Red Armchair",
		300: "Green Armchair",
		306: "Yellow Armchair",
		312: "Brown Armchair",
		416: "Blue Couch",
		424: "Red Couch",
		432: "Green Couch",
		440: "Yellow Couch",
		512: "Brown Couch",
		520: "Dark Couch",
		528: "Wizard Couch",
		536: "Woodsy Couch",
		704: "Oak Dresser",
		709: "Walnut Dresser",
		714: "Birch Dresser",
		719: "Mahogany Dresser",
		724: "Coffee Table",
		727: "Stone Slab",
		800: "Winter Dining Table",
		807: "Festive Dining Table",
		814: "Mahogany Dining Table",
		821: "Modern Dining Table",
		1120: "Oak Table",
		1122: "Walnut Table",
		1124: "Birch Table",
		1126: "Mahogany Table",
		1128: "Sun Table",
		1130: "Moon Table",
		1132: "Modern Table",
		1134: "Pub Table",
		1136: "Luxury Table",
		1138: "Diviner Table",
		1140: "Neolithic Table",
		1142: "Puzzle Table",
		1144: "Winter Table",
		1146: "Candy Table",
		1148: "Luau Table",
		1150: "Dark Table",
		1216: "Oak Tea-Table",
		1218: "Walnut Tea-Table",
		1220: "Birch Tea-Table",
		1222: "Mahogany Tea-Table",
		1224: "Modern Tea-Table",
		1280: "China Cabinet",
		1283: "Artist Bookcase",
		1285: "Luxury Bookcase",
		1287: "Modern Bookcase",
		1289: "Dark Bookcase",
		1291: "Ceramic Pillar",
		1292: "Gold Pillar",
		1293: "Industrial Pipe",
		1294: "Indoor Palm",
		1295: "Totem Pole",
		1296: "Manicured Pine",
		1297: "Topiary Tree",
		1362: "Small Plant",
		1363: "Table Plant",
		1364: "Decorative Bowl",
		1365: "Futan Bear",
		1366: "Globe",
		1367: "Model Ship",
		1368: "Small Crystal",
		1369: "Decorative Lantern",
		1376: "House Plant (1376)",
		1377: "House Plant (1377)",
		1378: "House Plant (1378)",
		1379: "House Plant (1379)",
		1380: "House Plant (1380)",
		1381: "House Plant (1381)",
		1382: "House Plant (1382)",
		1383: "House Plant (1383)",
		1384: "House Plant (1384)",
		1385: "House Plant (1385)",
		1386: "House Plant (1386)",
		1387: "House Plant (1387)",
		1388: "House Plant (1388)",
		1389: "House Plant (1389)",
		1390: "House Plant (1390)",
		1391: "Oak End Table",
		1393: "Walnut End Table",
		1395: "Birch End Table",
		1397: "Mahogany End Table",
		1399: "Modern End Table",
		1400: "Grandmother End Table",
		1401: "Winter End Table",
		1440: "Tree of the Winter Star",
		1443: "Country Lamp",
		1445: "Box Lamp",
		1447: "Modern Lamp",
		1449: "Classic Lamp",
		1451: "Red Rug",
		1456: "Patchwork Rug",
		1461: "Dark Rug",
		1539: "'The Muzzamaroo'",
		1543: "'Pathways'",
		1547: "'Queen of the Gem Sea'",
		1550: "'Vanilla Villa'",
		1552: "'Primal Motion'",
		1557: "'Sun #44'",
		1559: "Wallflower Pal",
		1561: "'Spires'",
		1563: "'Highway 89'",
		1565: "Calico Falls",
		1567: "Needlepoint Flower",
		1600: "Skull Poster",
		1601: "'Sun #45'",
		1602: "'Little Tree'",
		1603: "'Blueberries'",
		1604: "'Blue City'",
		1605: "Little Photos",
		1606: "'Dancing Grass'",
		1607: "'VGA Paradise'",
		1609: "J. Cola Light",
		1612: "'Kitemaster '95'"
	};
	save.geodeContents = {
		535: [538, 542, 548, 549, 552, 555, 556, 557, 558, 566, 568, 569, 571, 574, 576, 121],
		536: [541, 544, 545, 546, 550, 551, 559, 560, 561, 564, 567, 572, 573, 577, 123],
		537: [539, 540, 543, 547, 553, 554, 562, 563, 565, 570, 575, 578, 122],
		749: [538, 542, 548, 549, 552, 555, 556, 557, 558, 566, 568, 569, 571, 574, 576, 541, 544, 545, 546, 550, 551, 559,
			560, 561, 564, 567, 572, 573, 577, 539, 540, 543, 547, 553, 554, 562, 563, 565, 570, 575, 578, 121, 122, 123],
		275: [100, 101, 103, 104, 105, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 166, 373, 797]
	};
	save.minerals = {
		74: 'Prismatic Shard',
		82: 'Fire Quartz',
		84: 'Frozen Tear',
		86: 'Earth Crystal',
		100: 'Chipped Amphora',
		101: 'Arrowhead',
		103: 'Ancient Doll',
		104: 'Elvish Jewelry',
		105: 'Chewing Stick',
		106: 'Ornamental Fan',
		108: 'Rare Disc',
		109: 'Ancient Sword',
		110: 'Rusty Spoon',
		111: 'Rusty Spur',
		112: 'Rusty Cog',
		113: 'Chicken Statue',
		114: 'Ancient Seed',
		115: 'Prehistoric Tool',
		116: 'Dried Starfish',
		117: 'Anchor',
		118: 'Glass Shards',
		119: 'Bone Flute',
		120: 'Prehistoric Handaxe',
		121: 'Dwarvish Helm',
		122: 'Dwarf Gadget',
		123: 'Ancient Drum',
		124: 'Golden Mask',
		125: 'Golden Relic',
		166: 'Treasure Chest',
		330: 'Clay',
		373: 'Golden Pumpkin',
		378: 'Copper Ore',
		380: 'Iron Ore',
		382: 'Coal',
		384: 'Gold Ore',
		386: 'Iridium Ore',
		390: 'Stone',
		538: 'Alamite',
		539: 'Bixite',
		540: 'Baryte',
		541: 'Aerinite',
		542: 'Calcite',
		543: 'Dolomite',
		544: 'Esperite',
		545: 'Fluorapatite',
		546: 'Geminite',
		547: 'Helvite',
		548: 'Jamborite',
		549: 'Jagoite',
		550: 'Kyanite',
		551: 'Lunarite',
		552: 'Malachite',
		553: 'Neptunite',
		554: 'Lemon Stone',
		555: 'Nekoite',
		556: 'Orpiment',
		557: 'Petrified Slime',
		558: 'Thunder Egg',
		559: 'Pyrite',
		560: 'Ocean Stone',
		561: 'Ghost Crystal',
		562: 'Tigerseye',
		563: 'Jasper',
		564: 'Opal',
		565: 'Fire Opal',
		566: 'Celestine',
		567: 'Marble',
		568: 'Sandstone',
		569: 'Granite',
		570: 'Basalt',
		571: 'Limestone',
		572: 'Soapstone',
		573: 'Hematite',
		574: 'Mudstone',
		575: 'Obsidian',
		576: 'Slate',
		577: 'Fairy Stone',
		578: 'Star Shards',
		797: 'Pearl',
	};
	save.wallpaperEquiv = {
		16: 'Wild Horseradish',
		18: 'Daffodil',
		20: 'Leek',
		22: 'Dandelion',
		24: 'Parsnip',
		60: 'Emerald',
		62: 'Aquamarine',
		64: 'Ruby',
		66: 'Amethyst',
		68: 'Topaz',
		70: 'Jade',
		72: 'Diamond',
		74: 'Prismatic Shard',
		78: 'Cave Carrot',
		79: 'Secret Note',
		80: 'Quartz',
		82: 'Fire Quartz',
		84: 'Frozen Tear',
		86: 'Earth Crystal',
		88: 'Coconut',
		90: 'Cactus Fruit',
		92: 'Sap',
		93: 'Torch',
		94: 'Spirit Torch',
		96: 'Dwarf Scroll I',
		97: 'Dwarf Scroll II',
		98: 'Dwarf Scroll III',
		99: 'Dwarf Scroll IV',
		100: 'Chipped Amphora',
		101: 'Arrowhead',
		102: 'Lost Book',
		103: 'Ancient Doll',
		104: 'Elvish Jewelry',
		105: 'Chewing Stick',
		106: 'Ornamental Fan',
		107: 'Dinosaur Egg',
		108: 'Rare Disc',
		109: 'Ancient Sword',
		110: 'Rusty Spoon',
		111: 'Rusty Spur',
	};		
	save.shirtItems = {
		1000: 'Classic Overalls (ID 1)',
		1001: 'Shirt (ID 2)',
		1002: 'Mint Blouse (ID 3)',
		1003: 'Dark Shirt (ID 4)',
		1004: 'Skull Shirt (ID 5)',
		1005: 'Light Blue Shirt (ID 6)',
		1006: 'Tan Striped Shirt (ID 7)',
		1007: 'Green Overalls (ID 8)',
		1008: 'Good Grief Shirt (ID 9)',
		1009: 'Aquamarine Shirt (ID 10)',
		1010: 'Suit Top (ID 11)',
		1011: 'Green Belted Shirt (ID 12)',
		1012: 'Lime Green Striped Shirt (ID 13)',
		1013: 'Red Striped Shirt (ID 14)',
		1014: 'Skeleton Shirt (ID 15)',
		1015: 'Orange Shirt (ID 16)',
		1016: 'Night Sky Shirt (ID 17)',
		1017: 'Mayoral Suspenders (ID 18)',
		1018: 'Brown Jacket (ID 19)',
		1019: 'Sailor Shirt (ID 20)',
		1020: 'Green Vest (ID 21)',
		1021: 'Yellow and Green Shirt (ID 22)',
		1022: 'Shirt (ID 23)',
		1023: 'Shirt (ID 24)',
		1024: 'Shirt (ID 25)',
		1025: 'Shirt (ID 26)',
		1026: 'Light Blue Striped Shirt (ID 27)',
		1027: 'Pink Striped Shirt (ID 28)',
		1028: 'Heart Shirt (ID 29)',
		1029: 'Work Shirt (ID 30)',
		1030: 'Store Owner\'s Jacket (ID 31)',
		1031: 'Shirt (ID 32)',
		1032: 'Shirt (ID 33)',
		1033: 'Shirt (ID 34)',
		1034: 'Green Tunic (ID 35)',
		1035: 'Fancy Red Blouse (ID 36)',
		1036: 'Shirt (ID 37)',
		1037: 'Shirt (ID 38)',
		1038: 'Plain Shirt (ID 39)',
		1039: 'Retro Rainbow Shirt (ID 40)',
		1040: 'Shirt (ID 41)',
		1041: 'Shirt (ID 42)',
		1042: 'Lime Green Tunic (ID 43)',
		1043: 'Shirt (ID 44)',
		1044: 'Shirt (ID 45)',
		1045: 'Shirt (ID 46)',
		1046: 'Shirt (ID 47)',
		1047: 'Shirt (ID 48)',
		1048: 'Shirt (ID 49)',
		1049: 'Shirt (ID 50)',
		1050: 'Shirt (ID 51)',
		1051: 'Shirt (ID 52)',
		1052: 'Shirt (ID 53)',
		1053: 'Shirt (ID 54)',
		1054: 'Shirt (ID 55)',
		1055: 'Shirt (ID 56)',
		1056: 'Shirt (ID 57)',
		1057: 'Shirt (ID 58)',
		1058: 'Shirt (ID 59)',
		1059: 'Shirt (ID 60)',
		1060: 'Shirt (ID 61)',
		1061: 'Shirt (ID 62)',
		1062: 'Shirt (ID 63)',
		1063: 'Shirt (ID 64)',
		1064: 'Shirt (ID 65)',
		1065: 'Shirt (ID 66)',
		1066: 'Shirt (ID 67)',
		1067: 'Shirt (ID 68)',
		1068: 'Shirt (ID 69)',
		1069: 'Shirt (ID 70)',
		1070: 'Shirt (ID 71)',
		1071: 'White Overalls Shirt (ID 72)',
		1072: 'Shirt (ID 73)',
		1073: 'Shirt (ID 74)',
		1074: 'Shirt (ID 75)',
		1075: 'Shirt (ID 76)',
		1076: 'Shirt (ID 77)',
		1077: 'Shirt (ID 78)',
		1078: 'Shirt (ID 79)',
		1079: 'Shirt (ID 80)',
		1080: 'Shirt (ID 81)',
		1081: 'Shirt (ID 82)',
		1082: 'Shirt (ID 83)',
		1083: 'Shirt (ID 84)',
		1084: 'Shirt (ID 85)',
		1085: 'Shirt (ID 86)',
		1086: 'Shirt (ID 87)',
		1087: 'Neat Bow Shirt (ID 88)',
		1088: 'Shirt (ID 89)',
		1089: 'Shirt (ID 90)',
		1090: 'Shirt (ID 91)',
		1091: 'Shirt (ID 92)',
		1092: 'Shirt (ID 93)',
		1093: 'Shirt (ID 94)',
		1094: 'Shirt (ID 95)',
		1095: 'Shirt (ID 96)',
		1096: 'Shirt (ID 97)',
		1097: 'Shirt (ID 98)',
		1098: 'Shirt (ID 99)',
		1099: 'Shirt (ID 100)',
		1100: 'Shirt (ID 101)',
		1101: 'Shirt (ID 102)',
		1102: 'Shirt (ID 103)',
		1103: 'Shirt (ID 104)',
		1104: 'Shirt (ID 105)',
		1105: 'Shirt (ID 106)',
		1106: 'Shirt (ID 107)',
		1107: 'Shirt (ID 108)',
		1108: 'Shirt (ID 109)',
		1109: 'Shirt (ID 110)',
		1110: 'Shirt (ID 111)',
		1111: 'Shirt (ID 112)',
		1112: 'Shirt (ID 113)',
		1113: 'Shirt (ID 114)',
		1114: 'Shirt (ID 115)',
		1115: 'Shirt (ID 116)',
		1116: 'Shirt (ID 117)',
		1117: 'Shirt (ID 118)',
		1118: 'Shirt (ID 119)',
		1119: 'Shirt (ID 120)',
		1120: 'Shirt (ID 121)',
		1121: 'Shirt (ID 122)',
		1122: 'Shirt (ID 123)',
		1123: 'Shirt And Tie (ID 124)',
		1124: 'Shirt (ID 125)',
		1125: 'Shirt (ID 126)',
		1126: 'Shirt (ID 127)',
	};
	
	// Show input field immediately
	$(document.getElementById('input-container')).show();

	// Utility functions
	function addCommas(x) {
		// Jamie Taylor @ https://stackoverflow.com/questions/3883342/add-commas-to-a-number-in-jquery
		return x.toString().replace(/\B(?=(?:\d{3})+(?!\d))/g, ",");
	}

	function capitalize(s) {
		// joelvh @ https://stackoverflow.com/questions/1026069/how-do-i-make-the-first-letter-of-a-string-uppercase-in-javascript
		return s && s[0].toUpperCase() + s.slice(1);
	}

	function wikify(item, page) {
		// removing egg colors & quantity amounts; changing spaces to underscores
		var trimmed = item.replace(' (White)', '');
		trimmed = trimmed.replace(' (Brown)', '');
		trimmed = trimmed.replace(/ \(\d+\)/, '');
		trimmed = trimmed.replace(/ /g, '_');
		return (page) ? ('<a href="http://stardewvalleywiki.com/' + page + '#' + trimmed + '">' + item + '</a>') :
					('<a href="http://stardewvalleywiki.com/' + trimmed + '">' + item + '</a>');
	}

	function parseSummary(xmlDoc) {
		var output = '',
			farmTypes = ['Standard', 'Riverland', 'Forest', 'Hill-top', 'Wilderness', 'NEW ONE'];
		// This app doesn't actually need a whole lot from the save file, and can be run from just the gameID number.
		// Right now, that functionality is "secret" and accessed by adding "?id=123456789" (or similar) to the URL.
		// As a result, this is the only function that actually reads anything from the save file; it will store the
		// important information (or reasonable defaults) into the save structure and all other functions will use that.
		// Initialize donatedItems with stuff that actually can't be donated.
		save.donatedItems = {
			'Coal': 1,
			'Clay': 1,
			'Stone': 1,
			'Copper Ore': 1,
			'Iron Ore': 1,
			'Gold Ore': 1,
			'Iridium Ore': 1,
			'Golden Pumpkin': 1,
			'Treasure Chest': 1,
			'Pearl': 1,
		};
		// Large multiplayer games will sometimes get out of synch between the actual number of days played and the current date
		// The URL parameter 'days' lets this offset be defined.
		save.dayAdjust = 0;
		if ($.QueryString.hasOwnProperty("days")) {
			save.dayAdjust = parseInt($.QueryString.days);
		}
		if (typeof xmlDoc !== 'undefined') {
			save.gameID = Number($(xmlDoc).find('uniqueIDForThisGame').text());
			output += '<span class="result">Game ID: ' + save.gameID + '</span><br />\n';
			save.version = 1.2;
			if (Number($(xmlDoc).find('gameVersion').first().text()) > 0) {
				save.version = $(xmlDoc).find('gameVersion').first().text();
			} else {
				if ($(xmlDoc).find('hasApplied1_4_UpdateChanges').text() === 'true') {
					save.version = 1.4;
				} else if ($(xmlDoc).find('hasApplied1_3_UpdateChanges').text() === 'true') {
					save.version = 1.3;
				}
			}
			
			output += '<span class="result">Save is from version ' + save.version + '</span><br />\n';
			if (save.version >= 1.3) {
				$('#cart-title').html('Traveling Merchant Cart and Night Market Boat');
			} else {
				$('#cart-title').html('Traveling Merchant Cart');
			}
			save.ns_prefix = ($(xmlDoc).find('SaveGame[xmlns\\:xsi]').length > 0) ? 'xsi': 'p3';
			// Farmer & farm names are read as html() because they come from user input and might contain characters
			// which must be escaped.
			save.names = [];
			save.mp_ids = [];
			save.geodesCracked = [];
			save.names.push($(xmlDoc).find('SaveGame > player > name').html());
			output += '<span class="result">' + save.names[0] + ' of ' +
				$(xmlDoc).find('SaveGame > player > farmName').html() + ' Farm (' +
				farmTypes[$(xmlDoc).find('whichFarm').text()] + ')</span><br />\n';
			// In 1.2, stats are under SaveGame, but in 1.3 they are under SaveGame > player and the farmhand elements.
			if (save.version >= 1.3) {
				save.mp_ids.push($(xmlDoc).find('SaveGame > player > UniqueMultiplayerID').text());
				save.geodesCracked.push(Number($(xmlDoc).find('SaveGame > player > stats > geodesCracked').text()));
				$(xmlDoc).find('farmhand').each(function(i) {
					save.names.push($(this).find('name').html());
					save.mp_ids.push($(this).find('UniqueMultiplayerID').text());
					save.geodesCracked.push(Number($(this).find('stats > geodesCracked').text()));
					});
				if (save.names.length > 1) {
					output += '<span class="result">Farmhands: ' + save.names.slice(1).join(', ') + '</span><br />\n';
				}
			} else {
				save.geodesCracked.push(Number($(xmlDoc).find('SaveGame > stats > geodesCracked').text()));
			}
			// Date originally used XXForSaveGame elements, but those were not always present on saves downloaded from upload.farm
			save.daysPlayed = Number($(xmlDoc).find('stats > daysPlayed').first().text());
			save.year = Number($(xmlDoc).find('SaveGame > year').first().text());
			output += '<span class="result">Day ' + Number($(xmlDoc).find('SaveGame > dayOfMonth').text()) + ' of ' +
				capitalize($(xmlDoc).find('SaveGame > currentSeason').html()) + ', Year ' + save.year +
				' (' + save.daysPlayed + ' days played)</span><br />\n';
			output += '<span class="result">Geodes opened: ';
			for (var i = 0; i < save.names.length; i++) {
				output += save.geodesCracked[i] + ' (' + save.names[i] + ') ';
			}
			output += '</span><br />\n';
			save.deepestMineLevel = Number($(xmlDoc).find('player > deepestMineLevel').text());
			output += '<span class="result">Deepest mine level: ' + Math.min(120, save.deepestMineLevel) + '</span><br />\n';
			// Currently, the only reason we care about museum donations is because of geode contents. save.minerals actually
			// contains only a subset of the minerals (and a few artifacts) and we will only store the donation status of
			// stuff that is in that array (i.e. potential geode results).
			$(xmlDoc).find('locations > GameLocation').each(function () {
				if ($(this).attr(save.ns_prefix + ':type') === 'LibraryMuseum') {
					$(this).find('museumPieces > item').each(function () {
						var id = $(this).find('value > int').text();
						if (save.minerals.hasOwnProperty(id)) {
							save.donatedItems[save.minerals[id]] = 1;
						}
					});
				}
			});
			// Need to know if the baby question is possible. For now, only doing for 1.2
			save.canHaveChildren = false;
			if (save.version < 1.3) {
				var spouse = $(xmlDoc).find('player > spouse').text();
				var child_count = 0;
				if (typeof(spouse) !== 'undefined' && spouse !== '') {
					$(xmlDoc).find('locations > GameLocation').each(function () {
						$(this).find('characters > NPC').each(function () {
							if ($(this).attr(save.ns_prefix + ':type') === 'Child') {
								child_count++;
							}
						});
					});
					if (child_count < 2) {
						save.canHaveChildren = true;
					}
				}
			}
			// Check if Quarry is unlocked for mine level predictions.
			save.quarryUnlocked = false;
			$(xmlDoc).find('player > mailReceived > string').each(function () {
				var id = $(this).text();
				if (id === 'ccCraftsRoom') {
					save.quarryUnlocked = true;
				}
			});
		} else if ($.QueryString.hasOwnProperty("id")) {
			save.gameID = parseInt($.QueryString.id);
			save.daysPlayed = 1;
			save.year = 1;
			save.geodesCracked = [0];
			save.deepestMineLevel = 0;
			save.canHaveChildren = false;
			save.quarryUnlocked = false;
			save.version = 1.4;
			output += '<span class="result">App run using supplied gameID ' + save.gameID + '.</span><br />' +
				'<span class="result">No save information available so minimal progress assumed.</span><br />' +
				'<span class="result">Newest version features will be included where possible.</span><br />\n';
		} else {
			return '<span class="error">Fatal Error: Problem reading save file and no ID passed via query string.</span>';
		}

		if (save.dayAdjust !== 0) {
			output += '<span class="result">Day adjustment found in URL; will offset days played by ' + save.dayAdjust + '</span><br />\n';
		}			
		return output;
	}

	function buttonHandler(button) {
		var tab = button.id.split('-')[0];
		if (typeof(button.value) === 'undefined' || button.value === 'reset') {
			updateTab(tab, false);
		} else {
			updateTab(tab, false, Number(button.value));
		}
	}

	function searchHandler(element) {
		var tab = element.id.split('-')[0],
			text_id = tab + '-search-text';

		updateTab(tab, true, document.getElementById(text_id).value);
	}

	function predictMines(isSearch, offset) {
		// Mushroom level is determined by StardewValley.Locations.MineShaft.chooseLevelType()
		// Infestation is determined by StardewValley.Locations.MineShaft.loadLevel()
		var output = "",
			rng,
			rainbowLights,
			infestedMonster,
			infestedSlime,
			quarryLevel,
			infestedQuarryLevel,
			mineLevel,
			day,
			weekDay,
			week,
			monthName,
			month,
			year,
			tclass;
		if (typeof(offset) === 'undefined') {
			offset = 28 * Math.floor(save.daysPlayed/28);
		}
		if (offset < 112) {
			$('#mines-prev-year').prop("disabled", true);
		} else {
			$('#mines-prev-year').val(offset - 112);
			$('#mines-prev-year').prop("disabled", false);
		}
		if (offset < 28) {
			$('#mines-prev-month').prop("disabled", true);
		} else {
			$('#mines-prev-month').val(offset - 28);
			$('#mines-prev-month').prop("disabled", false);
		}
		$('#mines-reset').val('reset');
		$('#mines-next-month').val(offset + 28);
		$('#mines-next-year').val(offset + 112);
		month = Math.floor(offset / 28);
		monthName = save.seasonNames[month % 4];
		year = 1 + Math.floor(offset / 112);
		output += '<table class="calendar"><thead><tr><th colspan="7">' + monthName + ' Year ' + year + '</th></tr>\n';
		output += '<tr><th>M</th><th>T</th><th>W</th><th>Th</th><th>F</th><th>Sa</th><th>Su</th></tr></thead>\n<tbody>';
		for (week = 0; week < 4; week++) {
			output += "<tr>";
			for (weekDay = 1; weekDay < 8; weekDay++) {
				rainbowLights = [];
				infestedMonster = [];
				infestedSlime = [];
				quarryLevel = [];
				day = 7 * week + weekDay + offset;
				// This is unlike other pages because there is no search capability. Instead, we just have separate logic
				// based on different versions since RNG seeding was changed in 1.4
				if (save.version <= 1.3) {
					for (mineLevel = 1; mineLevel < 120; mineLevel++) {
						if (mineLevel % 5 === 0) {
							// skip elevator floors for everything
							continue;
						}
						// Monster infestation seems to override mushroom spawns so that is checked first
						rng = new CSRandom(day + save.dayAdjust + mineLevel + save.gameID / 2);
						if (mineLevel % 40 > 5 && mineLevel % 40 < 30 && mineLevel % 40 !== 19) {
							if (rng.NextDouble() < 0.044) {
								if (rng.NextDouble() < 0.5) {
									infestedMonster.push(mineLevel);
								} else {
									infestedSlime.push(mineLevel);
								}
								continue; // Skip mushroom checks
							}
						}
						// Reset the seed for checking Mushrooms. Note, there are a couple checks related to
						// darker than normal lighting. We don't care about the results but need to mimic them.
						rng = new CSRandom(day + save.dayAdjust + mineLevel + save.gameID / 2);
						if (rng.NextDouble() < 0.3 && mineLevel > 2) {
							rng.NextDouble(); // checked vs < 0.3 again
						}
						rng.NextDouble(); // checked vs < 0.15
						if (rng.NextDouble() < 0.035 && mineLevel > 80) {
							rainbowLights.push(mineLevel);
						}
					}
					if (day < save.daysPlayed) {
						tclass = "past";
					} else if (day === save.daysPlayed) {
						tclass = "current";
					} else {
						tclass = "future";
					}
				} else {
					for (mineLevel = 1; mineLevel < 120; mineLevel++) {
						var skipMushroomCheck = false;
						if (mineLevel % 5 === 0) {
							// skip elevator floors for everything
							continue;
						}
						// Monster infestation seems to override mushroom spawns so that is checked first
							rng = new CSRandom(day + save.dayAdjust + mineLevel*100 + save.gameID / 2);
						if (mineLevel % 40 > 5 && mineLevel % 40 < 30 && mineLevel % 40 !== 19) {
							if (rng.NextDouble() < 0.044) {
								if (rng.NextDouble() < 0.5) {
									infestedMonster.push(mineLevel);
								} else {
									infestedSlime.push(mineLevel);
								}
								skipMushroomCheck = true;
							} else if (save.quarryUnlocked) {
								if (mineLevel % 40 > 1 && rng.NextDouble() < 0.044) {
									if (rng.NextDouble() < 0.25) {
										quarryLevel.push(mineLevel + '*');
									} else {
										quarryLevel.push(mineLevel);
									}
									skipMushroomCheck = true;
								}
							}
						}
						if (skipMushroomCheck) {
							continue;
						}
						// Reset the seed for checking Mushrooms. Note, there are a couple checks related to
						// darker than normal lighting. We don't care about the results but need to mimic them.
						rng = new CSRandom((day + save.dayAdjust) * mineLevel + (4 * mineLevel) + save.gameID / 2);
						if (rng.NextDouble() < 0.3 && mineLevel > 2) {
							rng.NextDouble(); // checked vs < 0.3 again
						}
						rng.NextDouble(); // checked vs < 0.15
						if (rng.NextDouble() < 0.035 && mineLevel > 80) {
							rainbowLights.push(mineLevel);
						}
					}
					if (day < save.daysPlayed) {
						tclass = "past";
					} else if (day === save.daysPlayed) {
						tclass = "current";
					} else {
						tclass = "future";
					}
				}
				var mushroomText = "";
				if (rainbowLights.length === 0) {
					mushroomText = '<span class="none"><img src="blank.png" class="small-icon" alt="Mushroom" id="icon_m">&nbsp;None</span>';
				} else {
					mushroomText = '<img src="blank.png" class="small-icon" alt="Mushroom" id="icon_m">&nbsp;' + rainbowLights.join(',&nbsp;');
				}
				var infestedText = "";
				if (infestedMonster.length === 0) {
					infestedText = '<span class="none"><img src="blank.png" class="small-icon" alt="Sword" id="icon_i">&nbsp;None</span>';
				} else {
					infestedText = '<img src="blank.png" class="small-icon" alt="Sword" id="icon_i">&nbsp;' + infestedMonster.join(',&nbsp;');
				}
				var slimeText = "";
				if (infestedSlime.length === 0) {
					slimeText = '<span class="none"><img src="blank.png" class="small-icon" alt="Slime" id="icon_s">&nbsp;None</span>';
				} else {
					slimeText = '<img src="blank.png" class="small-icon" alt="Slime" id="icon_s">&nbsp;' + infestedSlime.join(',&nbsp;');
				}
				var quarryText = "";
				if (quarryLevel.length === 0) {
					quarryText = '<span class="none"><img src="blank.png" class="small-icon" alt="Skull" id="icon_q">&nbsp;None</span>';
				} else {
					quarryText = '<img src="blank.png" class="small-icon" alt="Skull" id="icon_q">&nbsp;' + quarryLevel.join(',&nbsp;');
				}
				output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br />' +
					'<span class="cell">' + mushroomText +
					'<br />' + infestedText + 
					'<br />' + slimeText + 
					'<br />' + quarryText + '</span></td>';
			}
			output += "</tr>\n";
		}
		output += '<tr><td colspan="7" class="legend">Legend: <img src="blank.png" class="small-icon" alt="Mushroom" id="icon_m"> Mushroom Level | <img src="blank.png" class="small-icon" alt="Sword" id="icon_i"> Monster Infestation | <img src="blank.png" class="small-icon" alt="Slime" id="icon_s"> Slime Infestation | <img src="blank.png" class="small-icon" alt="Skull" id="icon_q"> Quarry Level (* = Infested)</td></tr>';
		output += "</tbody></table>\n";
		return output;
	}

	function predictWallpaper(isSearch, offset) {
		// Pierre's stock is determined by StardewValley.Utility.getShopStock()
		// Joja-mart's stock is determined by StardewValley.Utility.getJojaStock()
		var output = "",
			rng_p,
			rng_j,
			wp_p,
			wp_j,
			eq_p,
			eq_j,
			fl_p,
			fl_j,
			day,
			weekDay,
			week,
			monthName,
			month,
			year,
			tclass;
		if (typeof(offset) === 'undefined') {
			offset = 7 * Math.floor((save.daysPlayed-1)/7);
		}
		if (offset < 112) {
			$('#wallpaper-prev-year').prop("disabled", true);
		} else {
			$('#wallpaper-prev-year').val(offset - 112);
			$('#wallpaper-prev-year').prop("disabled", false);
		}
		if (offset < 7) {
			$('#wallpaper-prev-week').prop("disabled", true);
		} else {
			$('#wallpaper-prev-week').val(offset - 7);
			$('#wallpaper-prev-week').prop("disabled", false);
		}
		$('#wallpaper-reset').val('reset');
		$('#wallpaper-next-week').val(offset + 7);
		$('#wallpaper-next-year').val(offset + 112);
		month = Math.floor(offset / 28);
		monthName = save.seasonNames[month % 4];
		year = 1 + Math.floor(offset / 112);
		output += '<table class="output"><thead><tr><th class="day">Date</th>' +
			'<th class="wp-result">Pierre\'s General Store <img src="blank.png" class="icon" id="pierre"></th>' +
			'<th class="wp-result">Joja Mart <img src="blank.png" class="icon" id="morris"></th></tr></thead><tbody>';

		for (weekDay = 1; weekDay < 8; weekDay++) {
			day = weekDay + offset;
			rng_p = new CSRandom(day + save.gameID / 2 + save.dayAdjust);
			rng_j = new CSRandom(day + save.gameID / 2 + 1 + save.dayAdjust);
			wp_p = rng_p.Next(112);
			if (save.wallpaperEquiv.hasOwnProperty(wp_p)) {
				eq_p = wikify(save.wallpaperEquiv[wp_p]);
			} else {
				eq_p = "(No valid equivalence)";
			}
			wp_p++;
			fl_p = 1 + rng_p.Next(40);
			wp_j = rng_j.Next(112);
			if (wp_j === 21) {
				wp_j = 22;
			}
			if (save.wallpaperEquiv.hasOwnProperty(wp_j)) {
				eq_j = wikify(save.wallpaperEquiv[wp_j]);
			} else {
				eq_j = "(No valid equivalence)";
			}
			wp_j++;
			fl_j = 1 + rng_j.Next(40);
			if (day < save.daysPlayed) {
				tclass = "past";
			} else if (day === save.daysPlayed) {
				tclass = "current";
			} else {
				tclass = "future";
			}
			output += '<tr><td class="' + tclass + '">' + save.dayNames[(day - 1) % 7] + '<br />' +
				monthName + ' ' + ((day - 1) % 28 + 1) +', Year ' + year + '</td>' +
				'<td class="' + tclass + '"><div class="wp"><img src="blank.png" class="wp left" id="wp_' + wp_p +
				'"><img src="blank.png" class="wp right" id="wp_' + wp_p + '"> ' + 'Wallpaper #' + wp_p + '<br/>' + eq_p + '<br/></div><br />' +
				'<div class="fl"><img src="blank.png" class="fl" id="fl_' + fl_p + '"> ' + 'Floor # ' + fl_p + '</div></td>' +
				'<td class="' + tclass + '"><div class="wp"><img src="blank.png" class="wp left" id="wp_' + wp_j +
				'"><img src="blank.png" class="wp right" id="wp_' + wp_j + '"> ' + 'Wallpaper #' + wp_j + '<br/>' + eq_j + '<br/></div><br />' +
				'<div class="fl"><img src="blank.png" class="fl" id="fl_' + fl_j + '"> ' + 'Floor # ' + fl_j + '</div></td></tr>';
		}
		output += "</tbody></table>\n";
		return output;
	}

	function getCartItem(rng, seenItems) {
		/* Helper function for cart prediction that rolls the itemID, price, and quantity and 
		 * (depending on version) makes sure this item does not duplicate something already seen.
		 * To save on the processing done by this script, the valid item lists were pre-calculated
		 * and listed as save.cartItems and save.cartItems_1_4; so this function doesn't necessarily
		 * do very much.
		 */
		var theItem = {};
		var itemID = rng.Next(2,790);
		if (save.version >= 1.4) {
			var keepGoing = true;
			while (keepGoing) {
				itemID++;
				itemID %= 790;
				if (save.cartItems_1_4.hasOwnProperty(itemID)) {
					theItem.name = save.cartItems_1_4[itemID];
					theItem.price = Math.max(rng.Next(1,11)*100, getCartPrice(theItem.name)*rng.Next(3,6));
					theItem.qty = (rng.NextDouble() < 0.1) ? 5 : 1;
					if (!(theItem.name in seenItems)) {
						seenItems[theItem.name] = 1;
						keepGoing = false;
					}
				}
			}
		} else {
			theItem.name = save.cartItems[itemID];
			theItem.price = Math.max(rng.Next(1,11)*100, getCartPrice(theItem.name)*rng.Next(3,6));
			theItem.qty = (rng.NextDouble() < 0.1) ? 5 : 1;
		}
		return theItem;
	}
	/*
	if (split[3].Contains('-') && Convert.ToInt32(split[1]) > 0 && !split[3].Contains("-13") && !split[3].Equals("Quest") && !split[0].Equals("Weeds") && !split[3].Contains("Minerals") && !split[3].Contains("Arch") && Utility.addToStock(stock, stockIndices, new Object(index, 1, false, -1, 0), new int[]
				{
					Math.Max(r.Next(1, 11) * 100, Convert.ToInt32(split[1]) * r.Next(3, 6)),
					(r.NextDouble() < 0.1) ? 5 : 1
				}))
			*/
	function getCartPrice(itemName) {
		/* Another helper function for cart prediction which basically just looks up the given itemName
		 * in the appropriate dictionary for the save version.
		 */
		 return (save.version >= 1.4) ? save.cartPrices_1_4[itemName] : save.cartPrices[itemName];
	}

	function predictCart(isSearch, offset) {
		// logic from StardewValley.Utility.getTravelingMerchantStock()
		var output = '',
			month,
			monthName,
			year,
			dayOfMonth,
			dayOfWeek,
			slot,
			item,
			qty,
			price,
			searchTerm,
			searchStart,
			searchEnd,
			count,
			rngFirst,
			rngMid,
			rngLast,
			isNightMarket = false,
			startDay;
		// Hitting search without an actual search term will fall through to the default browse function; we might want
		// to add some sort of error message or other feedback.
		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			$('#cart-prev-year').prop("disabled", true);
			$('#cart-prev-week').prop("disabled", true);
			$('#cart-next-week').prop("disabled", true);
			$('#cart-next-year').prop("disabled", true);
			$('#cart-reset').html("Clear Search Results &amp; Reset Browsing");
			// Note we are using the regexp matcher due to wanting to ignore case. The table header references offset still
			// so that it appears exactly as was typed in by the user.
			searchTerm = new RegExp(offset, "i");
			searchStart = ($('#cart-search-all').prop('checked')) ? 0 : 7 * Math.floor((save.daysPlayed - 1) / 7);
			searchEnd = 112 * $('#cart-search-range').val();
			output += '<table class="output"><thead><tr><th colspan="4">Search results for &quot;' + offset + '&quot; over the ' +
				(($('#cart-search-all').prop('checked')) ? 'first ' : 'next ') + $('#cart-search-range').val() + ' year(s)</th></tr>\n';
			output += '<tr><th class="day">Day</th><th class="item">Item</th><th class="qty">Qty</th><th class="price">Price</th></tr>\n<tbody>';
			count = 0;
			// Much of the logic here is duplicated from the browsing section, but comments related to it have been removed.
			// Also, because output is purely a chronological list, we only need one RNG instance.
			for (offset = searchStart; offset < searchStart + searchEnd; offset += 7) {
				// It might make more sense to only bother with the date stuff when matches are found.
				var days=[5,7];
				if (save.version >= 1.3 && offset % 112 === 98) {
					days = [1,2,3,5,7];
				}
				month = Math.floor(offset / 28);
				monthName = save.seasonNames[month % 4];
				year = 1 + Math.floor(offset / 112);
				for (var i = 0; i < days.length; i++) {
					var seenItems = {};
					dayOfMonth = offset % 28 + days[i];
					dayOfWeek = save.dayNames[days[i]-1];
					rngFirst = new CSRandom(save.gameID + offset + days[i] + save.dayAdjust);
					for (slot = 1; slot <= 10; slot++) {
						item = getCartItem(rngFirst, seenItems);
						if (searchTerm.test(item.name)) {
							count++;
							output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
								wikify(item.name) + "</td><td>" + item.qty + "</td><td>" + addCommas(item.price) + "g</td>";
						}
					}
					slot = -1;
					while (!save.cartFurniture.hasOwnProperty(slot)) {
						slot = rngFirst.Next(0,1613);
					}
					item = save.cartFurniture[slot];
					price = rngFirst.Next(1,11)*250;
					if (searchTerm.test(item)) {
						count++;
						output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
							wikify(item,'Furniture') + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td>";
					}
					if (month % 4 < 2) {
						item = 'Rare Seed';
						price = 1000;
						qty = (rngFirst.NextDouble() < 0.1) ? 5 : 1;
					} else {
						if (rngFirst.NextDouble() < 0.4) {
							item = 'Rarecrow (Snowman)';
							qty = 1;
							price = '4000g';
						} else {
							item = '';
						}
					}
					if (searchTerm.test(item)) {
						count++;
						output += '<tr><td>'  + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
							wikify(item) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td>";
					}
					if (rngFirst.NextDouble() < 0.25) {
						item = 'Coffee Bean';
						qty = 1;
						price = '2500g';
					} else {
						item = '';
					}
					if (searchTerm.test(item)) {
						count++;
						output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
							wikify(item) + "</td><td>" + qty + "</td><td>" + price + "g</td>";
					}
				}
			}
			output += '<tr><td colspan="4" class="count">Found ' + count + ' matching item(s)</td></tr></tbody></table>\n';
		} else {
			if (typeof(offset) === 'undefined' || offset === '') {
				offset = 7 * Math.floor((save.daysPlayed - 1) / 7);
			}
			if (save.version >= 1.3 && offset % 112 === 94) {
				isNightMarket = true;
				$('#cart-next-week').val(offset + 4);
				$('#cart-prev-week').val(offset - 3);
				startDay = 0;
			} else {
				isNightMarket = false;
				startDay = 4;
				if (save.version >= 1.3 && offset % 112 === 91) {
					// weekend before night market
					$('#cart-next-week').val(offset + 3);
					$('#cart-prev-week').val(offset - 7);
				} else if (save.version >= 1.3 && offset % 112 === 98) {
					// weekend after night market
					$('#cart-next-week').val(offset + 7);
					$('#cart-prev-week').val(offset - 4);
				} else {
					$('#cart-next-week').val(offset + 7);
					$('#cart-prev-week').val(offset - 7);
				}
			}
			$('#cart-next-year').val(offset + 112);
			$('#cart-prev-year').val(offset - 112);
			if (offset < 7) {
				$('#cart-prev-week').prop("disabled", true);
			} else {
				$('#cart-prev-week').prop("disabled", false);
			}			
			if (offset < 112) {
				$('#cart-prev-year').prop("disabled", true);
			} else {
				$('#cart-prev-year').prop("disabled", false);
			}			
			$('#cart-reset').val('reset');
			$('#cart-reset').html("Reset Browsing");			
			$('#cart-next-week').prop("disabled", false);
			$('#cart-next-year').prop("disabled", false);
			// Reset search fields too
			$('#cart-search-text').val('');
			$('#cart-search-range').val(2);
			$('#cart-search-all').prop('checked', false);
			month = Math.floor(offset / 28);
			monthName = save.seasonNames[month % 4];
			year = 1 + Math.floor(offset / 112);
			dayOfMonth = offset % 28;
			output += '<table class="output"><thead><tr><th rowspan="2">' + (isNightMarket ? 'Night Market<br />Boat' : 'Forest Cart') + '</th>';
			output += '<th colspan="3" class="multi">' + save.dayNames[startDay] + ' ' +
				monthName + ' ' + (dayOfMonth + 5) + ', Year ' + year +	'</th>';
			if (isNightMarket) {
				output +=	'<th colspan="3" class="multi">' + save.dayNames[startDay + 1] + ' ' +
					monthName + ' ' + (dayOfMonth + 6) + ', Year ' + year + '</th>\n';
			}
			output +=	'<th colspan="3" class="multi">' + save.dayNames[startDay + 2] + ' ' +
				monthName + ' ' + (dayOfMonth + 7) + ', Year ' + year + '</th></tr>\n';
			output += '<tr><th class="item">Item</th><th class="qty">Qty</th><th class="price">Price</th>';
			if (isNightMarket) {
				output += '<th class="item">Item</th><th class="qty">Qty</th><th class="price">Price</th>';
			}
			output += '<th class="item">Item</th><th class="qty">Qty</th><th class="price">Price</th></tr>\n<tbody>';
			// Multiple RNG instances because of the layout of the output table. rngMid only needed for Night Market
			rngFirst = new CSRandom(save.gameID + offset + 5 + save.dayAdjust);
			if (isNightMarket) {
				rngMid = new CSRandom(save.gameID + offset + 6 + save.dayAdjust);
			}
			rngLast = new CSRandom(save.gameID + offset + 7 + save.dayAdjust);
			var seenItemsFirst = {};
			var seenItemsMid = {};
			var seenItemsLast = {};
			for (slot = 1; slot <= 10; slot++) {
				output += "<tr><td>Basic Item " + slot + "</td>";
				item = getCartItem(rngFirst, seenItemsFirst);
				output += '<td class="item">' + wikify(item.name) + "</td><td>" + item.qty + "</td><td>" + addCommas(item.price) + "g</td>";
				if (isNightMarket) {
					item = getCartItem(rngMid, seenItemsMid);
					output += '<td class="item">' + wikify(item.name) + "</td><td>" + item.qty + "</td><td>" + addCommas(item.price) + "g</td>";
				}
				item = getCartItem(rngLast, seenItemsLast);
				output += '<td class="item">' + wikify(item.name) + "</td><td>" + item.qty + "</td><td>" + addCommas(item.price) + "g</td></tr>";
			}
			// Furniture uses StardewValley.Utility.getRandomFurniture() & StardewValley.Utility.isFurnitureOffLimitsForSale()
			// Rather than fully emulating both of those functions, we will simply make sure the save.cartFurniture structure
			// only contains items which are valid for sale.
			slot = -1;
			while (!save.cartFurniture.hasOwnProperty(slot)) {
				slot = rngFirst.Next(0,1613);
			}
			item = save.cartFurniture[slot];
			price = rngFirst.Next(1,11)*250;
			output += '<tr><td>Furniture</td><td class="item">' + wikify(item,'Furniture') + '</td><td>1</td><td>' + addCommas(price) + 'g</td>';
			if (isNightMarket) {
				slot = -1;
				while (!save.cartFurniture.hasOwnProperty(slot)) {
					slot = rngMid.Next(0,1613);
				}
				item = save.cartFurniture[slot];
				price = rngMid.Next(1,11)*250;
				output += '<td class="item">' + wikify(item,'Furniture') + '</td><td>1</td><td>' + addCommas(price) + 'g</td>';
			}
			slot = -1;
			while (!save.cartFurniture.hasOwnProperty(slot)) {
				slot = rngLast.Next(0,1613);
			}
			item = save.cartFurniture[slot];
			price = rngLast.Next(1,11)*250;
			output += '<td class="item">' + wikify(item,'Furniture') + '</td><td>1</td><td>' + addCommas(price) + 'g</td></tr>';
			// Next comes seasonal specials
			output += "<tr><td>Seasonal Special</td>";
			if (month % 4 < 2) {
				item = 'Rare Seed';
				price = 1000;
				qty = (rngFirst.NextDouble() < 0.1) ? 5 : 1;
				output += '<td class="item">' + wikify(item) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td>";
				if (isNightMarket) {
					qty = (rngMid.NextDouble() < 0.1) ? 5 : 1;
					output += '<td class="item">' + wikify(item) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td>";
				}
				qty = (rngLast.NextDouble() < 0.1) ? 5 : 1;
				output += '<td class="item">' + wikify(item) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
			} else {
				if (rngFirst.NextDouble() < 0.4) {
					item = wikify('Rarecrow (Snowman)');
					qty = 1;
					price = '4000g';
				} else {
					item = '(None)';
					qty = '--';
					price = '--';
				}
				output += '<td class="item">' + item + "</td><td>" + qty + "</td><td>" + addCommas(price) + "</td>";
				if (isNightMarket) {
					if (rngMid.NextDouble() < 0.4) {
						item = wikify('Rarecrow (Snowman)');
						qty = 1;
						price = '4000g';
					} else {
						item = '(None)';
						qty = '--';
						price = '--';
					}
					output += '<td class="item">' + item + "</td><td>" + qty + "</td><td>" + addCommas(price) + "</td>";
				}
				if (rngLast.NextDouble() < 0.4) {
					item = wikify('Rarecrow (Snowman)');
					qty = 1;
					price = '4000g';
				} else {
					item = '(None)';
					qty = '--';
					price = '--';
				}
				output += '<td class="item">' + item + "</td><td>" + qty + "</td><td>" + addCommas(price) + "</td></tr>";
			}
			// Coffee Bean
			output += "<tr><td>Other Special</td>";
			if (rngFirst.NextDouble() < 0.25) {
				item = wikify('Coffee Bean');
				qty = 1;
				price = '2500g';
			} else {
				item = '(None)';
				qty = '--';
				price = '--';
			}
			output += '<td class="item">' + item + "</td><td>" + qty + "</td><td>" + addCommas(price) + "</td>";
			if (isNightMarket) {
				if (rngMid.NextDouble() < 0.25) {
					item = wikify('Coffee Bean');
					qty = 1;
					price = '2500g';
				} else {
					item = '(None)';
					qty = '--';
					price = '--';
				}
				output += '<td class="item">' + item + "</td><td>" + qty + "</td><td>" + addCommas(price) + "</td>";
			}
			if (rngLast.NextDouble() < 0.25) {
				item = wikify('Coffee Bean');
				qty = 1;
				price = '2500g';
			} else {
				item = '(None)';
				qty = '--';
				price = '--';
			}
			output += '<td class="item">' + item + "</td><td>" + qty + "</td><td>" + addCommas(price) + "</td></tr>";
			output += '</tbody></table>\n';
		}
		return output;
	}
	
	function predictKrobus(isSearch, offset) {
		// logic from StardewValley.Locations.Sewer.getShadowShopStock()
		var output = '',
			month,
			monthName,
			year,
			dayOfMonth,
			dayOfWeek,
			item,
			qty,
			price,
			searchTerm,
			searchStart,
			searchEnd,
			count,
			rngFirst,
			rngLast,
			thisRoll;
		// Hitting search without an actual search term will fall through to the default browse function; we might want
		// to add some sort of error message or other feedback.
		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			$('#krobus-prev-year').prop("disabled", true);
			$('#krobus-prev-week').prop("disabled", true);
			$('#krobus-next-week').prop("disabled", true);
			$('#krobus-next-year').prop("disabled", true);
			$('#krobus-reset').html("Clear Search Results &amp; Reset Browsing");
			// Note we are using the regexp matcher due to wanting to ignore case. The table header references offset still
			// so that it appears exactly as was typed in by the user.
			searchTerm = new RegExp(offset, "i");
			searchStart = ($('#krobus-search-all').prop('checked')) ? 0 : 7 * Math.floor((save.daysPlayed - 1) / 7);
			searchEnd = 112 * $('#krobus-search-range').val();
			output += '<table class="output"><thead><tr><th colspan="4">Search results for &quot;' + offset + '&quot; over the ' +
				(($('#krobus-search-all').prop('checked')) ? 'first ' : 'next ') + $('#krobus-search-range').val() + ' year(s)</th></tr>\n';
			output += '<tr><th class="day">Day</th><th class="item">Item</th><th class="qty">Qty</th><th class="price">Price</th></tr>\n<tbody>';
			count = 0;
			// Much of the logic here is duplicated from the browsing section, but comments related to it have been removed.
			// Also, because output is purely a chronological list, we only need one RNG instance.
			qty = 5; // This never changes
			for (offset = searchStart; offset < searchStart + searchEnd; offset += 7) {
				var days=[3,6];
				for (var i = 0; i < days.length; i++) {
					rngFirst = new CSRandom((save.gameID / 2) + offset + days[i] + save.dayAdjust);
					// Note that we are using getCartItem which is a special filtered version of the object list.
					// Since getCartItem has a built-in increment, we counter that with the -1 after rolling the
					// random number. Luckily for us, neither of the ranges we care about has any disallowed items
					// so we can get away with using the cart list for this situation.
					if (days[i] === 3) {
						// Wednesday Fish
						item = getCartItem(rngFirst.Next(698,709) - 1, {});
						price = 200;
					} else if (days[i] === 6) {
						// Saturday Cooking
						thisRoll = rngFirst.Next(194,245) - 1;
						if (thisRoll === 216) { thisRoll = 215; }
						item = getCartItem(thisRoll, {});
						price = rngFirst.Next(5,51) * 10;
					}
					if (searchTerm.test(item)) {
						count++;
						month = Math.floor(offset / 28);
						monthName = save.seasonNames[month % 4];
						year = 1 + Math.floor(offset / 112);
						dayOfMonth = offset % 28 + days[i];
						dayOfWeek = save.dayNames[days[i]-1];
						output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
							wikify(item) + "</td><td>" + qty + "</td><td>" + price + "g</td>";
					}
				}
			}
			output += '<tr><td colspan="4" class="count">Found ' + count + ' matching item(s)</td></tr></tbody></table>\n';
		} else {
			if (typeof(offset) === 'undefined' || offset === '') {
				offset = 7 * Math.floor((save.daysPlayed - 1) / 7);
			}
			$('#krobus-prev-year').val(offset - 112);
			$('#krobus-prev-week').val(offset - 7);
			$('#krobus-next-week').val(offset + 7);
			$('#krobus-next-year').val(offset + 112);
			if (offset < 7) {
				$('#krobus-prev-week').prop("disabled", true);
			} else {
				$('#krobus-prev-week').prop("disabled", false);
			}			
			if (offset < 112) {
				$('#krobus-prev-year').prop("disabled", true);
			} else {
				$('#krobus-prev-year').prop("disabled", false);
			}			
			$('#krobus-reset').val('reset');
			$('#krobus-reset').html("Reset Browsing");			
			$('#krobus-next-week').prop("disabled", false);
			$('#krobus-next-year').prop("disabled", false);
			// Reset search fields too
			$('#krobus-search-text').val('');
			$('#krobus-search-range').val(2);
			$('#krobus-search-all').prop('checked', false);
			month = Math.floor(offset / 28);
			monthName = save.seasonNames[month % 4];
			year = 1 + Math.floor(offset / 112);
			dayOfMonth = offset % 28;
			output += '<table class="output"><thead><tr><th colspan="3" class="multi">' + save.dayNames[2] + ' ' +
				monthName + ' ' + (dayOfMonth + 3) + ', Year ' + year +	'</th>';
			output +=	'<th colspan="3" class="multi">' + save.dayNames[5] + ' ' +
				monthName + ' ' + (dayOfMonth + 6) + ', Year ' + year + '</th></tr>\n';
			output += '<tr><th class="item">Item</th><th class="qty">Qty</th><th class="price">Price</th>';
			output += '<th class="item">Item</th><th class="qty">Qty</th><th class="price">Price</th></tr>\n<tbody><tr>';
			// Multiple RNG instances because of the layout of the output table.
			// Note that we adjust the ID ranges down by 1 to fit our cartItems list
			rngFirst = new CSRandom((save.gameID / 2) + offset + 3 + save.dayAdjust);
			rngLast = new CSRandom((save.gameID / 2) + offset + 6 + save.dayAdjust);
			item = save.cartItems[rngFirst.Next(698,709) - 1];
			price = 200;
			qty = 5;
			output += '<td class="item">' + wikify(item) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td>";
			thisRoll = rngLast.Next(194,245) - 1;
			if (thisRoll === 216) { thisRoll = 215; }
			item = save.cartItems[thisRoll];
			price = rngLast.Next(5,51) * 10;
			qty = 5;
			output += '<td class="item">' + wikify(item) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td>";
			output += '</tr></tbody></table>\n';
		}
		return output;
	}

	function predictSandy(isSearch, offset) {
		// logic from StardewValley.GameLocation.sandyShopStock()
		var output = '',
			month,
			monthName,
			year,
			day,
			dayOfMonth,
			dayOfWeek,
			item,
			searchTerm,
			searchStart,
			searchEnd,
			count,
			rng,
			thisRoll,
			tclass;
		// Hitting search without an actual search term will fall through to the default browse function; we might want
		// to add some sort of error message or other feedback.
		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			$('#sandy-prev-year').prop("disabled", true);
			$('#sandy-prev-week').prop("disabled", true);
			$('#sandy-next-week').prop("disabled", true);
			$('#sandy-next-year').prop("disabled", true);
			$('#sandy-reset').html("Clear Search Results &amp; Reset Browsing");
			// Note we are using the regexp matcher due to wanting to ignore case. The table header references offset still
			// so that it appears exactly as was typed in by the user.
			searchTerm = new RegExp(offset, "i");
			searchStart = ($('#sandy-search-all').prop('checked')) ? 0 : 7 * Math.floor((save.daysPlayed - 1) / 7);
			searchEnd = 112 * $('#sandy-search-range').val();
			output += '<table class="output"><thead><tr><th colspan="3">Search results for &quot;' + offset + '&quot; over the ' +
				(($('#sandy-search-all').prop('checked')) ? 'first ' : 'next ') + $('#sandy-search-range').val() + ' year(s)</th></tr>\n';
			output += '<tr><th class="day">Day</th><th class="shirt-item">Image</th><th class="item">Name</th></tr>\n<tbody>';
			count = 0;
			// Much of the logic here is duplicated from the browsing section, but comments related to it have been removed.
			for (offset = searchStart; offset < searchStart + searchEnd; offset += 7) {
				for (var i = 0; i < 7; i++) {
					day = offset + i;
					rng = new CSRandom((save.gameID / 2) + day + save.dayAdjust);
					thisRoll = 1000 + rng.Next(127);
					item = save.shirtItems[thisRoll];
					if (searchTerm.test(item)) {
						count++;
						month = Math.floor(offset / 28);
						monthName = save.seasonNames[month % 4];
						year = 1 + Math.floor(offset / 112);
						dayOfMonth = offset % 28 + i;
						// Hack to fix day name problems
						if (i === 0) { i = 7; }
						dayOfWeek = save.dayNames[i-1];
						output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
							'<img src="blank.png" class="shirt" id="shirt_' + (thisRoll - 999) + '"></td>' +
							'<td clas="shirt-name">' + item + "</td>";
					}
				}
			}
			output += '<tr><td colspan="3" class="count">Found ' + count + ' matching item(s)</td></tr></tbody></table>\n';
		} else {
			if (typeof(offset) === 'undefined' || offset === '') {
				offset = 7 * Math.floor((save.daysPlayed - 1) / 7);
			}
			$('#sandy-prev-year').val(offset - 112);
			$('#sandy-prev-week').val(offset - 7);
			$('#sandy-next-week').val(offset + 7);
			$('#sandy-next-year').val(offset + 112);
			if (offset < 7) {
				$('#sandy-prev-week').prop("disabled", true);
			} else {
				$('#sandy-prev-week').prop("disabled", false);
			}			
			if (offset < 112) {
				$('#sandy-prev-year').prop("disabled", true);
			} else {
				$('#sandy-prev-year').prop("disabled", false);
			}			
			$('#sandy-reset').val('reset');
			$('#sandy-reset').html("Reset Browsing");			
			$('#sandy-next-week').prop("disabled", false);
			$('#sandy-next-year').prop("disabled", false);
			// Reset search fields too
			$('#sandy-search-text').val('');
			$('#sandy-search-range').val(2);
			$('#sandy-search-all').prop('checked', false);
			month = Math.floor(offset / 28);
			monthName = save.seasonNames[month % 4];
			year = 1 + Math.floor(offset / 112);
			dayOfMonth = offset % 28;

			output += '<table class="output"><thead><tr><th class="day">Date</th>' +
				'<th class="shirt-item">Image</th><th class="item">Name</th></tr></thead><tbody>';

			for (dayOfWeek = 1; dayOfWeek < 8; dayOfWeek++) {
				day = dayOfWeek + offset;
				rng = new CSRandom((save.gameID / 2) + day + save.dayAdjust);
				thisRoll = 1000 + rng.Next(127);
				item = save.shirtItems[thisRoll];

				if (day < save.daysPlayed) {
					tclass = "past";
				} else if (day === save.daysPlayed) {
					tclass = "current";
				} else {
					tclass = "future";
				}
				output += '<tr><td class="' + tclass + '">' + save.dayNames[(day - 1) % 7] + '<br />' +
					monthName + ' ' + ((day - 1) % 28 + 1) +', Year ' + year + '</td>' +
					'<td class="' + tclass + '"><img src="blank.png" class="shirt" id="shirt_' + (thisRoll - 999) + '"></td>' +  
					'<td class="' + tclass + ' shirt-name">' + item + '</td></tr>';
			}
			output += '</tbody></table>\n';
		}
		return output;
	}

	function predictGeodes(isSearch, offset) {
		// logic from StardewValley.Utility.getTreasureFromGeode()
		var output = '',
			numCracked,
			item,
			itemQty,
			itemIcon,
			qty,
			g,
			c,
			next,
			tclass,
			searchTerm,
			searchStart,
			searchEnd,
			searchResults,
			count,
			pageSize = 20,
			numColumns = (save.version >= 1.4) ? 5 : 4,
			rng,
			rngTrove;

		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			$('#geode-prev-100').prop("disabled", true);
			$('#geode-prev').prop("disabled", true);
			$('#geode-next').prop("disabled", true);
			$('#geode-next-100').prop("disabled", true);
			$('#geode-reset').html("Clear Search Results &amp; Reset Browsing");
			// Note we are using the regexp matcher due to wanting to ignore case. The table header references offset still
			// so that it appears exactly as was typed in by the user.
			searchTerm = new RegExp(offset, "i");
			searchStart = Math.max(1, ($('#geode-search-all').prop('checked')) ? 1 : save.geodesCracked[0]);
			searchEnd = parseInt($('#geode-search-range').val()) + searchStart;
			output += '<table class="output"><thead><tr><th colspan="' + (numColumns + 2) + 
				'">Search results for &quot;' + offset + '&quot; over the ' +
				(($('#geode-search-all').prop('checked')) ? 'first ' : 'next ') + $('#geode-search-range').val() + ' geodes</th></tr>\n';
			output += '<tr><th class="item">Item</th>' +
				'<th class="geode-result">Geode <a href="https://stardewvalleywiki.com/Geode">' +
				'<img src="blank.png" class="icon" id="geode_r"></a></th>' +
				'<th class="geode-result">Frozen Geode <a href="https://stardewvalleywiki.com/Frozen_Geode">' + 
				'<img src="blank.png" class="icon" id="geode_f"></a></th>' +
				'<th class="geode-result">Magma Geode <a href="https://stardewvalleywiki.com/Magma_Geode">' +
				'<img src="blank.png" class="icon" id="geode_m"></a></th>' +
				'<th class="geode-result">Omni Geode <a href="https://stardewvalleywiki.com/Omni_Geode">' +
				'<img src="blank.png" class="icon" id="geode_o"></a></th>';
			if (save.version >= 1.4) {
				output += '<th class="geode-result">Artifact Trove <a href="https://stardewvalleywiki.com/Artifact_Trove">' +
				'<img src="blank.png" class="icon" id="geode_t"></a></th>';
			}
			output += '</tr>\n<tbody>';
			count = 0;
			searchResults = {};
			//console.log('searching from ' + searchStart + ' to ' + searchEnd);
			for (numCracked = searchStart; numCracked < searchEnd; numCracked++) {
				// Nearly an exact copy of the browsing code within the for loop. We don't use the qty stuff right now,
				// but I'd rather leave it in place in case that gets added to the search results later.
				item = ['Stone', 'Stone', 'Stone', 'Stone'];
				itemQty = [1, 1, 1, 1];
				rng = new CSRandom(numCracked + save.gameID / 2);
				// Artifact Troves need their own RNG because the way the conditionals are set up means their content roll
				// happens at the same time as the rng.NextDouble() < 0.5 check. Unfortunately, that also means we have to
				// do all the warmups on both RNGs.
				rngTrove = new CSRandom(numCracked + save.gameID / 2);
				if (save.version >= 1.4) {
					// extending arrays to support artifact troves
					item.push('Stone');
					itemQty.push(1);
					// 1.4 added a bunch of extra random calls to prime the RNG to counter repeating patterns
					var i, j, prewarm_amount2 = rng.Next(1,10);
					rngTrove.Next();
					for (j = 0; j < prewarm_amount2; j++) {
						rng.NextDouble();
						rngTrove.NextDouble();
					}
					prewarm_amount2 = rng.Next(1,10);
					rngTrove.Next();
					for (i = 0; i < prewarm_amount2; i++) {
						rng.NextDouble();
						rngTrove.NextDouble();
					}
					// Might as well just roll the troves now since the separate RNGs mean the order doesn't matter.
					item[4] = save.minerals[save.geodeContents[275][Math.floor(rngTrove.NextDouble()*save.geodeContents[275].length)]];
				}
				if (rng.NextDouble() < 0.5) {
					qty = rng.Next(3)*2 + 1;
					if (rng.NextDouble() < 0.1) { qty = 10; }
					if (rng.NextDouble() < 0.01) { qty = 20; }
					if (rng.NextDouble() < 0.5) {
						c = rng.Next(4);
						if (c < 2) {
							item[0] = save.minerals[390];
							itemQty[0] = qty;
							item[1] = item[0];
							itemQty[1] = qty;
							item[2] = item[0];
							itemQty[2] = qty;
							item[3] = item[0];
							itemQty[3] = qty;
						} else if (c === 2) {
							item[0] = save.minerals[330];
							itemQty[0] = 1;
							item[1] = item[0];
							item[2] = item[0];
							item[3] = item[0];
						} else {
							item[0] = save.minerals[86];
							itemQty[0] = 1;
							item[1] = save.minerals[84];
							item[2] = save.minerals[82];
							item[3] = save.minerals[(save.version >= 1.3) ? (82 + rng.Next(3) * 2): 82];
						}
					} else {
						next = rng.NextDouble();
						// plain geode (535)
						c = Math.floor(next*3);
						if (c === 0) {
							item[0] = save.minerals[378];
							itemQty[0] = qty;
						} else if (c === 1) {
							item[0] = save.minerals[(save.deepestMineLevel > 25) ? 380 : 378];
							itemQty[0] = qty;
						} else {
							item[0] = save.minerals[382];
							itemQty[0] = qty;
						}
						// frozen geode (536)
						c = Math.floor(next*4);
						if (c === 0) {
							item[1] = save.minerals[378];
							itemQty[1] = qty;
						} else if (c === 1) {
							item[1] = save.minerals[380];
							itemQty[1] = qty;
						} else if (c === 2) {
							item[1] = save.minerals[382];
							itemQty[1] = qty;
						} else {
							item[1] = save.minerals[(save.deepestMineLevel > 75) ? 384 : 380];
							itemQty[1] = qty;
						}
						// magma & omni geodes
						c = Math.floor(next*5);
						if (c === 0) {
							item[2] = save.minerals[378];
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 1) {
							item[2] = save.minerals[380];
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 2) {
							item[2] = save.minerals[382];
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 3) {
							item[2] = save.minerals[384];
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else {
							item[2] = save.minerals[386];
							item[3] = item[2];
							itemQty[2] = Math.floor(qty/2 + 1);
							itemQty[3] = itemQty[2];
						}
					}
				} else {
					next = rng.NextDouble();
					item[0] = save.minerals[save.geodeContents[535][Math.floor(next*save.geodeContents[535].length)]];
					item[1] = save.minerals[save.geodeContents[536][Math.floor(next*save.geodeContents[536].length)]];
					item[2] = save.minerals[save.geodeContents[537][Math.floor(next*save.geodeContents[537].length)]];
					if (rng.NextDouble() < 0.008 && numCracked > 15) {
						item[3] = save.minerals[74];
					} else {
						item[3] = save.minerals[save.geodeContents[749][Math.floor(next*save.geodeContents[749].length)]];
					}
				}
				for (c = 0; c < numColumns; c++) {
					if (searchTerm.test(item[c])) {
						if (!searchResults.hasOwnProperty(item[c])) {
							searchResults[item[c]] = [ [], [], [], [] ];
							if (save.version >= 1.4) {
								searchResults[item[c]].push([]);
							}
						}
						searchResults[item[c]][c].push(numCracked);
						count++;
					}
				}
			}
			Object.keys(searchResults).sort().forEach( function(key, index) {
				itemIcon = '';
				//count++;
				if (!save.donatedItems.hasOwnProperty(key)) {
					itemIcon = ' <span tooltip="Need to Donate"><img src="blank.png" class="icon" id="gunther" alt="Need to Donate"></span>';
				}
				output += '<tr><td class="item">' + wikify(key) + itemIcon + '</td>';
				for (c = 0; c < numColumns; c++) {
					if (searchResults[key][c].length > 0) {
						// Limit to first 5 results actually shown in table with ellipsis & tooltip for others
						output += '<td>' + searchResults[key][c].slice(0,5);
						if (searchResults[key][c].length > 5) {
							output += '<span tooltip="All results: ' + searchResults[key][c] + '">,...</span>';
						}
						output += '</td>';
					} else {
						output += '<td>None</td>';
					}
				}
				output += '</tr>';
			});
			output += '<tr><td colspan="' + (numColumns + 1) + '" class="count">Found ' + count + ' matching instance(s) of ' +
				Object.keys(searchResults).length + ' matching item(s)</td></tr>\n';
		} else {
			if (typeof(offset) === 'undefined') {
				offset = pageSize * Math.floor(save.geodesCracked[0] / pageSize);
			}
			if (offset < pageSize) {
				$('#geode-prev').prop("disabled", true);
			} else {
				$('#geode-prev').val(offset - pageSize);
				$('#geode-prev').prop("disabled", false);
			}
			if (offset < 100) {
				$('#geode-prev-100').prop("disabled", true);
			} else {
				$('#geode-prev-100').val(offset - 100);
				$('#geode-prev-100').prop("disabled", false);
			}
			$('#geode-reset').val('reset');
			$('#geode-reset').html("Reset Browsing");
			$('#geode-next').val(offset + pageSize);
			$('#geode-next').prop("disabled", false);
			$('#geode-next-100').val(offset + 100);
			$('#geode-next-100').prop("disabled", false);
			// Reset search fields too
			$('#geode-search-text').val('');
			$('#geode-search-range').val(200);
			$('#geode-search-all').prop('checked', false);
			output += '<table class="output"><thead><tr><th rowspan="2" class="index">Num Open</th>' +
				'<th colspan="2" class="multi">Geode <a href="https://stardewvalleywiki.com/Geode">' +
				'<img src="blank.png" class="icon" id="geode_r"></a></th>' +
				'<th colspan="2" class="multi">Frozen Geode <a href="https://stardewvalleywiki.com/Frozen_Geode">' +
				'<img src="blank.png" class="icon" id="geode_f"></a></th>' +
				'<th colspan="2" class="multi">Magma Geode <a href="https://stardewvalleywiki.com/Magma_Geode">' +
				'<img src="blank.png" class="icon" id="geode_m"></a></th>' +
				'<th colspan="2" class="multi">Omni Geode <a href="https://stardewvalleywiki.com/Omni_Geode">' +
				'<img src="blank.png" class="icon" id="geode_o"></a></th>';
			if (save.version >= 1.4) {
				output += '<th colspan="2" class="multi"">Artifact Trove <a href="https://stardewvalleywiki.com/Artifact_Trove">' +
				'<img src="blank.png" class="icon" id="geode_t"></a></th>';
			}
			output += '</tr>\n<tr>';
			for (c = 0; c < numColumns; c++) {
				output += '<th class="item">Item</th><th class="qty">Qty</th>';
			}
			output += '</tr>\n<tbody>';
			// We are going to predict all 4 types of geodes at once, so we have multiple variables and in several cases will
			// use rng.Double() & scale things ourselves where the source does rng.Next() with various different integers.
			// Artifact Troves sill require special handling though due to the precedence of conditionals
			for (g = 1; g <= pageSize; g++) {
				numCracked = offset + g;
				item = ['Stone', 'Stone', 'Stone', 'Stone'];
				itemQty = [1, 1, 1, 1];
				rng = new CSRandom(numCracked + save.gameID / 2);
				rngTrove = new CSRandom(numCracked + save.gameID / 2);
				if (save.version >= 1.4) {
					// extending arrays to support artifact troves
					item.push('Stone');
					itemQty.push(1);
					// 1.4 added a bunch of extra random calls to prime the RNG to counter repeating patterns
					var i, j, prewarm_amount2 = rng.Next(1,10);
					rngTrove.Next();
					for (j = 0; j < prewarm_amount2; j++) {
						rng.NextDouble();
						rngTrove.NextDouble();
					}
					prewarm_amount2 = rng.Next(1,10);
					rngTrove.Next();
					for (i = 0; i < prewarm_amount2; i++) {
						rng.NextDouble();
						rngTrove.NextDouble();
					}
					// Might as well just roll the troves now since the separate RNGs mean the order doesn't matter.
					item[4] = save.minerals[save.geodeContents[275][Math.floor(rngTrove.NextDouble()*save.geodeContents[275].length)]];					
				}
				if (rng.NextDouble() < 0.5) {
					qty = rng.Next(3)*2 + 1;
					if (rng.NextDouble() < 0.1) { qty = 10; }
					if (rng.NextDouble() < 0.01) { qty = 20; }
					if (rng.NextDouble() < 0.5) {
						c = rng.Next(4);
						if (c < 2) {
							item[0] = save.minerals[390];
							itemQty[0] = qty;
							item[1] = item[0];
							itemQty[1] = qty;
							item[2] = item[0];
							itemQty[2] = qty;
							item[3] = item[0];
							itemQty[3] = qty;
						} else if (c === 2) {
							item[0] = save.minerals[330];
							itemQty[0] = 1;
							item[1] = item[0];
							item[2] = item[0];
							item[3] = item[0];
						} else {
							item[0] = save.minerals[86];
							itemQty[0] = 1;
							item[1] = save.minerals[84];
							item[2] = save.minerals[82];
							item[3] = save.minerals[(save.version >= 1.3) ? (82 + rng.Next(3) * 2): 82];
						}
					} else {
						next = rng.NextDouble();
						// plain geode (535)
						c = Math.floor(next*3);
						if (c === 0) {
							item[0] = save.minerals[378];
							itemQty[0] = qty;
						} else if (c === 1) {
							item[0] = save.minerals[(save.deepestMineLevel > 25) ? 380 : 378];
							itemQty[0] = qty;
						} else {
							item[0] = save.minerals[382];
							itemQty[0] = qty;
						}
						// frozen geode (536)
						c = Math.floor(next*4);
						if (c === 0) {
							item[1] = save.minerals[378];
							itemQty[1] = qty;
						} else if (c === 1) {
							item[1] = save.minerals[380];
							itemQty[1] = qty;
						} else if (c === 2) {
							item[1] = save.minerals[382];
							itemQty[1] = qty;
						} else {
							item[1] = save.minerals[(save.deepestMineLevel > 75) ? 384 : 380];
							itemQty[1] = qty;
						}
						// magma & omni geodes
						c = Math.floor(next*5);
						if (c === 0) {
							item[2] = save.minerals[378];
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 1) {
							item[2] = save.minerals[380];
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 2) {
							item[2] = save.minerals[382];
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 3) {
							item[2] = save.minerals[384];
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else {
							item[2] = save.minerals[386];
							item[3] = item[2];
							itemQty[2] = Math.floor(qty/2 + 1);
							itemQty[3] = itemQty[2];
						}
					}
				} else {
					next = rng.NextDouble();
					item[0] = save.minerals[save.geodeContents[535][Math.floor(next*save.geodeContents[535].length)]];
					item[1] = save.minerals[save.geodeContents[536][Math.floor(next*save.geodeContents[536].length)]];
					item[2] = save.minerals[save.geodeContents[537][Math.floor(next*save.geodeContents[537].length)]];
					if (rng.NextDouble() < 0.008 && numCracked > 15) {
						item[3] = save.minerals[74];
					} else {
						item[3] = save.minerals[save.geodeContents[749][Math.floor(next*save.geodeContents[749].length)]];
					}
				}
				if (numCracked === save.geodesCracked[0] + 1) {
					tclass = "current";
				} else if (numCracked <= save.geodesCracked[0]) {
					tclass = "past";
				} else {
					tclass = "future";
				}
				output += '<tr class="' + tclass + '"><td>' + addCommas(numCracked) + '</td>';
				for (c = 0; c < numColumns; c++) {
					itemIcon = '';
					if (!save.donatedItems.hasOwnProperty(item[c])) {
						itemIcon = ' <span tooltip="Need to Donate"><img src="blank.png" class="icon" id="gunther" alt="Need to Donate"></span>';
					}
					output += '<td class="item">' + wikify(item[c]) + itemIcon + '</td><td>' + itemQty[c] + '</td>';
				}
				output += '</tr>';
			}
		}
		output += '<tr><td colspan="' + (1 + 2*numColumns) + 
			'" class="legend">Note: <img src="blank.png" class="icon" id="gunther" alt="Need to Donate"> denotes items ' +
			'which need to be donated to the ' + wikify('Museum') + '</td></tr>';
		output += '</tbody></table>';
		return output;
	}

	function predictTrains(isSearch, offset) {
		// logic from StardewValley.Locations.Railroad.DayUpdate()
		var output = '',
			trainTime,
			thisTrain,
			day,
			week,
			weekDay,
			monthName,
			month,
			year,
			tclass,
			hour,
			min,
			ampm,
			rng;
			
		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			$('#train-prev').prop("disabled", true);
			$('#train-next').prop("disabled", true);
			$('#train-reset').html("Clear Search Results &amp; Reset Browsing");
		} else {
			if (typeof(offset) === 'undefined') {
				offset = 28 * Math.floor(save.daysPlayed/28);
			}
			if (offset < 112) {
				$('#train-prev-year').prop("disabled", true);
			} else {
				$('#train-prev-year').val(offset - 112);
				$('#train-prev-year').prop("disabled", false);
			}
			if (offset < 28) {
				$('#train-prev-month').prop("disabled", true);
			} else {
				$('#train-prev-month').val(offset - 28);
				$('#train-prev-month').prop("disabled", false);
			}
			$('#train-reset').val('reset');
			$('#train-next-month').val(offset + 28);
			$('#train-next-year').val(offset + 112);
			month = Math.floor(offset / 28);
			monthName = save.seasonNames[month % 4];
			year = 1 + Math.floor(offset / 112);
			output += '<table class="calendar"><thead><tr><th colspan="7">' + monthName + ' Year ' + year + '</th></tr>\n';
			output += '<tr><th>M</th><th>T</th><th>W</th><th>Th</th><th>F</th><th>Sa</th><th>Su</th></tr></thead>\n<tbody>';
			for (week = 0; week < 4; week++) {
				output += "<tr>";
				for (weekDay = 1; weekDay < 8; weekDay++) {
					day = 7 * week + weekDay + offset;
					rng = new CSRandom(save.gameID / 2 + day + save.dayAdjust);
					if (day < 31) {
						thisTrain = '<span class="none">Railroad<br/>not yet<br/>accessible</span>';
					} else {
						thisTrain = '<span class="none">&nbsp;<br />(No train)<br />&nbsp</span>';
						if (rng.NextDouble() < 0.2) {
							trainTime = rng.Next(900,1800);
							trainTime -= trainTime % 10;
							hour = Math.floor(trainTime / 100);
							min = trainTime % 100;
							if (min < 60) {
								if (hour > 12) {
									hour -= 12;
									ampm = ' pm';
								} else if (hour === 12) {
									ampm = ' pm';
								} else {
									ampm = ' am';
								}
								if (min === 0) {
									min = '00';
								}
								thisTrain = '<img src="blank.png" class="event" id="train"><br />Train at ' + hour + ':' + min + ampm;
							}
						}
					}
					if (day < save.daysPlayed) {
						tclass = "past";
					} else if (day === save.daysPlayed) {
						tclass = "current";
					} else {
						tclass = "future";
					}
					output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br />' +
						'<span class="train cell">' + thisTrain + '</span></td>';
				}
				output += "</tr>\n";
			}
			output += "</tbody></table>\n";
		}

		return output;
	};
	
	function predictNight(isSearch, offset) {
		// logic from StardewValley.Utility.<>c.<pickFarmEvent>b__146_0()
		var output = '',
			thisEvent,
			day,
			week,
			weekDay,
			monthName,
			month,
			year,
			tclass,
			rng;
			
		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			$('#night-prev').prop("disabled", true);
			$('#night-next').prop("disabled", true);
			$('#night-reset').html("Clear Search Results &amp; Reset Browsing");
		} else {
			if (typeof(offset) === 'undefined') {
				offset = 28 * Math.floor(save.daysPlayed/28);
			}
			if (offset < 112) {
				$('#night-prev-year').prop("disabled", true);
			} else {
				$('#night-prev-year').val(offset - 112);
				$('#night-prev-year').prop("disabled", false);
			}
			if (offset < 28) {
				$('#night-prev-month').prop("disabled", true);
			} else {
				$('#night-prev-month').val(offset - 28);
				$('#night-prev-month').prop("disabled", false);
			}
			$('#night-reset').val('reset');
			$('#night-next-month').val(offset + 28);
			$('#night-next-year').val(offset + 112);
			month = Math.floor(offset / 28);
			monthName = save.seasonNames[month % 4];
			year = 1 + Math.floor(offset / 112);
			output += '<table class="calendar"><thead><tr><th colspan="7">' + monthName + ' Year ' + year + '</th></tr>\n';
			output += '<tr><th>M</th><th>T</th><th>W</th><th>Th</th><th>F</th><th>Sa</th><th>Su</th></tr></thead>\n<tbody>';
			for (week = 0; week < 4; week++) {
				output += "<tr>";
				for (weekDay = 1; weekDay < 8; weekDay++) {
					day = 7 * week + weekDay + offset;
					// The event is actually rolled in the morning at 6am, but from a user standpoint it makes more since
					// to think of it occuring during the previous night. We will offset the day by 1 because of this.
					rng = new CSRandom(save.gameID / 2 + day + 1 + save.dayAdjust);
					if (day + save.dayAdjust === 30) {
						thisEvent = '<img src="blank.png" class="event" id="train"><br />Earthquake';
					} else if (save.version < 1.3 && save.canHaveChildren && rng.NextDouble() < 0.05) {
						thisEvent = '<img src="blank.png" class="event" id="event_b"><br />"Want a Baby?"';
					} else if (rng.NextDouble() < 0.01 && (month%4) < 3) {
						thisEvent = '<img src="blank.png" class="event" id="event_f"><br />Fairy';
					} else if (rng.NextDouble() < 0.01) {
						thisEvent = '<img src="blank.png" class="event" id="event_w"><br />Witch';
					} else if (rng.NextDouble() < 0.01) {
						thisEvent = '<img src="blank.png" class="event" id="event_m"><br />Meteor';
					} else if (rng.NextDouble() < 0.01 && year > 1) {
						thisEvent = '<img src="blank.png" class="event" id="event_c"><br />Strange Capsule';
					} else if (rng.NextDouble() < 0.01) {
						thisEvent = '<img src="blank.png" class="event" id="event_o"><br />Stone Owl';
					} else {
						thisEvent = '<span class="none">&nbsp;<br />(No event)<br />&nbsp</span>';
					}

					if (day < save.daysPlayed) {
						tclass = "past";
					} else if (day === save.daysPlayed) {
						tclass = "current";
					} else {
						tclass = "future";
					}
					output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br />' +
						'<span class="night cell">' + thisEvent+ '</span></td>';
				}
				output += "</tr>\n";
			}
			output += "</tbody></table>\n";
		}
		return output;
	};

	function predictCrane(isSearch, offset) {
		// logic from StardewValley.Locations.MovieTheater.addRandomNPCs()
		var output = '',
			thisEvent,
			day,
			week,
			weekDay,
			monthName,
			month,
			year,
			tclass,
			rng;
			
		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			$('#crane-prev').prop("disabled", true);
			$('#crane-next').prop("disabled", true);
			$('#crane-reset').html("Clear Search Results &amp; Reset Browsing");
		} else {
			if (typeof(offset) === 'undefined') {
				offset = 28 * Math.floor(save.daysPlayed/28);
			}
			if (offset < 112) {
				$('#crane-prev-year').prop("disabled", true);
			} else {
				$('#crane-prev-year').val(offset - 112);
				$('#crane-prev-year').prop("disabled", false);
			}
			if (offset < 28) {
				$('#crane-prev-month').prop("disabled", true);
			} else {
				$('#crane-prev-month').val(offset - 28);
				$('#crane-prev-month').prop("disabled", false);
			}
			$('#crane-reset').val('reset');
			$('#crane-next-month').val(offset + 28);
			$('#crane-next-year').val(offset + 112);
			month = Math.floor(offset / 28);
			monthName = save.seasonNames[month % 4];
			year = 1 + Math.floor(offset / 112);
			output += '<table class="calendar"><thead><tr><th colspan="7">' + monthName + ' Year ' + year + '</th></tr>\n';
			output += '<tr><th>M</th><th>T</th><th>W</th><th>Th</th><th>F</th><th>Sa</th><th>Su</th></tr></thead>\n<tbody>';
			for (week = 0; week < 4; week++) {
				output += "<tr>";
				for (weekDay = 1; weekDay < 8; weekDay++) {
					day = 7 * week + weekDay + offset;
					// Game1.Date.TotalDays does not does not include today, so the RNG seed must be offset by 1
					rng = new CSRandom(save.gameID + day + save.dayAdjust - 1);
					//var TEMP = "" + (day + save.dayAdjust -1) + "<br />";
					if (save.version >= 1.4 && rng.NextDouble() < 0.25) {
						thisEvent = '<img src="blank.png" class="event" id="movie_gs"><br />Crane In Use';
					} else {
						thisEvent = '&nbsp;<br />(Crane Free)<br />&nbsp';
					}

					if (day < save.daysPlayed) {
						tclass = "past";
					} else if (day === save.daysPlayed) {
						tclass = "current";
					} else {
						tclass = "future";
					}
					output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br />' +
						'<span class="crane cell">' + thisEvent+ '</span></td>';
				}
				output += "</tr>\n";
			}
			output += "</tbody></table>\n";
		}
		return output;
	};

	function predictWinterStar(isSearch, offset) {
		var output = "",
			// NPC list from Data\NPCDispositions
			npcs = ['Abigail', 'Caroline', 'Clint', 'Demetrius', 'Willy', 'Elliott', 'Emily',
					'Evelyn', 'George', 'Gus', 'Haley', 'Harvey', 'Jas', 'Jodi', 'Alex',
					'Kent', 'Leah', 'Lewis', 'Linus', 'Marlon', 'Marnie', 'Maru', 'Pam',
					'Penny', 'Pierre', 'Robin', 'Sam', 'Sebastian', 'Shane', 'Vincent',
					'Wizard', 'Dwarf', 'Sandy', 'Krobus'],
			giftChoices = { 'Clint': ['Iridium Bar', 'Gold Bar (5)', 'Geode (5)', 'Frozen Geode (5)', 'Magma Geode (5)'],
							'Marnie': ['Egg (12)'],
							'Robin': ['Wood (99)', 'Stone (50)', 'Hardwood (25)'],
							'Willy': ['Warp Totem: Beach (25)', 'Dressed Spinner', 'Magnet'],
							'Evelyn': ['Cookie'],
							'Jas': ['Clay', 'Ancient Doll', 'Rainbow Shell', 'Geode', 'Frozen Geode', 'Magma Geode'],
							'Vincent': ['Clay', 'Ancient Doll', 'Rainbow Shell', 'Geode', 'Frozen Geode', 'Magma Geode'],
							'DEFAULT': ['Pumpkin Pie', 'Poppyseed Muffin', 'Blackberry Cobbler', 'Glow Ring', 'Deluxe Speed-Gro (10)', 'Purple Mushroom', 'Nautilus Shell', 'Wine', 'Beer', 'Tea Set', 'Pink Cake', 'Ruby', 'Emerald', 'Jade'] },
			gifts = '',
			excluded = {'Wizard': 1, 'Krobus': 1, 'Sandy': 1, 'Dwarf': 1, 'Marlon': 1},
			secretSantaGiveTo = '',
			secretSantaGetFrom = '',
			year,
			rng,
			player,
			numPlayers = 1,
			playerName = "Farmer",
			forceOldLogic = false,
			tclass;
		if (typeof(offset) === 'undefined') {
			offset = save.year - 1;
		}
		if (offset < 1) {
			$('#winterstar-prev').prop("disabled", true);
		} else {
			$('#winterstar-prev').val(offset - 1);
			$('#winterstar-prev').prop("disabled", false);
		}
		$('#winterstar-reset').val('reset');
		$('#winterstar-next').val(offset + 1);
		year = offset + 1;

		if (typeof save.names !== "undefined") {
			numPlayers = save.names.length;
			$('#winterstar-note').html('');
		} else {
			forceOldLogic = true;
			$('#winterstar-note').html('Note: No players found; predictions will not be reliable for game version > 1.2');
		}
		
		output += '<table class="output"><thead><tr><th colspan = "4">Year ' + year + '</th></tr>';
		output += '<tr><th>Player</th><th>Player gives gift to</th><th>Player receives gift from</th><th class="long_list">Possible gifts received</th></tr></thead>\n<tbody>';
		for (player = 0; player < numPlayers; player++) {
			// Gift giver and receiver logic from StardewValley.Event.setUpPlayerControlSequence() and StardewValley.Utility.getRandomTownNPC()
			// While it looks like the gift itself might be predictable from StardewValley.Utility.getGiftFromNPC(), the RNG there gets seeded
			// by an expression that includes the NPC's X coordinate, and (based on in-game testing) that seems to be from a pre-festival
			// position which is not easily predictable.
			if (forceOldLogic || save.version < 1.3) {
				rng = new CSRandom(save.gameID / 2 - year);
			} else {
				// Using BigInteger Library to convert the UniqueMultiplayerID to integer since these IDs can exceed JS' integer storage
				var UMP_ID = parseInt(bigInt(save.mp_ids[player]).and(0xffffffff));
				var seed = parseInt(save.gameID / 2) ^ year ^ UMP_ID;
				rng = new CSRandom( seed );
				playerName = save.names[player];
			}
			secretSantaGiveTo = npcs[rng.Next(npcs.length)];
			secretSantaGetFrom = '';
			// In addition to 5 hardcoded exclusions, NPCs are not eligible if they haven't been met yet; technically we should probably be
			// searching the save to make sure the target has been met, but for now we simply exclude year 1 Kent and assume the rest are fine.
			while (excluded.hasOwnProperty(secretSantaGiveTo) || (year === 1 && secretSantaGiveTo === 'Kent')) {
				secretSantaGiveTo = npcs[rng.Next(npcs.length)];
			}
			while (secretSantaGetFrom === '' || secretSantaGetFrom === secretSantaGiveTo || excluded.hasOwnProperty(secretSantaGetFrom) ||
				(year === 1 && secretSantaGetFrom === 'Kent') ) {
				secretSantaGetFrom = npcs[rng.Next(npcs.length)];
			}
			if (year < save.year) {
				tclass = "past";
			} else if (year === save.year) {
				tclass = "current";
			} else {
				tclass = "future";
			}
			if (giftChoices.hasOwnProperty(secretSantaGetFrom)) {
				gifts = (giftChoices[secretSantaGetFrom]).map(function (i) { return wikify(i); }).sort().join(', ');
			} else {
				gifts = (giftChoices['DEFAULT']).map(function (i) { return wikify(i); }).sort().join(', ');
			}
			output += '<tr class="' + tclass + '"><td>' + playerName + "</td><td>" + wikify(secretSantaGiveTo) +
				"</td><td>" + wikify(secretSantaGetFrom) + '</td><td class="long_list">' + gifts + "</td></tr>\n";
		}
		output += "</tbody></table>\n";
		return output;
	}

	function updateTab(tabID, isSearch, extra) {
		var output = '';
		if (tabID === 'mines') {
			output = predictMines(isSearch, extra);
		} else if (tabID === 'cart') {
			output = predictCart(isSearch, extra);
		} else if (tabID === 'geode') {
			output = predictGeodes(isSearch, extra);
		} else if (tabID === 'train') {
			output = predictTrains(isSearch, extra);
		} else if (tabID === 'night') {
			output = predictNight(isSearch, extra);
		} else if (tabID === 'crane') {
			output = predictCrane(isSearch, extra);
		} else if (tabID === 'krobus') {
			output = predictKrobus(isSearch, extra);
		} else if (tabID === 'sandy') {
			output = predictSandy(isSearch, extra);
		} else if (tabID === 'wallpaper') {
			output = predictWallpaper(isSearch, extra);
		} else if (tabID === 'winterstar') {
			output = predictWinterStar(isSearch, extra);
		} else {
			console.log("Unknown tabID: " + tabID);
		}
		document.getElementById('out-' + tabID).innerHTML = output;
	}

	function initializeHandlers() {
		$("button[class='browse']").click(function () { buttonHandler(this); });
		$("button[class='search']").click(function () { searchHandler(this); });
		$("input[class='search']").keyup(function(e) {
			if (e.keyCode === 13) {
				e.preventDefault();
				searchHandler(this);
		} });
		$("button").prop('disabled',false);
	}

	function updateOutput(xmlDoc) {
		document.getElementById('out-summary').innerHTML = parseSummary(xmlDoc);
		$("input[name='tabset']").each(function() { updateTab(this.id.split('-')[1], false); });
		$('#output-container').show();
		return;
	}

	function handleFileSelect(evt) {
		var file = evt.target.files[0],
			reader = new FileReader(),
			prog = document.getElementById('progress');

		prog.value = 0;
		$('#output-container').hide();
		$('#progress-container').show();
		$('#changelog').hide();
		reader.onloadstart = function (e) {
			prog.value = 20;
		};
		reader.onprogress = function (e) {
			if (e.lengthComputable) {
				var p = 20 + (e.loaded / e.total * 60);
				prog.value = p;
			}
		};
		reader.onload = function (e) {
			var xmlDoc = $.parseXML(e.target.result);
			prog.value = 100;
			updateOutput(xmlDoc);
			$('#progress-container').hide();
		};
		reader.readAsText(file);
	}

	function toggleVisible(evt) {
		var t = evt.target;
		if ($(t).next().is(':visible')) {
			$(t).next().hide();
			$(t).html("Show");
		} else {
			$(t).next().show();
			$(t).html("Hide");
		}
	}
	
	document.getElementById('file_select').addEventListener('change', handleFileSelect, false);
	initializeHandlers();
	$('.collapsible').each(function() {
		$(this).children('button').click(toggleVisible);
	});
	// Run output immediately if an ID was given in the URL
	if ($.QueryString.hasOwnProperty("id")) {
		updateOutput();
	}
};