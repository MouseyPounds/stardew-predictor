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
                b[p[0].toLowerCase()] = decodeURIComponent(p[1].replace(/\+/g, " "));
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
	// We used to initialize a bunch of game data here but some of that data needs to be altered depending on the game version
	// (e.g. 1.6 adding an item to the geode contents for Artifact Trove)
	// Because of this we have moved all that initialization to parseSummary();

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

	function compareSemVer(a, b) {
		// semver-compare by James Halliday ("substack") @ https://github.com/substack/semver-compare
		var pa = a.split('.');
		var pb = b.split('.');
		for (var i = 0; i < 3; i++) {
			var na = Number(pa[i]);
			var nb = Number(pb[i]);
			if (na > nb) return 1;
			if (nb > na) return -1;
			if (!isNaN(na) && isNaN(nb)) return 1;
			if (isNaN(na) && !isNaN(nb)) return -1;
		}
		return 0;
	}

	function wikify(item, page) {
		// removing egg colors & quantity amounts; changing spaces to underscores
		if (typeof(item) == "undefined") { return "undefined"; }
		var trimmed = item.replace(' (White)', '');
		trimmed = trimmed.replace(' (Brown)', '');
		trimmed = trimmed.replace(' (Any)', '');
		trimmed = trimmed.replace(/ \(\d+\)/, '');
		trimmed = trimmed.replace(/ /g, '_');
		return (page) ? ('<a href="http://stardewvalleywiki.com/' + page + '#' + trimmed + '">' + item + '</a>') :
					('<a href="http://stardewvalleywiki.com/' + trimmed + '">' + item + '</a>');
	}

	// Wrapper function to check URL parameters and change save properties if they are set
	// Prioritizes the longer parameter name
	// Returns true if an override was done and false otherwise
	function overrideSaveData(prop, longName, shortName, type = "text") {
		if (save.hasOwnProperty(prop)) {
			var queryProp;
			var lcLong = longName.toLowerCase();
			var lcShort = shortName.toLowerCase()
			if ($.QueryString.hasOwnProperty(lcLong)) {
				queryProp = lcLong;
			} else if ($.QueryString.hasOwnProperty(lcShort)) {
				queryProp = lcShort;
			} else {
				return false;
			}
			if (type === 'text' || type === 'string' ) {
				save[prop] = $.QueryString[queryProp];
			} else if (type === 'bigint' ) {
				save[prop] = bigInt($.QueryString[queryProp]);
			} else if (type === 'num' || type === 'int' ) {
				save[prop] = Number($.QueryString[queryProp]);
			} else if (type === 'array') {
				if (typeof(save[prop]) === 'undefined') { 
					save[prop] = [Number($.QueryString[queryProp])];
				} else {
					save[prop][0] = Number($.QueryString[queryProp]);
				}
			} else if (type === 'bool') {
				save[prop] = ($.QueryString[queryProp] != 0);
			} else {
				console.log("Unknown override type: " + type);
				return false;
			}
		} else {
			console.log("Tried to override non-existent save property: " + prop);
			return false;
		}
		return true;
	};

	// These 2 functions force a big Int into an integer which is usually needed when
	// mimicing game code that typecasts UniqueMultiplayerIDs into ints.
	// WARNING: These can lose precision; only use this when game is typecasting.
	function bigIntToUnsigned32(big) {
		return big.and(0xffffffff).toJSNumber();
	}

	function bigIntToSigned32(big) {
		return Math.imul(1, bigIntToUnsigned32(big));
	}

	// bigInt wrapper for getRandomSeed to be called if the params are bigInts
	function getRandomSeedFromBigInts(a, b, c, d, e) {
		for (var arg = 0; arg < arguments.length; arg++) {
			if (typeof arguments[arg] !== 'undefined') {
				arguments[arg] = arguments[arg].mod(2147483647).toJSNumber();
			}
		}
		return getRandomSeed(a, b, c, d, e);
	}

	// These helper functions mimic the RNG wrappers of Stardew 1.6
	function getRandomSeed(a, b = 0, c = 0, d = 0, e = 0) {
		// Calculates seed value based on logic of StardewValley.Utility.CreateRandomSeed()
		// Note that we will call this directly always rather than using a "DaySave" wrapper because most of our predictions
		// iterate over multiple days. The standard DaySave wrapper sets a = days played and b = gameID/2
		if (save.useLegacyRandom) {
			return Math.floor((a % 2147483647 + b % 2147483647 + c % 2147483647 + d % 2147483647 + e % 2147483647) % 2147483647);
		} else {
			return getHashFromArray(a % 2147483647, b % 2147483647, c % 2147483647, d % 2147483647, e % 2147483647);
		}
	}

	function getHashFromString(value) {
		// JS implementation of StardewValley.Utility.GetDeterministicHashCode() with string argument
		var TE = new TextEncoder();
		var H = XXH.h32();
		return H.update(TE.encode(value).buffer).digest().toNumber();
	}

	function getHashFromArray(...values) {
		// JS implementation of StardewValley.Utility.GetDeterministicHashCode() with int array argument
		var array = new Int32Array(values);
		var H = XXH.h32();
		return H.update(array.buffer).digest().toNumber();
	}

	function parseSummary(xmlDoc) {
		// farmTypes changed to object after 1.6 added ability for string keys
		var output = '',
			farmTypes = {
				0: 'Standard',
				1: 'Riverland',
				2: 'Forest',
				3: 'Hill-top',
				4: 'Wilderness',
				5: 'Four Corners',
				6: 'Beach',
				"MeadowlandsFarm": 'Meadowlands',
			};
		// Although this stuff isn't really part of the save file, the save object is global and using it for 
		// this meta-information lets all the tab functions have access.
		// cartItems and cartItems_1_4 are giant hardcoded lists that allowed us to simplify the item selection logic
		// for the traveling merchant but these are obsolete as of Stardew 1.6 and only still exist here for backwards
		// compatibility when reading older saves. Note that the IDs are offset by 1 from the actual Object IDs
		// and that there is a ton of repetition because of the specific logic of pre-1.4 stardew.
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
			176: 'Egg (White)',
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
			266: 'Red Cabbage',
			268: 'Starfruit',
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
			445: 'Caviar',
			267: 'Flounder',
			265: 'Seafoam Pudding',
			269: 'Midnight Carp',
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
			535: ["_538", "_542", "_548", "_549", "_552", "_555", "_556", "_557", "_558", "_566", "_568", "_569", "_571", "_574", "_576", "_121"],
			536: ["_541", "_544", "_545", "_546", "_550", "_551", "_559", "_560", "_561", "_564", "_567", "_572", "_573", "_577", "_123"],
			537: ["_539", "_540", "_543", "_547", "_553", "_554", "_562", "_563", "_565", "_570", "_575", "_578", "_122"],
			749: ["_538", "_542", "_548", "_549", "_552", "_555", "_556", "_557", "_558", "_566", "_568", "_569", "_571", "_574", "_576", "_541", "_544", "_545", "_546", "_550", "_551", "_559", "_560", "_561", "_564", "_567", "_572", "_573", "_577", "_539", "_540", "_543", "_547", "_553", "_554", "_562", "_563", "_565", "_570", "_575", "_578", "_121", "_122", "_123"],
			275: ["_100", "_101", "_103", "_104", "_105", "_106", "_108", "_109", "_110", "_111", "_112", "_113", "_114", "_115", "_116", "_117", "_118", "_119", "_120", "_121", "_122", "_123", "_124", "_125", "_166", "_373", "_797"],
			791: ["_69", "_835", "_833", "_831", "_820", "_292", "_386"]
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
		save.weapons = {
			0: "Rusty Sword",
			1: "Silver Saber",
			2: "Dark Sword",
			3: "Holy Blade",
			4: "Galaxy Sword",
			5: "Bone Sword",
			6: "Iron Edge",
			7: "Templar's Blade",
			8: "Obsidian Edge",
			9: "Lava Katana",
			10: "Claymore",
			11: "Steel Smallsword",
			12: "Wooden Blade",
			13: "Insect Head",
			14: "Neptune's Glaive",
			15: "Forest Sword",
			16: "Carving Knife",
			17: "Iron Dirk",
			18: "Burglar's Shank",
			19: "Shadow Dagger",
			20: "Elf Blade",
			21: "Crystal Dagger",
			22: "Wind Spire",
			23: "Galaxy Dagger",
			24: "Wood Club",
			25: "Alex's Bat",
			26: "Lead Rod",
			27: "Wood Mallet",
			28: "The Slammer",
			29: "Galaxy Hammer",
			30: "Sam's Old Guitar",
			31: "Femur",
			32: "Slingshot",
			33: "Master Slingshot",
			34: "Galaxy Slingshot",
			35: "Elliott's Pencil",
			36: "Maru's Wrench",
			37: "Harvey's Mallet",
			38: "Penny's Fryer",
			39: "Leah's Whittler",
			40: "Abby's Planchette",
			41: "Seb's Lost Mace",
			42: "Haley's Iron",
			43: "Pirate's Sword",
			44: "Cutlass",
			45: "Wicked Kris",
			46: "Kudgel",
			47: "Scythe",
			48: "Yeti Tooth",
			49: "Rapier",
			50: "Steel Falchion",
			51: "Broken Trident",
			52: "Tempered Broadsword",
			53: "Golden Scythe",
			54: "Dwarf Sword",
			55: "Dwarf Hammer",
			56: "Dwarf Dagger",
			57: "Dragontooth Cutlass",
			58: "Dragontooth Club",
			59: "Dragontooth Shiv",
			60: "Ossified Blade",
			61: "Iridium Needle",
			62: "Infinity Blade",
			63: "Infinity Gavel",
			64: "Infinity Dagger",
		};
		save.boots = {
			504: "Sneakers",
			505: "Rubber Boots",
			506: "Leather Boots",
			507: "Work Boots",
			508: "Combat Boots",
			509: "Tundra Boots",
			510: "Thermal Boots",
			511: "Dark Boots",
			512: "Firewalker Boots",
			513: "Genie Shoes",
			514: "Space Boots",
			515: "Cowboy Boots",
			804: "Emily's Magic Boots",
			806: "Leprechaun Shoes",
			853: "Cinderclown Shoes",
			854: "Mermaid Boots",
			855: "Dragonscale Boots",
			878: "Crystal Shoes"
		};

		// Starting in version 1.6, many predictions can no longer use a pre-filtered list and instead need the full
		// list of objects. These structures are essentially subsets of Data files with only certain fields used.
		// All IDs (numeric and string) have been prefaced with an underscore to preserve order when iterating.
		// I don't even know where/how wallpaper and flooring data is defined so those are just completely made up.
		save.objects = {
			"_0": { 'id': "0", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_2": { 'id': "2", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_4": { 'id': "4", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_6": { 'id': "6", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_8": { 'id': "8", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_10": { 'id': "10", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_12": { 'id': "12", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_14": { 'id': "14", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_16": { 'id': "16", 'name': "Wild Horseradish", 'type': "Basic", 'category': -81, 'price': 50, 'offlimits': false },
			"_18": { 'id': "18", 'name': "Daffodil", 'type': "Basic", 'category': -81, 'price': 30, 'offlimits': false },
			"_20": { 'id': "20", 'name': "Leek", 'type': "Basic", 'category': -81, 'price': 60, 'offlimits': false },
			"_22": { 'id': "22", 'name': "Dandelion", 'type': "Basic", 'category': -81, 'price': 40, 'offlimits': false },
			"_24": { 'id': "24", 'name': "Parsnip", 'type': "Basic", 'category': -75, 'price': 35, 'offlimits': false },
			"_30": { 'id': "30", 'name': "Lumber", 'type': "Basic", 'category': 0, 'price': 2, 'offlimits': false },
			"_32": { 'id': "32", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_34": { 'id': "34", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_36": { 'id': "36", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_38": { 'id': "38", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_40": { 'id': "40", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_42": { 'id': "42", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_44": { 'id': "44", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_46": { 'id': "46", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_48": { 'id': "48", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_50": { 'id': "50", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_52": { 'id': "52", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_54": { 'id': "54", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_56": { 'id': "56", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_58": { 'id': "58", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_60": { 'id': "60", 'name': "Emerald", 'type': "Minerals", 'category': -2, 'price': 250, 'offlimits': false },
			"_62": { 'id': "62", 'name': "Aquamarine", 'type': "Minerals", 'category': -2, 'price': 180, 'offlimits': false },
			"_64": { 'id': "64", 'name': "Ruby", 'type': "Minerals", 'category': -2, 'price': 250, 'offlimits': false },
			"_66": { 'id': "66", 'name': "Amethyst", 'type': "Minerals", 'category': -2, 'price': 100, 'offlimits': false },
			"_68": { 'id': "68", 'name': "Topaz", 'type': "Minerals", 'category': -2, 'price': 80, 'offlimits': false },
			"_70": { 'id': "70", 'name': "Jade", 'type': "Minerals", 'category': -2, 'price': 200, 'offlimits': false },
			"_71": { 'id': "71", 'name': "Trimmed Lucky Purple Shorts", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_72": { 'id': "72", 'name': "Diamond", 'type': "Minerals", 'category': -2, 'price': 750, 'offlimits': false },
			"_74": { 'id': "74", 'name': "Prismatic Shard", 'type': "Minerals", 'category': -2, 'price': 2000, 'offlimits': false },
			"_75": { 'id': "75", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_76": { 'id': "76", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_77": { 'id': "77", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_78": { 'id': "78", 'name': "Cave Carrot", 'type': "Basic", 'category': -81, 'price': 25, 'offlimits': false },
			"_79": { 'id': "79", 'name': "Secret Note", 'type': "asdf", 'category': 0, 'price': 1, 'offlimits': true },
			"_80": { 'id': "80", 'name': "Quartz", 'type': "Minerals", 'category': -2, 'price': 25, 'offlimits': false },
			"_82": { 'id': "82", 'name': "Fire Quartz", 'type': "Minerals", 'category': -2, 'price': 100, 'offlimits': false },
			"_84": { 'id': "84", 'name': "Frozen Tear", 'type': "Minerals", 'category': -2, 'price': 75, 'offlimits': false },
			"_86": { 'id': "86", 'name': "Earth Crystal", 'type': "Minerals", 'category': -2, 'price': 50, 'offlimits': false },
			"_88": { 'id': "88", 'name': "Coconut", 'type': "Basic", 'category': -79, 'price': 100, 'offlimits': false },
			"_90": { 'id': "90", 'name': "Cactus Fruit", 'type': "Basic", 'category': -79, 'price': 75, 'offlimits': false },
			"_92": { 'id': "92", 'name': "Sap", 'type': "Basic", 'category': -81, 'price': 2, 'offlimits': false },
			"_93": { 'id': "93", 'name': "Torch", 'type': "Crafting", 'category': 0, 'price': 5, 'offlimits': false },
			"_94": { 'id': "94", 'name': "Spirit Torch", 'type': "Crafting", 'category': 0, 'price': 5, 'offlimits': false },
			"_95": { 'id': "95", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_96": { 'id': "96", 'name': "Dwarf Scroll I", 'type': "Arch", 'category': 0, 'price': 1, 'offlimits': false },
			"_97": { 'id': "97", 'name': "Dwarf Scroll II", 'type': "Arch", 'category': 0, 'price': 1, 'offlimits': false },
			"_98": { 'id': "98", 'name': "Dwarf Scroll III", 'type': "Arch", 'category': 0, 'price': 1, 'offlimits': false },
			"_99": { 'id': "99", 'name': "Dwarf Scroll IV", 'type': "Arch", 'category': 0, 'price': 1, 'offlimits': false },
			"_100": { 'id': "100", 'name': "Chipped Amphora", 'type': "Arch", 'category': 0, 'price': 40, 'offlimits': false },
			"_101": { 'id': "101", 'name': "Arrowhead", 'type': "Arch", 'category': 0, 'price': 40, 'offlimits': false },
			"_102": { 'id': "102", 'name': "Lost Book", 'type': "asdf", 'category': 0, 'price': 0, 'offlimits': false },
			"_103": { 'id': "103", 'name': "Ancient Doll", 'type': "Arch", 'category': 0, 'price': 60, 'offlimits': false },
			"_104": { 'id': "104", 'name': "Elvish Jewelry", 'type': "Arch", 'category': 0, 'price': 200, 'offlimits': false },
			"_105": { 'id': "105", 'name': "Chewing Stick", 'type': "Arch", 'category': 0, 'price': 50, 'offlimits': false },
			"_106": { 'id': "106", 'name': "Ornamental Fan", 'type': "Arch", 'category': 0, 'price': 300, 'offlimits': false },
			"_107": { 'id': "107", 'name': "Dinosaur Egg", 'type': "Arch", 'category': 0, 'price': 350, 'offlimits': false },
			"_108": { 'id': "108", 'name': "Rare Disc", 'type': "Arch", 'category': 0, 'price': 300, 'offlimits': false },
			"_109": { 'id': "109", 'name': "Ancient Sword", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_110": { 'id': "110", 'name': "Rusty Spoon", 'type': "Arch", 'category': 0, 'price': 25, 'offlimits': false },
			"_111": { 'id': "111", 'name': "Rusty Spur", 'type': "Arch", 'category': 0, 'price': 25, 'offlimits': false },
			"_112": { 'id': "112", 'name': "Rusty Cog", 'type': "Arch", 'category': 0, 'price': 25, 'offlimits': false },
			"_113": { 'id': "113", 'name': "Chicken Statue", 'type': "Arch", 'category': 0, 'price': 50, 'offlimits': false },
			"_114": { 'id': "114", 'name': "Ancient Seed", 'type': "Arch", 'category': 0, 'price': 5, 'offlimits': false },
			"_115": { 'id': "115", 'name': "Prehistoric Tool", 'type': "Arch", 'category': 0, 'price': 50, 'offlimits': false },
			"_116": { 'id': "116", 'name': "Dried Starfish", 'type': "Arch", 'category': 0, 'price': 40, 'offlimits': false },
			"_117": { 'id': "117", 'name': "Anchor", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_118": { 'id': "118", 'name': "Glass Shards", 'type': "Arch", 'category': 0, 'price': 20, 'offlimits': false },
			"_119": { 'id': "119", 'name': "Bone Flute", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_120": { 'id': "120", 'name': "Prehistoric Handaxe", 'type': "Arch", 'category': 0, 'price': 50, 'offlimits': false },
			"_121": { 'id': "121", 'name': "Dwarvish Helm", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_122": { 'id': "122", 'name': "Dwarf Gadget", 'type': "Arch", 'category': 0, 'price': 200, 'offlimits': false },
			"_123": { 'id': "123", 'name': "Ancient Drum", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_124": { 'id': "124", 'name': "Golden Mask", 'type': "Arch", 'category': 0, 'price': 500, 'offlimits': false },
			"_125": { 'id': "125", 'name': "Golden Relic", 'type': "Arch", 'category': 0, 'price': 250, 'offlimits': false },
			"_126": { 'id': "126", 'name': "Strange Doll", 'type': "Arch", 'category': 0, 'price': 1000, 'offlimits': false },
			"_127": { 'id': "127", 'name': "Strange Doll", 'type': "Arch", 'category': 0, 'price': 1000, 'offlimits': false },
			"_128": { 'id': "128", 'name': "Pufferfish", 'type': "Fish", 'category': -4, 'price': 200, 'offlimits': false },
			"_129": { 'id': "129", 'name': "Anchovy", 'type': "Fish", 'category': -4, 'price': 30, 'offlimits': false },
			"_130": { 'id': "130", 'name': "Tuna", 'type': "Fish", 'category': -4, 'price': 100, 'offlimits': false },
			"_131": { 'id': "131", 'name': "Sardine", 'type': "Fish", 'category': -4, 'price': 40, 'offlimits': false },
			"_132": { 'id': "132", 'name': "Bream", 'type': "Fish", 'category': -4, 'price': 45, 'offlimits': false },
			"_136": { 'id': "136", 'name': "Largemouth Bass", 'type': "Fish", 'category': -4, 'price': 100, 'offlimits': false },
			"_137": { 'id': "137", 'name': "Smallmouth Bass", 'type': "Fish", 'category': -4, 'price': 50, 'offlimits': false },
			"_138": { 'id': "138", 'name': "Rainbow Trout", 'type': "Fish", 'category': -4, 'price': 65, 'offlimits': false },
			"_139": { 'id': "139", 'name': "Salmon", 'type': "Fish", 'category': -4, 'price': 75, 'offlimits': false },
			"_140": { 'id': "140", 'name': "Walleye", 'type': "Fish", 'category': -4, 'price': 105, 'offlimits': false },
			"_141": { 'id': "141", 'name': "Perch", 'type': "Fish", 'category': -4, 'price': 55, 'offlimits': false },
			"_142": { 'id': "142", 'name': "Carp", 'type': "Fish", 'category': -4, 'price': 30, 'offlimits': false },
			"_143": { 'id': "143", 'name': "Catfish", 'type': "Fish", 'category': -4, 'price': 200, 'offlimits': false },
			"_144": { 'id': "144", 'name': "Pike", 'type': "Fish", 'category': -4, 'price': 100, 'offlimits': false },
			"_145": { 'id': "145", 'name': "Sunfish", 'type': "Fish", 'category': -4, 'price': 30, 'offlimits': false },
			"_146": { 'id': "146", 'name': "Red Mullet", 'type': "Fish", 'category': -4, 'price': 75, 'offlimits': false },
			"_147": { 'id': "147", 'name': "Herring", 'type': "Fish", 'category': -4, 'price': 30, 'offlimits': false },
			"_148": { 'id': "148", 'name': "Eel", 'type': "Fish", 'category': -4, 'price': 85, 'offlimits': false },
			"_149": { 'id': "149", 'name': "Octopus", 'type': "Fish", 'category': -4, 'price': 150, 'offlimits': false },
			"_150": { 'id': "150", 'name': "Red Snapper", 'type': "Fish", 'category': -4, 'price': 50, 'offlimits': false },
			"_151": { 'id': "151", 'name': "Squid", 'type': "Fish", 'category': -4, 'price': 80, 'offlimits': false },
			"_152": { 'id': "152", 'name': "Seaweed", 'type': "Fish", 'category': 0, 'price': 20, 'offlimits': false },
			"_153": { 'id': "153", 'name': "Green Algae", 'type': "Fish", 'category': 0, 'price': 15, 'offlimits': false },
			"_154": { 'id': "154", 'name': "Sea Cucumber", 'type': "Fish", 'category': -4, 'price': 75, 'offlimits': false },
			"_155": { 'id': "155", 'name': "Super Cucumber", 'type': "Fish", 'category': -4, 'price': 250, 'offlimits': false },
			"_156": { 'id': "156", 'name': "Ghostfish", 'type': "Fish", 'category': -4, 'price': 45, 'offlimits': false },
			"_157": { 'id': "157", 'name': "White Algae", 'type': "Fish", 'category': 0, 'price': 25, 'offlimits': false },
			"_158": { 'id': "158", 'name': "Stonefish", 'type': "Fish", 'category': -4, 'price': 300, 'offlimits': true },
			"_159": { 'id': "159", 'name': "Crimsonfish", 'type': "Fish", 'category': -4, 'price': 1500, 'offlimits': true },
			"_160": { 'id': "160", 'name': "Angler", 'type': "Fish", 'category': -4, 'price': 900, 'offlimits': true },
			"_161": { 'id': "161", 'name': "Ice Pip", 'type': "Fish", 'category': -4, 'price': 500, 'offlimits': true },
			"_162": { 'id': "162", 'name': "Lava Eel", 'type': "Fish", 'category': -4, 'price': 700, 'offlimits': true },
			"_163": { 'id': "163", 'name': "Legend", 'type': "Fish", 'category': -4, 'price': 5000, 'offlimits': true },
			"_164": { 'id': "164", 'name': "Sandfish", 'type': "Fish", 'category': -4, 'price': 75, 'offlimits': false },
			"_165": { 'id': "165", 'name': "Scorpion Carp", 'type': "Fish", 'category': -4, 'price': 150, 'offlimits': false },
			"_166": { 'id': "166", 'name': "Treasure Chest", 'type': "Basic", 'category': 0, 'price': 5000, 'offlimits': false },
			"_167": { 'id': "167", 'name': "Joja Cola", 'type': "Fish", 'category': -20, 'price': 25, 'offlimits': false },
			"_168": { 'id': "168", 'name': "Trash", 'type': "Fish", 'category': -20, 'price': 0, 'offlimits': false },
			"_169": { 'id': "169", 'name': "Driftwood", 'type': "Fish", 'category': -20, 'price': 0, 'offlimits': false },
			"_170": { 'id': "170", 'name': "Broken Glasses", 'type': "Fish", 'category': -20, 'price': 0, 'offlimits': false },
			"_171": { 'id': "171", 'name': "Broken CD", 'type': "Fish", 'category': -20, 'price': 0, 'offlimits': false },
			"_172": { 'id': "172", 'name': "Soggy Newspaper", 'type': "Fish", 'category': -20, 'price': 0, 'offlimits': false },
			"_176": { 'id': "176", 'name': "Egg (White)", 'type': "Basic", 'category': -5, 'price': 50, 'offlimits': false },
			"_174": { 'id': "174", 'name': "Large Egg (White)", 'type': "Basic", 'category': -5, 'price': 95, 'offlimits': false },
			"_178": { 'id': "178", 'name': "Hay", 'type': "Basic", 'category': 0, 'price': 0, 'offlimits': false },
			"_180": { 'id': "180", 'name': "Egg (Brown)", 'type': "Basic", 'category': -5, 'price': 50, 'offlimits': false },
			"_182": { 'id': "182", 'name': "Large Egg (Brown)", 'type': "Basic", 'category': -5, 'price': 95, 'offlimits': false },
			"_184": { 'id': "184", 'name': "Milk", 'type': "Basic", 'category': -6, 'price': 125, 'offlimits': false },
			"_186": { 'id': "186", 'name': "Large Milk", 'type': "Basic", 'category': -6, 'price': 190, 'offlimits': false },
			"_188": { 'id': "188", 'name': "Green Bean", 'type': "Basic", 'category': -75, 'price': 40, 'offlimits': false },
			"_190": { 'id': "190", 'name': "Cauliflower", 'type': "Basic", 'category': -75, 'price': 175, 'offlimits': false },
			"_191": { 'id': "191", 'name': "Ornate Necklace", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_192": { 'id': "192", 'name': "Potato", 'type': "Basic", 'category': -75, 'price': 80, 'offlimits': false },
			"_194": { 'id': "194", 'name': "Fried Egg", 'type': "Cooking", 'category': -7, 'price': 35, 'offlimits': false },
			"_195": { 'id': "195", 'name': "Omelet", 'type': "Cooking", 'category': -7, 'price': 125, 'offlimits': false },
			"_196": { 'id': "196", 'name': "Salad", 'type': "Cooking", 'category': -7, 'price': 110, 'offlimits': false },
			"_197": { 'id': "197", 'name': "Cheese Cauliflower", 'type': "Cooking", 'category': -7, 'price': 300, 'offlimits': false },
			"_198": { 'id': "198", 'name': "Baked Fish", 'type': "Cooking", 'category': -7, 'price': 100, 'offlimits': false },
			"_199": { 'id': "199", 'name': "Parsnip Soup", 'type': "Cooking", 'category': -7, 'price': 120, 'offlimits': false },
			"_200": { 'id': "200", 'name': "Vegetable Medley", 'type': "Cooking", 'category': -7, 'price': 120, 'offlimits': false },
			"_201": { 'id': "201", 'name': "Complete Breakfast", 'type': "Cooking", 'category': -7, 'price': 350, 'offlimits': false },
			"_202": { 'id': "202", 'name': "Fried Calamari", 'type': "Cooking", 'category': -7, 'price': 150, 'offlimits': false },
			"_203": { 'id': "203", 'name': "Strange Bun", 'type': "Cooking", 'category': -7, 'price': 225, 'offlimits': false },
			"_204": { 'id': "204", 'name': "Lucky Lunch", 'type': "Cooking", 'category': -7, 'price': 250, 'offlimits': false },
			"_205": { 'id': "205", 'name': "Fried Mushroom", 'type': "Cooking", 'category': -7, 'price': 200, 'offlimits': false },
			"_206": { 'id': "206", 'name': "Pizza", 'type': "Cooking", 'category': -7, 'price': 300, 'offlimits': false },
			"_207": { 'id': "207", 'name': "Bean Hotpot", 'type': "Cooking", 'category': -7, 'price': 100, 'offlimits': false },
			"_208": { 'id': "208", 'name': "Glazed Yams", 'type': "Cooking", 'category': -7, 'price': 200, 'offlimits': false },
			"_209": { 'id': "209", 'name': "Carp Surprise", 'type': "Cooking", 'category': -7, 'price': 150, 'offlimits': false },
			"_210": { 'id': "210", 'name': "Hashbrowns", 'type': "Cooking", 'category': -7, 'price': 120, 'offlimits': false },
			"_211": { 'id': "211", 'name': "Pancakes", 'type': "Cooking", 'category': -7, 'price': 80, 'offlimits': false },
			"_212": { 'id': "212", 'name': "Salmon Dinner", 'type': "Cooking", 'category': -7, 'price': 300, 'offlimits': false },
			"_213": { 'id': "213", 'name': "Fish Taco", 'type': "Cooking", 'category': -7, 'price': 500, 'offlimits': false },
			"_214": { 'id': "214", 'name': "Crispy Bass", 'type': "Cooking", 'category': -7, 'price': 150, 'offlimits': false },
			"_215": { 'id': "215", 'name': "Pepper Poppers", 'type': "Cooking", 'category': -7, 'price': 200, 'offlimits': false },
			"_216": { 'id': "216", 'name': "Bread", 'type': "Cooking", 'category': -7, 'price': 60, 'offlimits': false },
			"_218": { 'id': "218", 'name': "Tom Kha Soup", 'type': "Cooking", 'category': -7, 'price': 250, 'offlimits': false },
			"_219": { 'id': "219", 'name': "Trout Soup", 'type': "Cooking", 'category': -7, 'price': 100, 'offlimits': false },
			"_220": { 'id': "220", 'name': "Chocolate Cake", 'type': "Cooking", 'category': -7, 'price': 200, 'offlimits': false },
			"_221": { 'id': "221", 'name': "Pink Cake", 'type': "Cooking", 'category': -7, 'price': 480, 'offlimits': false },
			"_222": { 'id': "222", 'name': "Rhubarb Pie", 'type': "Cooking", 'category': -7, 'price': 400, 'offlimits': false },
			"_223": { 'id': "223", 'name': "Cookie", 'type': "Cooking", 'category': -7, 'price': 140, 'offlimits': false },
			"_224": { 'id': "224", 'name': "Spaghetti", 'type': "Cooking", 'category': -7, 'price': 120, 'offlimits': false },
			"_225": { 'id': "225", 'name': "Fried Eel", 'type': "Cooking", 'category': -7, 'price': 120, 'offlimits': false },
			"_226": { 'id': "226", 'name': "Spicy Eel", 'type': "Cooking", 'category': -7, 'price': 175, 'offlimits': false },
			"_227": { 'id': "227", 'name': "Sashimi", 'type': "Cooking", 'category': -7, 'price': 75, 'offlimits': false },
			"_228": { 'id': "228", 'name': "Maki Roll", 'type': "Cooking", 'category': -7, 'price': 220, 'offlimits': false },
			"_229": { 'id': "229", 'name': "Tortilla", 'type': "Cooking", 'category': -7, 'price': 50, 'offlimits': false },
			"_230": { 'id': "230", 'name': "Red Plate", 'type': "Cooking", 'category': -7, 'price': 400, 'offlimits': false },
			"_231": { 'id': "231", 'name': "Eggplant Parmesan", 'type': "Cooking", 'category': -7, 'price': 200, 'offlimits': false },
			"_232": { 'id': "232", 'name': "Rice Pudding", 'type': "Cooking", 'category': -7, 'price': 260, 'offlimits': false },
			"_233": { 'id': "233", 'name': "Ice Cream", 'type': "Cooking", 'category': -7, 'price': 120, 'offlimits': false },
			"_234": { 'id': "234", 'name': "Blueberry Tart", 'type': "Cooking", 'category': -7, 'price': 150, 'offlimits': false },
			"_235": { 'id': "235", 'name': "Autumn's Bounty", 'type': "Cooking", 'category': -7, 'price': 350, 'offlimits': false },
			"_236": { 'id': "236", 'name': "Pumpkin Soup", 'type': "Cooking", 'category': -7, 'price': 300, 'offlimits': false },
			"_237": { 'id': "237", 'name': "Super Meal", 'type': "Cooking", 'category': -7, 'price': 220, 'offlimits': false },
			"_238": { 'id': "238", 'name': "Cranberry Sauce", 'type': "Cooking", 'category': -7, 'price': 120, 'offlimits': false },
			"_239": { 'id': "239", 'name': "Stuffing", 'type': "Cooking", 'category': -7, 'price': 165, 'offlimits': false },
			"_240": { 'id': "240", 'name': "Farmer's Lunch", 'type': "Cooking", 'category': -7, 'price': 150, 'offlimits': false },
			"_241": { 'id': "241", 'name': "Survival Burger", 'type': "Cooking", 'category': -7, 'price': 180, 'offlimits': false },
			"_242": { 'id': "242", 'name': "Dish O' The Sea", 'type': "Cooking", 'category': -7, 'price': 220, 'offlimits': false },
			"_243": { 'id': "243", 'name': "Miner's Treat", 'type': "Cooking", 'category': -7, 'price': 200, 'offlimits': false },
			"_244": { 'id': "244", 'name': "Roots Platter", 'type': "Cooking", 'category': -7, 'price': 100, 'offlimits': false },
			"_245": { 'id': "245", 'name': "Sugar", 'type': "Basic", 'category': 0, 'price': 50, 'offlimits': false },
			"_246": { 'id': "246", 'name': "Wheat Flour", 'type': "Basic", 'category': 0, 'price': 50, 'offlimits': false },
			"_247": { 'id': "247", 'name': "Oil", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_248": { 'id': "248", 'name': "Garlic", 'type': "Basic", 'category': -75, 'price': 60, 'offlimits': false },
			"_250": { 'id': "250", 'name': "Kale", 'type': "Basic", 'category': -75, 'price': 110, 'offlimits': false },
			"_251": { 'id': "251", 'name': "Tea Sapling", 'type': "Basic", 'category': -74, 'price': 250, 'offlimits': false },
			"_252": { 'id': "252", 'name': "Rhubarb", 'type': "Basic", 'category': -79, 'price': 220, 'offlimits': false },
			"_253": { 'id': "253", 'name': "Triple Shot Espresso", 'type': "Cooking", 'category': -7, 'price': 450, 'offlimits': false },
			"_254": { 'id': "254", 'name': "Melon", 'type': "Basic", 'category': -79, 'price': 250, 'offlimits': false },
			"_256": { 'id': "256", 'name': "Tomato", 'type': "Basic", 'category': -75, 'price': 60, 'offlimits': false },
			"_257": { 'id': "257", 'name': "Morel", 'type': "Basic", 'category': -81, 'price': 150, 'offlimits': false },
			"_258": { 'id': "258", 'name': "Blueberry", 'type': "Basic", 'category': -79, 'price': 50, 'offlimits': false },
			"_259": { 'id': "259", 'name': "Fiddlehead Fern", 'type': "Basic", 'category': -75, 'price': 90, 'offlimits': false },
			"_260": { 'id': "260", 'name': "Hot Pepper", 'type': "Basic", 'category': -79, 'price': 40, 'offlimits': false },
			"_261": { 'id': "261", 'name': "Warp Totem: Desert", 'type': "Crafting", 'category': 0, 'price': 20, 'offlimits': true },
			"_262": { 'id': "262", 'name': "Wheat", 'type': "Basic", 'category': -75, 'price': 25, 'offlimits': false },
			"_264": { 'id': "264", 'name': "Radish", 'type': "Basic", 'category': -75, 'price': 90, 'offlimits': false },
			"_266": { 'id': "266", 'name': "Red Cabbage", 'type': "Basic", 'category': -75, 'price': 260, 'offlimits': false },
			"_268": { 'id': "268", 'name': "Starfruit", 'type': "Basic", 'category': -79, 'price': 750, 'offlimits': false },
			"_270": { 'id': "270", 'name': "Corn", 'type': "Basic", 'category': -75, 'price': 50, 'offlimits': false },
			"_271": { 'id': "271", 'name': "Unmilled Rice", 'type': "Basic", 'category': -75, 'price': 30, 'offlimits': false },
			"_272": { 'id': "272", 'name': "Eggplant", 'type': "Basic", 'category': -75, 'price': 60, 'offlimits': false },
			"_273": { 'id': "273", 'name': "Rice Shoot", 'type': "Seeds", 'category': -74, 'price': 20, 'offlimits': false },
			"_274": { 'id': "274", 'name': "Artichoke", 'type': "Basic", 'category': -75, 'price': 160, 'offlimits': false },
			"_275": { 'id': "275", 'name': "Artifact Trove", 'type': "Basic", 'category': 0, 'price': 0, 'offlimits': false },
			"_276": { 'id': "276", 'name': "Pumpkin", 'type': "Basic", 'category': -75, 'price': 320, 'offlimits': false },
			"_277": { 'id': "277", 'name': "Wilted Bouquet", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': true },
			"_278": { 'id': "278", 'name': "Bok Choy", 'type': "Basic", 'category': -75, 'price': 80, 'offlimits': false },
			"_279": { 'id': "279", 'name': "Magic Rock Candy", 'type': "Cooking", 'category': -7, 'price': 5000, 'offlimits': true },
			"_280": { 'id': "280", 'name': "Yam", 'type': "Basic", 'category': -75, 'price': 160, 'offlimits': false },
			"_281": { 'id': "281", 'name': "Chanterelle", 'type': "Basic", 'category': -81, 'price': 160, 'offlimits': false },
			"_282": { 'id': "282", 'name': "Cranberries", 'type': "Basic", 'category': -79, 'price': 75, 'offlimits': false },
			"_283": { 'id': "283", 'name': "Holly", 'type': "Basic", 'category': -81, 'price': 80, 'offlimits': false },
			"_284": { 'id': "284", 'name': "Beet", 'type': "Basic", 'category': -75, 'price': 100, 'offlimits': false },
			"_286": { 'id': "286", 'name': "Cherry Bomb", 'type': "Crafting", 'category': -8, 'price': 50, 'offlimits': false },
			"_287": { 'id': "287", 'name': "Bomb", 'type': "Crafting", 'category': -8, 'price': 50, 'offlimits': false },
			"_288": { 'id': "288", 'name': "Mega Bomb", 'type': "Crafting", 'category': -8, 'price': 50, 'offlimits': false },
			"_290": { 'id': "290", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_293": { 'id': "293", 'name': "Brick Floor", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_294": { 'id': "294", 'name': "Twig", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_295": { 'id': "295", 'name': "Twig", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_296": { 'id': "296", 'name': "Salmonberry", 'type': "Basic", 'category': -79, 'price': 5, 'offlimits': false },
			"_297": { 'id': "297", 'name': "Grass Starter", 'type': "Crafting", 'category': 0, 'price': 50, 'offlimits': false },
			"_298": { 'id': "298", 'name': "Hardwood Fence", 'type': "Crafting", 'category': -8, 'price': 10, 'offlimits': false },
			"_299": { 'id': "299", 'name': "Amaranth Seeds", 'type': "Seeds", 'category': -74, 'price': 35, 'offlimits': false },
			"_300": { 'id': "300", 'name': "Amaranth", 'type': "Basic", 'category': -75, 'price': 150, 'offlimits': false },
			"_301": { 'id': "301", 'name': "Grape Starter", 'type': "Seeds", 'category': -74, 'price': 30, 'offlimits': false },
			"_302": { 'id': "302", 'name': "Hops Starter", 'type': "Seeds", 'category': -74, 'price': 30, 'offlimits': false },
			"_303": { 'id': "303", 'name': "Pale Ale", 'type': "Basic", 'category': -26, 'price': 300, 'offlimits': false },
			"_304": { 'id': "304", 'name': "Hops", 'type': "Basic", 'category': -75, 'price': 25, 'offlimits': false },
			"_305": { 'id': "305", 'name': "Void Egg", 'type': "Basic", 'category': -5, 'price': 65, 'offlimits': true },
			"_306": { 'id': "306", 'name': "Mayonnaise", 'type': "Basic", 'category': -26, 'price': 190, 'offlimits': false },
			"_307": { 'id': "307", 'name': "Duck Mayonnaise", 'type': "Basic", 'category': -26, 'price': 375, 'offlimits': false },
			"_308": { 'id': "308", 'name': "Void Mayonnaise", 'type': "Basic", 'category': -26, 'price': 275, 'offlimits': true },
			"_309": { 'id': "309", 'name': "Acorn", 'type': "Crafting", 'category': -74, 'price': 20, 'offlimits': false },
			"_310": { 'id': "310", 'name': "Maple Seed", 'type': "Crafting", 'category': -74, 'price': 5, 'offlimits': false },
			"_311": { 'id': "311", 'name': "Pine Cone", 'type': "Crafting", 'category': -74, 'price': 5, 'offlimits': false },
			"_313": { 'id': "313", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_314": { 'id': "314", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_315": { 'id': "315", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_316": { 'id': "316", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_317": { 'id': "317", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_318": { 'id': "318", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_319": { 'id': "319", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_320": { 'id': "320", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_321": { 'id': "321", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_322": { 'id': "322", 'name': "Wood Fence", 'type': "Crafting", 'category': -8, 'price': 1, 'offlimits': false },
			"_323": { 'id': "323", 'name': "Stone Fence", 'type': "Crafting", 'category': -8, 'price': 2, 'offlimits': false },
			"_324": { 'id': "324", 'name': "Iron Fence", 'type': "Crafting", 'category': -8, 'price': 6, 'offlimits': false },
			"_325": { 'id': "325", 'name': "Gate", 'type': "Crafting", 'category': -8, 'price': 4, 'offlimits': false },
			"_326": { 'id': "326", 'name': "Dwarvish Translation Guide", 'type': "Crafting", 'category': -8, 'price': 50, 'offlimits': true },
			"_328": { 'id': "328", 'name': "Wood Floor", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_329": { 'id': "329", 'name': "Stone Floor", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_330": { 'id': "330", 'name': "Clay", 'type': "Basic", 'category': -16, 'price': 20, 'offlimits': false },
			"_331": { 'id': "331", 'name': "Weathered Floor", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_333": { 'id': "333", 'name': "Crystal Floor", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_334": { 'id': "334", 'name': "Copper Bar", 'type': "Basic", 'category': -15, 'price': 60, 'offlimits': false },
			"_335": { 'id': "335", 'name': "Iron Bar", 'type': "Basic", 'category': -15, 'price': 120, 'offlimits': false },
			"_336": { 'id': "336", 'name': "Gold Bar", 'type': "Basic", 'category': -15, 'price': 250, 'offlimits': false },
			"_337": { 'id': "337", 'name': "Iridium Bar", 'type': "Basic", 'category': -15, 'price': 1000, 'offlimits': false },
			"_338": { 'id': "338", 'name': "Refined Quartz", 'type': "Basic", 'category': -15, 'price': 50, 'offlimits': false },
			"_340": { 'id': "340", 'name': "Honey", 'type': "Basic", 'category': -26, 'price': 100, 'offlimits': false },
			"_341": { 'id': "341", 'name': "Tea Set", 'type': "Basic", 'category': -24, 'price': 200, 'offlimits': true },
			"_342": { 'id': "342", 'name': "Pickles", 'type': "Basic", 'category': -26, 'price': 100, 'offlimits': false },
			"_343": { 'id': "343", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_344": { 'id': "344", 'name': "Jelly", 'type': "Basic", 'category': -26, 'price': 160, 'offlimits': false },
			"_346": { 'id': "346", 'name': "Beer", 'type': "Basic", 'category': -26, 'price': 200, 'offlimits': false },
			"_347": { 'id': "347", 'name': "Rare Seed", 'type': "Seeds", 'category': -74, 'price': 200, 'offlimits': false },
			"_348": { 'id': "348", 'name': "Wine", 'type': "Basic", 'category': -26, 'price': 400, 'offlimits': false },
			"_349": { 'id': "349", 'name': "Energy Tonic", 'type': "Crafting", 'category': 0, 'price': 500, 'offlimits': false },
			"_350": { 'id': "350", 'name': "Juice", 'type': "Basic", 'category': -26, 'price': 150, 'offlimits': false },
			"_351": { 'id': "351", 'name': "Muscle Remedy", 'type': "Crafting", 'category': 0, 'price': 500, 'offlimits': false },
			"_368": { 'id': "368", 'name': "Basic Fertilizer", 'type': "Basic", 'category': -19, 'price': 2, 'offlimits': false },
			"_369": { 'id': "369", 'name': "Quality Fertilizer", 'type': "Basic", 'category': -19, 'price': 10, 'offlimits': false },
			"_370": { 'id': "370", 'name': "Basic Retaining Soil", 'type': "Basic", 'category': -19, 'price': 4, 'offlimits': false },
			"_371": { 'id': "371", 'name': "Quality Retaining Soil", 'type': "Basic", 'category': -19, 'price': 5, 'offlimits': false },
			"_372": { 'id': "372", 'name': "Clam", 'type': "Fish", 'category': -4, 'price': 50, 'offlimits': false },
			"_373": { 'id': "373", 'name': "Golden Pumpkin", 'type': "Basic", 'category': 0, 'price': 2500, 'offlimits': false },
			"_378": { 'id': "378", 'name': "Copper Ore", 'type': "Basic", 'category': -15, 'price': 5, 'offlimits': false },
			"_380": { 'id': "380", 'name': "Iron Ore", 'type': "Basic", 'category': -15, 'price': 10, 'offlimits': false },
			"_382": { 'id': "382", 'name': "Coal", 'type': "Basic", 'category': -15, 'price': 15, 'offlimits': false },
			"_384": { 'id': "384", 'name': "Gold Ore", 'type': "Basic", 'category': -15, 'price': 25, 'offlimits': false },
			"_386": { 'id': "386", 'name': "Iridium Ore", 'type': "Basic", 'category': -15, 'price': 100, 'offlimits': false },
			"_388": { 'id': "388", 'name': "Wood", 'type': "Basic", 'category': -16, 'price': 2, 'offlimits': false },
			"_390": { 'id': "390", 'name': "Stone", 'type': "Basic", 'category': -16, 'price': 2, 'offlimits': false },
			"_392": { 'id': "392", 'name': "Nautilus Shell", 'type': "Basic", 'category': -23, 'price': 120, 'offlimits': false },
			"_393": { 'id': "393", 'name': "Coral", 'type': "Basic", 'category': -23, 'price': 80, 'offlimits': false },
			"_394": { 'id': "394", 'name': "Rainbow Shell", 'type': "Basic", 'category': -23, 'price': 300, 'offlimits': false },
			"_395": { 'id': "395", 'name': "Coffee", 'type': "Crafting", 'category': 0, 'price': 150, 'offlimits': false },
			"_396": { 'id': "396", 'name': "Spice Berry", 'type': "Basic", 'category': -79, 'price': 80, 'offlimits': false },
			"_397": { 'id': "397", 'name': "Sea Urchin", 'type': "Basic", 'category': -23, 'price': 160, 'offlimits': false },
			"_398": { 'id': "398", 'name': "Grape", 'type': "Basic", 'category': -79, 'price': 80, 'offlimits': false },
			"_399": { 'id': "399", 'name': "Spring Onion", 'type': "Basic", 'category': -81, 'price': 8, 'offlimits': false },
			"_400": { 'id': "400", 'name': "Strawberry", 'type': "Basic", 'category': -79, 'price': 120, 'offlimits': false },
			"_401": { 'id': "401", 'name': "Straw Floor", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_402": { 'id': "402", 'name': "Sweet Pea", 'type': "Basic", 'category': -80, 'price': 50, 'offlimits': false },
			"_403": { 'id': "403", 'name': "Field Snack", 'type': "Crafting", 'category': 0, 'price': 20, 'offlimits': false },
			"_404": { 'id': "404", 'name': "Common Mushroom", 'type': "Basic", 'category': -81, 'price': 40, 'offlimits': false },
			"_405": { 'id': "405", 'name': "Wood Path", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_406": { 'id': "406", 'name': "Wild Plum", 'type': "Basic", 'category': -79, 'price': 80, 'offlimits': false },
			"_407": { 'id': "407", 'name': "Gravel Path", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_408": { 'id': "408", 'name': "Hazelnut", 'type': "Basic", 'category': -81, 'price': 90, 'offlimits': false },
			"_409": { 'id': "409", 'name': "Crystal Path", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_410": { 'id': "410", 'name': "Blackberry", 'type': "Basic", 'category': -79, 'price': 20, 'offlimits': false },
			"_411": { 'id': "411", 'name': "Cobblestone Path", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_412": { 'id': "412", 'name': "Winter Root", 'type': "Basic", 'category': -81, 'price': 70, 'offlimits': false },
			"_413": { 'id': "413", 'name': "Blue Slime Egg", 'type': "Basic", 'category': 0, 'price': 1750, 'offlimits': true },
			"_414": { 'id': "414", 'name': "Crystal Fruit", 'type': "Basic", 'category': -79, 'price': 150, 'offlimits': false },
			"_415": { 'id': "415", 'name': "Stepping Stone Path", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_416": { 'id': "416", 'name': "Snow Yam", 'type': "Basic", 'category': -81, 'price': 100, 'offlimits': false },
			"_417": { 'id': "417", 'name': "Sweet Gem Berry", 'type': "Basic", 'category': -17, 'price': 3000, 'offlimits': true },
			"_418": { 'id': "418", 'name': "Crocus", 'type': "Basic", 'category': -80, 'price': 60, 'offlimits': false },
			"_419": { 'id': "419", 'name': "Vinegar", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_420": { 'id': "420", 'name': "Red Mushroom", 'type': "Basic", 'category': -81, 'price': 75, 'offlimits': false },
			"_421": { 'id': "421", 'name': "Sunflower", 'type': "Basic", 'category': -80, 'price': 80, 'offlimits': false },
			"_422": { 'id': "422", 'name': "Purple Mushroom", 'type': "Basic", 'category': -81, 'price': 250, 'offlimits': false },
			"_423": { 'id': "423", 'name': "Rice", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_424": { 'id': "424", 'name': "Cheese", 'type': "Basic", 'category': -26, 'price': 230, 'offlimits': false },
			"_426": { 'id': "426", 'name': "Goat Cheese", 'type': "Basic", 'category': -26, 'price': 400, 'offlimits': false },
			"_428": { 'id': "428", 'name': "Cloth", 'type': "Basic", 'category': -26, 'price': 470, 'offlimits': false },
			"_430": { 'id': "430", 'name': "Truffle", 'type': "Basic", 'category': -17, 'price': 625, 'offlimits': false },
			"_432": { 'id': "432", 'name': "Truffle Oil", 'type': "Basic", 'category': -26, 'price': 1065, 'offlimits': false },
			"_433": { 'id': "433", 'name': "Coffee Bean", 'type': "Seeds", 'category': -74, 'price': 15, 'offlimits': false },
			"_434": { 'id': "434", 'name': "Stardrop", 'type': "Crafting", 'category': 0, 'price': 7777, 'offlimits': false },
			"_436": { 'id': "436", 'name': "Goat Milk", 'type': "Basic", 'category': -6, 'price': 225, 'offlimits': false },
			"_437": { 'id': "437", 'name': "Red Slime Egg", 'type': "Basic", 'category': 0, 'price': 2500, 'offlimits': true },
			"_438": { 'id': "438", 'name': "L. Goat Milk", 'type': "Basic", 'category': -6, 'price': 345, 'offlimits': false },
			"_439": { 'id': "439", 'name': "Purple Slime Egg", 'type': "Basic", 'category': 0, 'price': 5000, 'offlimits': true },
			"_440": { 'id': "440", 'name': "Wool", 'type': "Basic", 'category': -18, 'price': 340, 'offlimits': false },
			"_441": { 'id': "441", 'name': "Explosive Ammo", 'type': "Basic", 'category': 0, 'price': 20, 'offlimits': false },
			"_442": { 'id': "442", 'name': "Duck Egg", 'type': "Basic", 'category': -5, 'price': 95, 'offlimits': false },
			"_444": { 'id': "444", 'name': "Duck Feather", 'type': "Basic", 'category': -18, 'price': 250, 'offlimits': false },
			"_446": { 'id': "446", 'name': "Rabbit's Foot", 'type': "Basic", 'category': -18, 'price': 565, 'offlimits': false },
			"_447": { 'id': "447", 'name': "Aged Roe", 'type': "Basic", 'category': -26, 'price': 100, 'offlimits': true },
			"_449": { 'id': "449", 'name': "Stone Base", 'type': "asdf", 'category': 0, 'price': 0, 'offlimits': false },
			"_450": { 'id': "450", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_452": { 'id': "452", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_454": { 'id': "454", 'name': "Ancient Fruit", 'type': "Basic", 'category': -79, 'price': 550, 'offlimits': true },
			"_456": { 'id': "456", 'name': "Algae Soup", 'type': "Cooking", 'category': -7, 'price': 100, 'offlimits': false },
			"_457": { 'id': "457", 'name': "Pale Broth", 'type': "Cooking", 'category': -7, 'price': 150, 'offlimits': false },
			"_458": { 'id': "458", 'name': "Bouquet", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_459": { 'id': "459", 'name': "Mead", 'type': "Basic", 'category': -26, 'price': 300, 'offlimits': false },
			"_460": { 'id': "460", 'name': "Mermaid's Pendant", 'type': "Basic", 'category': 0, 'price': 2500, 'offlimits': true },
			"_461": { 'id': "461", 'name': "Decorative Pot", 'type': "Crafting", 'category': 0, 'price': 200, 'offlimits': false },
			"_463": { 'id': "463", 'name': "Drum Block", 'type': "Crafting", 'category': 0, 'price': 100, 'offlimits': false },
			"_464": { 'id': "464", 'name': "Flute Block", 'type': "Crafting", 'category': 0, 'price': 100, 'offlimits': false },
			"_465": { 'id': "465", 'name': "Speed-Gro", 'type': "Basic", 'category': -19, 'price': 20, 'offlimits': false },
			"_466": { 'id': "466", 'name': "Deluxe Speed-Gro", 'type': "Basic", 'category': -19, 'price': 40, 'offlimits': false },
			"_472": { 'id': "472", 'name': "Parsnip Seeds", 'type': "Seeds", 'category': -74, 'price': 10, 'offlimits': false },
			"_473": { 'id': "473", 'name': "Bean Starter", 'type': "Seeds", 'category': -74, 'price': 30, 'offlimits': false },
			"_474": { 'id': "474", 'name': "Cauliflower Seeds", 'type': "Seeds", 'category': -74, 'price': 40, 'offlimits': false },
			"_475": { 'id': "475", 'name': "Potato Seeds", 'type': "Seeds", 'category': -74, 'price': 25, 'offlimits': false },
			"_476": { 'id': "476", 'name': "Garlic Seeds", 'type': "Seeds", 'category': -74, 'price': 20, 'offlimits': false },
			"_477": { 'id': "477", 'name': "Kale Seeds", 'type': "Seeds", 'category': -74, 'price': 35, 'offlimits': false },
			"_478": { 'id': "478", 'name': "Rhubarb Seeds", 'type': "Seeds", 'category': -74, 'price': 50, 'offlimits': false },
			"_479": { 'id': "479", 'name': "Melon Seeds", 'type': "Seeds", 'category': -74, 'price': 40, 'offlimits': false },
			"_480": { 'id': "480", 'name': "Tomato Seeds", 'type': "Seeds", 'category': -74, 'price': 25, 'offlimits': false },
			"_481": { 'id': "481", 'name': "Blueberry Seeds", 'type': "Seeds", 'category': -74, 'price': 40, 'offlimits': false },
			"_482": { 'id': "482", 'name': "Pepper Seeds", 'type': "Seeds", 'category': -74, 'price': 20, 'offlimits': false },
			"_483": { 'id': "483", 'name': "Wheat Seeds", 'type': "Seeds", 'category': -74, 'price': 5, 'offlimits': false },
			"_484": { 'id': "484", 'name': "Radish Seeds", 'type': "Seeds", 'category': -74, 'price': 20, 'offlimits': false },
			"_485": { 'id': "485", 'name': "Red Cabbage Seeds", 'type': "Seeds", 'category': -74, 'price': 50, 'offlimits': false },
			"_486": { 'id': "486", 'name': "Starfruit Seeds", 'type': "Seeds", 'category': -74, 'price': 200, 'offlimits': false },
			"_487": { 'id': "487", 'name': "Corn Seeds", 'type': "Seeds", 'category': -74, 'price': 75, 'offlimits': false },
			"_488": { 'id': "488", 'name': "Eggplant Seeds", 'type': "Seeds", 'category': -74, 'price': 10, 'offlimits': false },
			"_489": { 'id': "489", 'name': "Artichoke Seeds", 'type': "Seeds", 'category': -74, 'price': 15, 'offlimits': false },
			"_490": { 'id': "490", 'name': "Pumpkin Seeds", 'type': "Seeds", 'category': -74, 'price': 50, 'offlimits': false },
			"_491": { 'id': "491", 'name': "Bok Choy Seeds", 'type': "Seeds", 'category': -74, 'price': 25, 'offlimits': false },
			"_492": { 'id': "492", 'name': "Yam Seeds", 'type': "Seeds", 'category': -74, 'price': 30, 'offlimits': false },
			"_493": { 'id': "493", 'name': "Cranberry Seeds", 'type': "Seeds", 'category': -74, 'price': 120, 'offlimits': false },
			"_494": { 'id': "494", 'name': "Beet Seeds", 'type': "Seeds", 'category': -74, 'price': 10, 'offlimits': false },
			"_495": { 'id': "495", 'name': "Spring Seeds", 'type': "Seeds", 'category': -74, 'price': 35, 'offlimits': false },
			"_496": { 'id': "496", 'name': "Summer Seeds", 'type': "Seeds", 'category': -74, 'price': 55, 'offlimits': false },
			"_497": { 'id': "497", 'name': "Fall Seeds", 'type': "Seeds", 'category': -74, 'price': 45, 'offlimits': false },
			"_498": { 'id': "498", 'name': "Winter Seeds", 'type': "Seeds", 'category': -74, 'price': 30, 'offlimits': false },
			"_499": { 'id': "499", 'name': "Ancient Seeds", 'type': "Seeds", 'category': -74, 'price': 30, 'offlimits': true },
			"_427": { 'id': "427", 'name': "Tulip Bulb", 'type': "Seeds", 'category': -74, 'price': 10, 'offlimits': false },
			"_429": { 'id': "429", 'name': "Jazz Seeds", 'type': "Seeds", 'category': -74, 'price': 15, 'offlimits': false },
			"_453": { 'id': "453", 'name': "Poppy Seeds", 'type': "Seeds", 'category': -74, 'price': 50, 'offlimits': false },
			"_455": { 'id': "455", 'name': "Spangle Seeds", 'type': "Seeds", 'category': -74, 'price': 25, 'offlimits': false },
			"_431": { 'id': "431", 'name': "Sunflower Seeds", 'type': "Seeds", 'category': -74, 'price': 20, 'offlimits': false },
			"_425": { 'id': "425", 'name': "Fairy Seeds", 'type': "Seeds", 'category': -74, 'price': 100, 'offlimits': false },
			"_516": { 'id': "516", 'name': "Small Glow Ring", 'type': "Ring", 'category': 0, 'price': 100, 'offlimits': false },
			"_517": { 'id': "517", 'name': "Glow Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_518": { 'id': "518", 'name': "Small Magnet Ring", 'type': "Ring", 'category': 0, 'price': 100, 'offlimits': false },
			"_519": { 'id': "519", 'name': "Magnet Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_520": { 'id': "520", 'name': "Slime Charmer Ring", 'type': "Ring", 'category': 0, 'price': 700, 'offlimits': false },
			"_521": { 'id': "521", 'name': "Warrior Ring", 'type': "Ring", 'category': 0, 'price': 1500, 'offlimits': false },
			"_522": { 'id': "522", 'name': "Vampire Ring", 'type': "Ring", 'category': 0, 'price': 1500, 'offlimits': false },
			"_523": { 'id': "523", 'name': "Savage Ring", 'type': "Ring", 'category': 0, 'price': 1500, 'offlimits': false },
			"_524": { 'id': "524", 'name': "Ring of Yoba", 'type': "Ring", 'category': 0, 'price': 1500, 'offlimits': false },
			"_525": { 'id': "525", 'name': "Sturdy Ring", 'type': "Ring", 'category': 0, 'price': 1500, 'offlimits': false },
			"_526": { 'id': "526", 'name': "Burglar's Ring", 'type': "Ring", 'category': 0, 'price': 1500, 'offlimits': false },
			"_527": { 'id': "527", 'name': "Iridium Band", 'type': "Ring", 'category': 0, 'price': 2000, 'offlimits': false },
			"_528": { 'id': "528", 'name': "Jukebox Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_529": { 'id': "529", 'name': "Amethyst Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_530": { 'id': "530", 'name': "Topaz Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_531": { 'id': "531", 'name': "Aquamarine Ring", 'type': "Ring", 'category': 0, 'price': 400, 'offlimits': false },
			"_532": { 'id': "532", 'name': "Jade Ring", 'type': "Ring", 'category': 0, 'price': 400, 'offlimits': false },
			"_533": { 'id': "533", 'name': "Emerald Ring", 'type': "Ring", 'category': 0, 'price': 600, 'offlimits': false },
			"_534": { 'id': "534", 'name': "Ruby Ring", 'type': "Ring", 'category': 0, 'price': 600, 'offlimits': false },
			"_535": { 'id': "535", 'name': "Geode", 'type': "Basic", 'category': 0, 'price': 50, 'offlimits': false },
			"_536": { 'id': "536", 'name': "Frozen Geode", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_537": { 'id': "537", 'name': "Magma Geode", 'type': "Basic", 'category': 0, 'price': 150, 'offlimits': false },
			"_538": { 'id': "538", 'name': "Alamite", 'type': "Minerals", 'category': -12, 'price': 150, 'offlimits': false },
			"_539": { 'id': "539", 'name': "Bixite", 'type': "Minerals", 'category': -12, 'price': 300, 'offlimits': false },
			"_540": { 'id': "540", 'name': "Baryte", 'type': "Minerals", 'category': -12, 'price': 50, 'offlimits': false },
			"_541": { 'id': "541", 'name': "Aerinite", 'type': "Minerals", 'category': -12, 'price': 125, 'offlimits': false },
			"_542": { 'id': "542", 'name': "Calcite", 'type': "Minerals", 'category': -12, 'price': 75, 'offlimits': false },
			"_543": { 'id': "543", 'name': "Dolomite", 'type': "Minerals", 'category': -12, 'price': 300, 'offlimits': false },
			"_544": { 'id': "544", 'name': "Esperite", 'type': "Minerals", 'category': -12, 'price': 100, 'offlimits': false },
			"_545": { 'id': "545", 'name': "Fluorapatite", 'type': "Minerals", 'category': -12, 'price': 200, 'offlimits': false },
			"_546": { 'id': "546", 'name': "Geminite", 'type': "Minerals", 'category': -12, 'price': 150, 'offlimits': false },
			"_547": { 'id': "547", 'name': "Helvite", 'type': "Minerals", 'category': -12, 'price': 450, 'offlimits': false },
			"_548": { 'id': "548", 'name': "Jamborite", 'type': "Minerals", 'category': -12, 'price': 150, 'offlimits': false },
			"_549": { 'id': "549", 'name': "Jagoite", 'type': "Minerals", 'category': -12, 'price': 115, 'offlimits': false },
			"_550": { 'id': "550", 'name': "Kyanite", 'type': "Minerals", 'category': -12, 'price': 250, 'offlimits': false },
			"_551": { 'id': "551", 'name': "Lunarite", 'type': "Minerals", 'category': -12, 'price': 200, 'offlimits': false },
			"_552": { 'id': "552", 'name': "Malachite", 'type': "Minerals", 'category': -12, 'price': 100, 'offlimits': false },
			"_553": { 'id': "553", 'name': "Neptunite", 'type': "Minerals", 'category': -12, 'price': 400, 'offlimits': false },
			"_554": { 'id': "554", 'name': "Lemon Stone", 'type': "Minerals", 'category': -12, 'price': 200, 'offlimits': false },
			"_555": { 'id': "555", 'name': "Nekoite", 'type': "Minerals", 'category': -12, 'price': 80, 'offlimits': false },
			"_556": { 'id': "556", 'name': "Orpiment", 'type': "Minerals", 'category': -12, 'price': 80, 'offlimits': false },
			"_557": { 'id': "557", 'name': "Petrified Slime", 'type': "Minerals", 'category': -12, 'price': 120, 'offlimits': false },
			"_558": { 'id': "558", 'name': "Thunder Egg", 'type': "Minerals", 'category': -12, 'price': 100, 'offlimits': false },
			"_559": { 'id': "559", 'name': "Pyrite", 'type': "Minerals", 'category': -12, 'price': 120, 'offlimits': false },
			"_560": { 'id': "560", 'name': "Ocean Stone", 'type': "Minerals", 'category': -12, 'price': 220, 'offlimits': false },
			"_561": { 'id': "561", 'name': "Ghost Crystal", 'type': "Minerals", 'category': -12, 'price': 200, 'offlimits': false },
			"_562": { 'id': "562", 'name': "Tigerseye", 'type': "Minerals", 'category': -12, 'price': 275, 'offlimits': false },
			"_563": { 'id': "563", 'name': "Jasper", 'type': "Minerals", 'category': -12, 'price': 150, 'offlimits': false },
			"_564": { 'id': "564", 'name': "Opal", 'type': "Minerals", 'category': -12, 'price': 150, 'offlimits': false },
			"_565": { 'id': "565", 'name': "Fire Opal", 'type': "Minerals", 'category': -12, 'price': 350, 'offlimits': false },
			"_566": { 'id': "566", 'name': "Celestine", 'type': "Minerals", 'category': -12, 'price': 125, 'offlimits': false },
			"_567": { 'id': "567", 'name': "Marble", 'type': "Minerals", 'category': -12, 'price': 110, 'offlimits': false },
			"_568": { 'id': "568", 'name': "Sandstone", 'type': "Minerals", 'category': -12, 'price': 60, 'offlimits': false },
			"_569": { 'id': "569", 'name': "Granite", 'type': "Minerals", 'category': -12, 'price': 75, 'offlimits': false },
			"_570": { 'id': "570", 'name': "Basalt", 'type': "Minerals", 'category': -12, 'price': 175, 'offlimits': false },
			"_571": { 'id': "571", 'name': "Limestone", 'type': "Minerals", 'category': -12, 'price': 15, 'offlimits': false },
			"_572": { 'id': "572", 'name': "Soapstone", 'type': "Minerals", 'category': -12, 'price': 120, 'offlimits': false },
			"_573": { 'id': "573", 'name': "Hematite", 'type': "Minerals", 'category': -12, 'price': 150, 'offlimits': false },
			"_574": { 'id': "574", 'name': "Mudstone", 'type': "Minerals", 'category': -12, 'price': 25, 'offlimits': false },
			"_575": { 'id': "575", 'name': "Obsidian", 'type': "Minerals", 'category': -12, 'price': 200, 'offlimits': false },
			"_576": { 'id': "576", 'name': "Slate", 'type': "Minerals", 'category': -12, 'price': 85, 'offlimits': false },
			"_577": { 'id': "577", 'name': "Fairy Stone", 'type': "Minerals", 'category': -12, 'price': 250, 'offlimits': false },
			"_578": { 'id': "578", 'name': "Star Shards", 'type': "Minerals", 'category': -12, 'price': 500, 'offlimits': false },
			"_579": { 'id': "579", 'name': "Prehistoric Scapula", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_580": { 'id': "580", 'name': "Prehistoric Tibia", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_581": { 'id': "581", 'name': "Prehistoric Skull", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_582": { 'id': "582", 'name': "Skeletal Hand", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_583": { 'id': "583", 'name': "Prehistoric Rib", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_584": { 'id': "584", 'name': "Prehistoric Vertebra", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_585": { 'id': "585", 'name': "Skeletal Tail", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_586": { 'id': "586", 'name': "Nautilus Fossil", 'type': "Arch", 'category': 0, 'price': 80, 'offlimits': false },
			"_587": { 'id': "587", 'name': "Amphibian Fossil", 'type': "Arch", 'category': 0, 'price': 150, 'offlimits': false },
			"_588": { 'id': "588", 'name': "Palm Fossil", 'type': "Arch", 'category': 0, 'price': 100, 'offlimits': false },
			"_589": { 'id': "589", 'name': "Trilobite", 'type': "Arch", 'category': 0, 'price': 50, 'offlimits': false },
			"_590": { 'id': "590", 'name': "Artifact Spot", 'type': "asdf", 'category': 0, 'price': 0, 'offlimits': false },
			"_591": { 'id': "591", 'name': "Tulip", 'type': "Basic", 'category': -80, 'price': 30, 'offlimits': false },
			"_593": { 'id': "593", 'name': "Summer Spangle", 'type': "Basic", 'category': -80, 'price': 90, 'offlimits': false },
			"_595": { 'id': "595", 'name': "Fairy Rose", 'type': "Basic", 'category': -80, 'price': 290, 'offlimits': false },
			"_597": { 'id': "597", 'name': "Blue Jazz", 'type': "Basic", 'category': -80, 'price': 50, 'offlimits': false },
			"_599": { 'id': "599", 'name': "Sprinkler", 'type': "Crafting", 'category': -8, 'price': 100, 'offlimits': false },
			"_376": { 'id': "376", 'name': "Poppy", 'type': "Basic", 'category': -80, 'price': 140, 'offlimits': false },
			"_604": { 'id': "604", 'name': "Plum Pudding", 'type': "Cooking", 'category': -7, 'price': 260, 'offlimits': false },
			"_605": { 'id': "605", 'name': "Artichoke Dip", 'type': "Cooking", 'category': -7, 'price': 210, 'offlimits': false },
			"_606": { 'id': "606", 'name': "Stir Fry", 'type': "Cooking", 'category': -7, 'price': 335, 'offlimits': false },
			"_607": { 'id': "607", 'name': "Roasted Hazelnuts", 'type': "Cooking", 'category': -7, 'price': 270, 'offlimits': false },
			"_608": { 'id': "608", 'name': "Pumpkin Pie", 'type': "Cooking", 'category': -7, 'price': 385, 'offlimits': false },
			"_609": { 'id': "609", 'name': "Radish Salad", 'type': "Cooking", 'category': -7, 'price': 300, 'offlimits': false },
			"_610": { 'id': "610", 'name': "Fruit Salad", 'type': "Cooking", 'category': -7, 'price': 450, 'offlimits': false },
			"_611": { 'id': "611", 'name': "Blackberry Cobbler", 'type': "Cooking", 'category': -7, 'price': 260, 'offlimits': false },
			"_612": { 'id': "612", 'name': "Cranberry Candy", 'type': "Cooking", 'category': -7, 'price': 175, 'offlimits': false },
			"_613": { 'id': "613", 'name': "Apple", 'type': "Basic", 'category': -79, 'price': 100, 'offlimits': false },
			"_614": { 'id': "614", 'name': "Green Tea", 'type': "Basic", 'category': -26, 'price': 100, 'offlimits': false },
			"_618": { 'id': "618", 'name': "Bruschetta", 'type': "Cooking", 'category': -7, 'price': 210, 'offlimits': false },
			"_621": { 'id': "621", 'name': "Quality Sprinkler", 'type': "Crafting", 'category': -8, 'price': 450, 'offlimits': false },
			"_645": { 'id': "645", 'name': "Iridium Sprinkler", 'type': "Crafting", 'category': -8, 'price': 1000, 'offlimits': true },
			"_648": { 'id': "648", 'name': "Coleslaw", 'type': "Cooking", 'category': -7, 'price': 345, 'offlimits': false },
			"_649": { 'id': "649", 'name': "Fiddlehead Risotto", 'type': "Cooking", 'category': -7, 'price': 350, 'offlimits': false },
			"_651": { 'id': "651", 'name': "Poppyseed Muffin", 'type': "Cooking", 'category': -7, 'price': 250, 'offlimits': false },
			"_628": { 'id': "628", 'name': "Cherry Sapling", 'type': "Basic", 'category': -74, 'price': 850, 'offlimits': false },
			"_629": { 'id': "629", 'name': "Apricot Sapling", 'type': "Basic", 'category': -74, 'price': 500, 'offlimits': false },
			"_630": { 'id': "630", 'name': "Orange Sapling", 'type': "Basic", 'category': -74, 'price': 1000, 'offlimits': false },
			"_631": { 'id': "631", 'name': "Peach Sapling", 'type': "Basic", 'category': -74, 'price': 1500, 'offlimits': false },
			"_632": { 'id': "632", 'name': "Pomegranate Sapling", 'type': "Basic", 'category': -74, 'price': 1500, 'offlimits': false },
			"_633": { 'id': "633", 'name': "Apple Sapling", 'type': "Basic", 'category': -74, 'price': 1000, 'offlimits': false },
			"_634": { 'id': "634", 'name': "Apricot", 'type': "Basic", 'category': -79, 'price': 50, 'offlimits': false },
			"_635": { 'id': "635", 'name': "Orange", 'type': "Basic", 'category': -79, 'price': 100, 'offlimits': false },
			"_636": { 'id': "636", 'name': "Peach", 'type': "Basic", 'category': -79, 'price': 140, 'offlimits': false },
			"_637": { 'id': "637", 'name': "Pomegranate", 'type': "Basic", 'category': -79, 'price': 140, 'offlimits': false },
			"_638": { 'id': "638", 'name': "Cherry", 'type': "Basic", 'category': -79, 'price': 80, 'offlimits': false },
			"_668": { 'id': "668", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_670": { 'id': "670", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_674": { 'id': "674", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_675": { 'id': "675", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_676": { 'id': "676", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_677": { 'id': "677", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_678": { 'id': "678", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_679": { 'id': "679", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_680": { 'id': "680", 'name': "Green Slime Egg", 'type': "Basic", 'category': 0, 'price': 1000, 'offlimits': true },
			"_681": { 'id': "681", 'name': "Rain Totem", 'type': "Crafting", 'category': 0, 'price': 20, 'offlimits': true },
			"_682": { 'id': "682", 'name': "Mutant Carp", 'type': "Fish", 'category': -4, 'price': 1000, 'offlimits': true },
			"_684": { 'id': "684", 'name': "Bug Meat", 'type': "Basic", 'category': -28, 'price': 8, 'offlimits': false },
			"_685": { 'id': "685", 'name': "Bait", 'type': "Basic", 'category': -21, 'price': 1, 'offlimits': false },
			"_686": { 'id': "686", 'name': "Spinner", 'type': "Basic", 'category': -22, 'price': 250, 'offlimits': false },
			"_687": { 'id': "687", 'name': "Dressed Spinner", 'type': "Basic", 'category': -22, 'price': 500, 'offlimits': false },
			"_688": { 'id': "688", 'name': "Warp Totem: Farm", 'type': "Crafting", 'category': 0, 'price': 20, 'offlimits': true },
			"_689": { 'id': "689", 'name': "Warp Totem: Mountains", 'type': "Crafting", 'category': 0, 'price': 20, 'offlimits': true },
			"_690": { 'id': "690", 'name': "Warp Totem: Beach", 'type': "Crafting", 'category': 0, 'price': 20, 'offlimits': true },
			"_691": { 'id': "691", 'name': "Barbed Hook", 'type': "Basic", 'category': -22, 'price': 500, 'offlimits': false },
			"_692": { 'id': "692", 'name': "Lead Bobber", 'type': "Basic", 'category': -22, 'price': 150, 'offlimits': false },
			"_693": { 'id': "693", 'name': "Treasure Hunter", 'type': "Basic", 'category': -22, 'price': 250, 'offlimits': false },
			"_694": { 'id': "694", 'name': "Trap Bobber", 'type': "Basic", 'category': -22, 'price': 200, 'offlimits': false },
			"_695": { 'id': "695", 'name': "Cork Bobber", 'type': "Basic", 'category': -22, 'price': 250, 'offlimits': false },
			"_698": { 'id': "698", 'name': "Sturgeon", 'type': "Fish", 'category': -4, 'price': 200, 'offlimits': false },
			"_699": { 'id': "699", 'name': "Tiger Trout", 'type': "Fish", 'category': -4, 'price': 150, 'offlimits': false },
			"_700": { 'id': "700", 'name': "Bullhead", 'type': "Fish", 'category': -4, 'price': 75, 'offlimits': false },
			"_701": { 'id': "701", 'name': "Tilapia", 'type': "Fish", 'category': -4, 'price': 75, 'offlimits': false },
			"_702": { 'id': "702", 'name': "Chub", 'type': "Fish", 'category': -4, 'price': 50, 'offlimits': false },
			"_703": { 'id': "703", 'name': "Magnet", 'type': "Basic", 'category': -21, 'price': 15, 'offlimits': false },
			"_704": { 'id': "704", 'name': "Dorado", 'type': "Fish", 'category': -4, 'price': 100, 'offlimits': false },
			"_705": { 'id': "705", 'name': "Albacore", 'type': "Fish", 'category': -4, 'price': 75, 'offlimits': false },
			"_706": { 'id': "706", 'name': "Shad", 'type': "Fish", 'category': -4, 'price': 60, 'offlimits': false },
			"_707": { 'id': "707", 'name': "Lingcod", 'type': "Fish", 'category': -4, 'price': 120, 'offlimits': false },
			"_708": { 'id': "708", 'name': "Halibut", 'type': "Fish", 'category': -4, 'price': 80, 'offlimits': false },
			"_709": { 'id': "709", 'name': "Hardwood", 'type': "Basic", 'category': -16, 'price': 15, 'offlimits': false },
			"_710": { 'id': "710", 'name': "Crab Pot", 'type': "Crafting", 'category': 0, 'price': 50, 'offlimits': false },
			"_715": { 'id': "715", 'name': "Lobster", 'type': "Fish", 'category': -4, 'price': 120, 'offlimits': false },
			"_716": { 'id': "716", 'name': "Crayfish", 'type': "Fish", 'category': -4, 'price': 75, 'offlimits': false },
			"_717": { 'id': "717", 'name': "Crab", 'type': "Fish", 'category': -4, 'price': 100, 'offlimits': false },
			"_718": { 'id': "718", 'name': "Cockle", 'type': "Fish", 'category': -4, 'price': 50, 'offlimits': false },
			"_719": { 'id': "719", 'name': "Mussel", 'type': "Fish", 'category': -4, 'price': 30, 'offlimits': false },
			"_720": { 'id': "720", 'name': "Shrimp", 'type': "Fish", 'category': -4, 'price': 60, 'offlimits': false },
			"_721": { 'id': "721", 'name': "Snail", 'type': "Fish", 'category': -4, 'price': 65, 'offlimits': false },
			"_722": { 'id': "722", 'name': "Periwinkle", 'type': "Fish", 'category': -4, 'price': 20, 'offlimits': false },
			"_723": { 'id': "723", 'name': "Oyster", 'type': "Fish", 'category': -4, 'price': 40, 'offlimits': false },
			"_724": { 'id': "724", 'name': "Maple Syrup", 'type': "Basic", 'category': -27, 'price': 200, 'offlimits': false },
			"_725": { 'id': "725", 'name': "Oak Resin", 'type': "Basic", 'category': -27, 'price': 150, 'offlimits': false },
			"_726": { 'id': "726", 'name': "Pine Tar", 'type': "Basic", 'category': -27, 'price': 100, 'offlimits': false },
			"_727": { 'id': "727", 'name': "Chowder", 'type': "Cooking", 'category': -7, 'price': 135, 'offlimits': false },
			"_730": { 'id': "730", 'name': "Lobster Bisque", 'type': "Cooking", 'category': -7, 'price': 205, 'offlimits': false },
			"_728": { 'id': "728", 'name': "Fish Stew", 'type': "Cooking", 'category': -7, 'price': 175, 'offlimits': false },
			"_729": { 'id': "729", 'name': "Escargot", 'type': "Cooking", 'category': -7, 'price': 125, 'offlimits': false },
			"_731": { 'id': "731", 'name': "Maple Bar", 'type': "Cooking", 'category': -7, 'price': 300, 'offlimits': false },
			"_732": { 'id': "732", 'name': "Crab Cakes", 'type': "Cooking", 'category': -7, 'price': 275, 'offlimits': false },
			"_733": { 'id': "733", 'name': "Shrimp Cocktail", 'type': "Cooking", 'category': -7, 'price': 160, 'offlimits': false },
			"_734": { 'id': "734", 'name': "Woodskip", 'type': "Fish", 'category': -4, 'price': 75, 'offlimits': false },
			"_742": { 'id': "742", 'name': "Haley's Lost Bracelet", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_745": { 'id': "745", 'name': "Strawberry Seeds", 'type': "Seeds", 'category': -74, 'price': 0, 'offlimits': false },
			"_746": { 'id': "746", 'name': "Jack-O-Lantern", 'type': "Crafting", 'category': -8, 'price': 0, 'offlimits': false },
			"_747": { 'id': "747", 'name': "Rotten Plant", 'type': "Basic", 'category': -20, 'price': 0, 'offlimits': false },
			"_748": { 'id': "748", 'name': "Rotten Plant", 'type': "Basic", 'category': -20, 'price': 0, 'offlimits': false },
			"_749": { 'id': "749", 'name': "Omni Geode", 'type': "Basic", 'category': 0, 'price': 0, 'offlimits': false },
			"_750": { 'id': "750", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_751": { 'id': "751", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_760": { 'id': "760", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_762": { 'id': "762", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_764": { 'id': "764", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_765": { 'id': "765", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_766": { 'id': "766", 'name': "Slime", 'type': "Basic", 'category': -28, 'price': 5, 'offlimits': false },
			"_767": { 'id': "767", 'name': "Bat Wing", 'type': "Basic", 'category': -28, 'price': 15, 'offlimits': false },
			"_768": { 'id': "768", 'name': "Solar Essence", 'type': "Basic", 'category': -28, 'price': 40, 'offlimits': false },
			"_769": { 'id': "769", 'name': "Void Essence", 'type': "Basic", 'category': -28, 'price': 50, 'offlimits': false },
			"_770": { 'id': "770", 'name': "Mixed Seeds", 'type': "Seeds", 'category': -74, 'price': 0, 'offlimits': false },
			"_771": { 'id': "771", 'name': "Fiber", 'type': "Basic", 'category': -16, 'price': 1, 'offlimits': false },
			"_772": { 'id': "772", 'name': "Oil of Garlic", 'type': "Cooking", 'category': -7, 'price': 1000, 'offlimits': false },
			"_773": { 'id': "773", 'name': "Life Elixir", 'type': "Cooking", 'category': -7, 'price': 250, 'offlimits': false },
			"_774": { 'id': "774", 'name': "Wild Bait", 'type': "Basic", 'category': -21, 'price': 15, 'offlimits': true },
			"_775": { 'id': "775", 'name': "Glacierfish", 'type': "Fish", 'category': -4, 'price': 1000, 'offlimits': true },
			"_784": { 'id': "784", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_785": { 'id': "785", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_786": { 'id': "786", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_787": { 'id': "787", 'name': "Battery Pack", 'type': "Basic", 'category': -16, 'price': 500, 'offlimits': false },
			"_788": { 'id': "788", 'name': "Lost Axe", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_789": { 'id': "789", 'name': "Lucky Purple Shorts", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_790": { 'id': "790", 'name': "Berry Basket", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_792": { 'id': "792", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_793": { 'id': "793", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_794": { 'id': "794", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_795": { 'id': "795", 'name': "Void Salmon", 'type': "Fish", 'category': -4, 'price': 150, 'offlimits': false },
			"_796": { 'id': "796", 'name': "Slimejack", 'type': "Fish", 'category': -4, 'price': 100, 'offlimits': false },
			"_797": { 'id': "797", 'name': "Pearl", 'type': "Basic", 'category': 0, 'price': 2500, 'offlimits': true },
			"_798": { 'id': "798", 'name': "Midnight Squid", 'type': "Fish", 'category': -4, 'price': 100, 'offlimits': true },
			"_799": { 'id': "799", 'name': "Spook Fish", 'type': "Fish", 'category': -4, 'price': 220, 'offlimits': true },
			"_800": { 'id': "800", 'name': "Blobfish", 'type': "Fish", 'category': -4, 'price': 500, 'offlimits': true },
			"_801": { 'id': "801", 'name': "Wedding Ring", 'type': "Ring", 'category': 0, 'price': 2000, 'offlimits': true },
			"_802": { 'id': "802", 'name': "Cactus Seeds", 'type': "Seeds", 'category': -74, 'price': 0, 'offlimits': true },
			"_803": { 'id': "803", 'name': "Iridium Milk", 'type': "Basic", 'category': 0, 'price': 0, 'offlimits': true },
			"_805": { 'id': "805", 'name': "Tree Fertilizer", 'type': "Basic", 'category': -19, 'price': 10, 'offlimits': false },
			"_807": { 'id': "807", 'name': "Dinosaur Mayonnaise", 'type': "Basic", 'category': -26, 'price': 800, 'offlimits': true },
			"_808": { 'id': "808", 'name': "Void Ghost Pendant", 'type': "Basic", 'category': 0, 'price': 4500, 'offlimits': false },
			"_809": { 'id': "809", 'name': "Movie Ticket", 'type': "Basic", 'category': 0, 'price': 500, 'offlimits': false },
			"_810": { 'id': "810", 'name': "Crabshell Ring", 'type': "Ring", 'category': 0, 'price': 2000, 'offlimits': false },
			"_811": { 'id': "811", 'name': "Napalm Ring", 'type': "Ring", 'category': 0, 'price': 2000, 'offlimits': false },
			"_812": { 'id': "812", 'name': "Roe", 'type': "Basic", 'category': -23, 'price': 30, 'offlimits': true },
			"_445": { 'id': "445", 'name': "Caviar", 'type': "Basic", 'category': -26, 'price': 500, 'offlimits': false },
			"_814": { 'id': "814", 'name': "Squid Ink", 'type': "Basic", 'category': -23, 'price': 110, 'offlimits': false },
			"_815": { 'id': "815", 'name': "Tea Leaves", 'type': "Basic", 'category': -75, 'price': 50, 'offlimits': false },
			"_267": { 'id': "267", 'name': "Flounder", 'type': "Fish", 'category': -4, 'price': 100, 'offlimits': false },
			"_265": { 'id': "265", 'name': "Seafoam Pudding", 'type': "Cooking", 'category': -7, 'price': 300, 'offlimits': false },
			"_269": { 'id': "269", 'name': "Midnight Carp", 'type': "Fish", 'category': -4, 'price': 150, 'offlimits': false },
			"_292": { 'id': "292", 'name': "Mahogany Seed", 'type': "Crafting", 'category': -74, 'price': 100, 'offlimits': true },
			"_289": { 'id': "289", 'name': "Ostrich Egg", 'type': "Basic", 'category': -5, 'price': 600, 'offlimits': true },
			"_25": { 'id': "25", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_73": { 'id': "73", 'name': "Golden Walnut", 'type': "Basic", 'category': 0, 'price': 250, 'offlimits': true },
			"_69": { 'id': "69", 'name': "Banana Sapling", 'type': "Basic", 'category': -74, 'price': 850, 'offlimits': true },
			"_91": { 'id': "91", 'name': "Banana", 'type': "Basic", 'category': -79, 'price': 150, 'offlimits': true },
			"_791": { 'id': "791", 'name': "Golden Coconut", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_816": { 'id': "816", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_817": { 'id': "817", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_818": { 'id': "818", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_819": { 'id': "819", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_820": { 'id': "820", 'name': "Fossilized Skull", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_821": { 'id': "821", 'name': "Fossilized Spine", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_822": { 'id': "822", 'name': "Fossilized Tail", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_823": { 'id': "823", 'name': "Fossilized Leg", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_824": { 'id': "824", 'name': "Fossilized Ribs", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_825": { 'id': "825", 'name': "Snake Skull", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_826": { 'id': "826", 'name': "Snake Vertebrae", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_827": { 'id': "827", 'name': "Mummified Bat", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_828": { 'id': "828", 'name': "Mummified Frog", 'type': "Basic", 'category': 0, 'price': 100, 'offlimits': false },
			"_829": { 'id': "829", 'name': "Ginger", 'type': "Basic", 'category': -81, 'price': 60, 'offlimits': false },
			"_830": { 'id': "830", 'name': "Taro Root", 'type': "Basic", 'category': -75, 'price': 100, 'offlimits': false },
			"_831": { 'id': "831", 'name': "Taro Tuber", 'type': "Seeds", 'category': -74, 'price': 20, 'offlimits': false },
			"_832": { 'id': "832", 'name': "Pineapple", 'type': "Basic", 'category': -79, 'price': 300, 'offlimits': false },
			"_833": { 'id': "833", 'name': "Pineapple Seeds", 'type': "Seeds", 'category': -74, 'price': 240, 'offlimits': false },
			"_834": { 'id': "834", 'name': "Mango", 'type': "Basic", 'category': -79, 'price': 130, 'offlimits': false },
			"_835": { 'id': "835", 'name': "Mango Sapling", 'type': "Basic", 'category': -74, 'price': 850, 'offlimits': false },
			"_836": { 'id': "836", 'name': "Stingray", 'type': "Fish", 'category': -4, 'price': 180, 'offlimits': false },
			"_837": { 'id': "837", 'name': "Lionfish", 'type': "Fish", 'category': -4, 'price': 100, 'offlimits': false },
			"_838": { 'id': "838", 'name': "Blue Discus", 'type': "Fish", 'category': -4, 'price': 120, 'offlimits': false },
			"_839": { 'id': "839", 'name': "Thorns Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_840": { 'id': "840", 'name': "Rustic Plank Floor", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_841": { 'id': "841", 'name': "Stone Walkway Floor", 'type': "Crafting", 'category': -24, 'price': 1, 'offlimits': false },
			"_842": { 'id': "842", 'name': "Journal Scrap", 'type': "asdf", 'category': 0, 'price': 1, 'offlimits': false },
			"_843": { 'id': "843", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_844": { 'id': "844", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_845": { 'id': "845", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_846": { 'id': "846", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_847": { 'id': "847", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_848": { 'id': "848", 'name': "Cinder Shard", 'type': "Basic", 'category': -15, 'price': 50, 'offlimits': false },
			"_849": { 'id': "849", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_850": { 'id': "850", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_851": { 'id': "851", 'name': "Magma Cap", 'type': "Basic", 'category': -81, 'price': 400, 'offlimits': false },
			"_852": { 'id': "852", 'name': "Dragon Tooth", 'type': "Basic", 'category': 0, 'price': 500, 'offlimits': false },
			"_856": { 'id': "856", 'name': "Curiosity Lure", 'type': "Basic", 'category': -22, 'price': 500, 'offlimits': false },
			"_857": { 'id': "857", 'name': "Tiger Slime Egg", 'type': "Basic", 'category': 0, 'price': 8000, 'offlimits': false },
			"_858": { 'id': "858", 'name': "Qi Gem", 'type': "Basic", 'category': 0, 'price': 250, 'offlimits': false },
			"_859": { 'id': "859", 'name': "Lucky Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_860": { 'id': "860", 'name': "Hot Java Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_861": { 'id': "861", 'name': "Protection Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_862": { 'id': "862", 'name': "Soul Sapper Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_863": { 'id': "863", 'name': "Phoenix Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_864": { 'id': "864", 'name': "War Memento", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_865": { 'id': "865", 'name': "Gourmet Tomato Salt", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_866": { 'id': "866", 'name': "Stardew Valley Rose", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_867": { 'id': "867", 'name': "Advanced TV Remote", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_868": { 'id': "868", 'name': "Arctic Shard", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_869": { 'id': "869", 'name': "Wriggling Worm", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_870": { 'id': "870", 'name': "Pirate's Locket", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_872": { 'id': "872", 'name': "Fairy Dust", 'type': "Basic", 'category': 0, 'price': 300, 'offlimits': false },
			"_873": { 'id': "873", 'name': "PiÃ±a Colada", 'type': "Cooking", 'category': -7, 'price': 300, 'offlimits': false },
			"_874": { 'id': "874", 'name': "Bug Steak", 'type': "Crafting", 'category': 0, 'price': 50, 'offlimits': false },
			"_875": { 'id': "875", 'name': "Ectoplasm", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_876": { 'id': "876", 'name': "Prismatic Jelly", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_877": { 'id': "877", 'name': "Quality Bobber", 'type': "Basic", 'category': -22, 'price': 300, 'offlimits': false },
			"_879": { 'id': "879", 'name': "Monster Musk", 'type': "Crafting", 'category': 0, 'price': 50, 'offlimits': false },
			"_880": { 'id': "880", 'name': "Combined Ring", 'type': "Ring", 'category': 0, 'price': 100, 'offlimits': false },
			"_881": { 'id': "881", 'name': "Bone Fragment", 'type': "Basic", 'category': -15, 'price': 12, 'offlimits': false },
			"_882": { 'id': "882", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_883": { 'id': "883", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_884": { 'id': "884", 'name': "Weeds", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_885": { 'id': "885", 'name': "Fiber Seeds", 'type': "Seeds", 'category': -74, 'price': 5, 'offlimits': false },
			"_886": { 'id': "886", 'name': "Warp Totem: Island", 'type': "Crafting", 'category': 0, 'price': 20, 'offlimits': false },
			"_887": { 'id': "887", 'name': "Immunity Band", 'type': "Ring", 'category': 0, 'price': 500, 'offlimits': false },
			"_888": { 'id': "888", 'name': "Glowstone Ring", 'type': "Ring", 'category': 0, 'price': 200, 'offlimits': false },
			"_889": { 'id': "889", 'name': "Qi Fruit", 'type': "Basic", 'category': -79, 'price': 1, 'offlimits': false },
			"_890": { 'id': "890", 'name': "Qi Bean", 'type': "Seeds", 'category': -74, 'price': 1, 'offlimits': false },
			"_891": { 'id': "891", 'name': "Mushroom Tree Seed", 'type': "Crafting", 'category': -74, 'price': 100, 'offlimits': false },
			"_892": { 'id': "892", 'name': "Warp Totem: Qi's Arena", 'type': "Crafting", 'category': 0, 'price': 20, 'offlimits': false },
			"_893": { 'id': "893", 'name': "Fireworks (Red)", 'type': "Crafting", 'category': -8, 'price': 50, 'offlimits': false },
			"_894": { 'id': "894", 'name': "Fireworks (Purple)", 'type': "Crafting", 'category': -8, 'price': 50, 'offlimits': false },
			"_895": { 'id': "895", 'name': "Fireworks (Green)", 'type': "Crafting", 'category': -8, 'price': 50, 'offlimits': false },
			"_896": { 'id': "896", 'name': "Galaxy Soul", 'type': "Crafting", 'category': 0, 'price': 5000, 'offlimits': false },
			"_897": { 'id': "897", 'name': "Pierre's Missing Stocklist", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_898": { 'id': "898", 'name': "Son of Crimsonfish", 'type': "Fish", 'category': -4, 'price': 1500, 'offlimits': false },
			"_899": { 'id': "899", 'name': "Ms. Angler", 'type': "Fish", 'category': -4, 'price': 900, 'offlimits': false },
			"_900": { 'id': "900", 'name': "Legend II", 'type': "Fish", 'category': -4, 'price': 5000, 'offlimits': false },
			"_901": { 'id': "901", 'name': "Radioactive Carp", 'type': "Fish", 'category': -4, 'price': 1000, 'offlimits': false },
			"_902": { 'id': "902", 'name': "Glacierfish Jr.", 'type': "Fish", 'category': -4, 'price': 1000, 'offlimits': false },
			"_903": { 'id': "903", 'name': "Ginger Ale", 'type': "Cooking", 'category': -7, 'price': 200, 'offlimits': false },
			"_904": { 'id': "904", 'name': "Banana Pudding", 'type': "Cooking", 'category': -7, 'price': 260, 'offlimits': false },
			"_905": { 'id': "905", 'name': "Mango Sticky Rice", 'type': "Cooking", 'category': -7, 'price': 250, 'offlimits': false },
			"_906": { 'id': "906", 'name': "Poi", 'type': "Cooking", 'category': -7, 'price': 400, 'offlimits': false },
			"_907": { 'id': "907", 'name': "Tropical Curry", 'type': "Cooking", 'category': -7, 'price': 500, 'offlimits': false },
			"_908": { 'id': "908", 'name': "Magic Bait", 'type': "Basic", 'category': -21, 'price': 1, 'offlimits': false },
			"_909": { 'id': "909", 'name': "Radioactive Ore", 'type': "Basic", 'category': -15, 'price': 300, 'offlimits': false },
			"_910": { 'id': "910", 'name': "Radioactive Bar", 'type': "Basic", 'category': -15, 'price': 3000, 'offlimits': false },
			"_911": { 'id': "911", 'name': "Horse Flute", 'type': "Crafting", 'category': 0, 'price': 3000, 'offlimits': false },
			"_913": { 'id': "913", 'name': "Enricher", 'type': "Basic", 'category': 0, 'price': 200, 'offlimits': false },
			"_915": { 'id': "915", 'name': "Pressure Nozzle", 'type': "Basic", 'category': 0, 'price': 200, 'offlimits': false },
			"_917": { 'id': "917", 'name': "Qi Seasoning", 'type': "Basic", 'category': 0, 'price': 200, 'offlimits': false },
			"_918": { 'id': "918", 'name': "Hyper Speed-Gro", 'type': "Basic", 'category': -19, 'price': 70, 'offlimits': false },
			"_919": { 'id': "919", 'name': "Deluxe Fertilizer", 'type': "Basic", 'category': -19, 'price': 70, 'offlimits': false },
			"_920": { 'id': "920", 'name': "Deluxe Retaining Soil", 'type': "Basic", 'category': -19, 'price': 30, 'offlimits': false },
			"_921": { 'id': "921", 'name': "Squid Ink Ravioli", 'type': "Cooking", 'category': -7, 'price': 150, 'offlimits': false },
			"_922": { 'id': "922", 'name': "SupplyCrate", 'type': "Crafting", 'category': 0, 'price': 1, 'offlimits': false },
			"_923": { 'id': "923", 'name': "SupplyCrate", 'type': "Crafting", 'category': 0, 'price': 1, 'offlimits': false },
			"_924": { 'id': "924", 'name': "SupplyCrate", 'type': "Crafting", 'category': 0, 'price': 1, 'offlimits': false },
			"_925": { 'id': "925", 'name': "Slime Crate", 'type': "Crafting", 'category': 0, 'price': 3000, 'offlimits': false },
			"_926": { 'id': "926", 'name': "Cookout Kit", 'type': "Crafting", 'category': 0, 'price': 80, 'offlimits': false },
			"_927": { 'id': "927", 'name': "Camping Stove", 'type': "Crafting", 'category': 0, 'price': 1, 'offlimits': false },
			"_928": { 'id': "928", 'name': "Golden Egg", 'type': "Basic", 'category': -5, 'price': 500, 'offlimits': false },
			"_929": { 'id': "929", 'name': "Hedge", 'type': "Crafting", 'category': -8, 'price': 10, 'offlimits': false },
			"_930": { 'id': "930", 'name': "???", 'type': "Basic", 'category': 0, 'price': 0, 'offlimits': false },
			"_FarAwayStone": { 'id': "FarAwayStone", 'name': "Far Away Stone", 'type': "Basic", 'category': 0, 'price': 500, 'offlimits': true },
			"_CalicoEgg": { 'id': "CalicoEgg", 'name': "Calico Egg", 'type': "Basic", 'category': 0, 'price': 0, 'offlimits': false },
			"_MixedFlowerSeeds": { 'id': "MixedFlowerSeeds", 'name': "Mixed Flower Seeds", 'type': "Seeds", 'category': -74, 'price': 0, 'offlimits': false },
			"_GoldenBobber": { 'id': "GoldenBobber", 'name': "Golden Bobber", 'type': "Quest", 'category': 0, 'price': 0, 'offlimits': false },
			"_CalicoEggStone_0": { 'id': "CalicoEggStone_0", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_CalicoEggStone_1": { 'id': "CalicoEggStone_1", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_CalicoEggStone_2": { 'id': "CalicoEggStone_2", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_MysteryBox": { 'id': "MysteryBox", 'name': "Mystery Box", 'type': "Basic", 'category': 0, 'price': 0, 'offlimits': false },
			"_TroutDerbyTag": { 'id': "TroutDerbyTag", 'name': "Golden Tag", 'type': "Basic", 'category': 0, 'price': 0, 'offlimits': false },
			"_DeluxeBait": { 'id': "DeluxeBait", 'name': "Deluxe Bait", 'type': "Basic", 'category': -21, 'price': 1, 'offlimits': false },
			"_Moss": { 'id': "Moss", 'name': "Moss", 'type': "Basic", 'category': -16, 'price': 5, 'offlimits': false },
			"_MossySeed": { 'id': "MossySeed", 'name': "Mossy Seed", 'type': "Crafting", 'category': -74, 'price': 100, 'offlimits': false },
			"_GreenRainWeeds0": { 'id': "GreenRainWeeds0", 'name': "GreenRainWeeds0", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_GreenRainWeeds1": { 'id': "GreenRainWeeds1", 'name': "GreenRainWeeds1", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_GreenRainWeeds2": { 'id': "GreenRainWeeds2", 'name': "GreenRainWeeds2", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_GreenRainWeeds3": { 'id': "GreenRainWeeds3", 'name': "GreenRainWeeds3", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_GreenRainWeeds4": { 'id': "GreenRainWeeds4", 'name': "GreenRainWeeds4", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_GreenRainWeeds5": { 'id': "GreenRainWeeds5", 'name': "GreenRainWeeds5", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_GreenRainWeeds6": { 'id': "GreenRainWeeds6", 'name': "GreenRainWeeds6", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_GreenRainWeeds7": { 'id': "GreenRainWeeds7", 'name': "GreenRainWeeds7", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_SonarBobber": { 'id': "SonarBobber", 'name': "Sonar Bobber", 'type': "Basic", 'category': -22, 'price': 250, 'offlimits': false },
			"_SpecificBait": { 'id': "SpecificBait", 'name': "Bait", 'type': "Basic", 'category': -21, 'price': 5, 'offlimits': false },
			"_TentKit": { 'id': "TentKit", 'name': "Tent Kit", 'type': "Crafting", 'category': 0, 'price': 200, 'offlimits': false },
			"_VolcanoGoldNode": { 'id': "VolcanoGoldNode", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_MysticTreeSeed": { 'id': "MysticTreeSeed", 'name': "Mystic Tree Seed", 'type': "Crafting", 'category': -74, 'price': 100, 'offlimits': false },
			"_MysticSyrup": { 'id': "MysticSyrup", 'name': "Mystic Syrup", 'type': "Basic", 'category': -27, 'price': 1000, 'offlimits': false },
			"_Raisins": { 'id': "Raisins", 'name': "Raisins", 'type': "Basic", 'category': -26, 'price': 600, 'offlimits': false },
			"_DriedFruit": { 'id': "DriedFruit", 'name': "Dried", 'type': "Basic", 'category': -26, 'price': 25, 'offlimits': false },
			"_DriedMushrooms": { 'id': "DriedMushrooms", 'name': "Dried", 'type': "Basic", 'category': -26, 'price': 25, 'offlimits': false },
			"_StardropTea": { 'id': "StardropTea", 'name': "Stardrop Tea", 'type': "Basic", 'category': 0, 'price': 77, 'offlimits': false },
			"_PrizeTicket": { 'id': "PrizeTicket", 'name': "Prize Ticket", 'type': "Basic", 'category': 0, 'price': 1, 'offlimits': false },
			"_GoldCoin": { 'id': "GoldCoin", 'name': "Gold Coin", 'type': "Basic", 'category': 0, 'price': 1, 'offlimits': false },
			"_TreasureTotem": { 'id': "TreasureTotem", 'name': "Treasure Totem", 'type': "Crafting", 'category': 0, 'price': 20, 'offlimits': false },
			"_ChallengeBait": { 'id': "ChallengeBait", 'name': "Challenge Bait", 'type': "Basic", 'category': -21, 'price': 1, 'offlimits': false },
			"_CarrotSeeds": { 'id': "CarrotSeeds", 'name': "Carrot Seeds", 'type': "Seeds", 'category': -74, 'price': 15, 'offlimits': false },
			"_Carrot": { 'id': "Carrot", 'name': "Carrot", 'type': "Basic", 'category': -75, 'price': 35, 'offlimits': false },
			"_SummerSquashSeeds": { 'id': "SummerSquashSeeds", 'name': "Summer Squash Seeds", 'type': "Seeds", 'category': -74, 'price': 20, 'offlimits': false },
			"_SummerSquash": { 'id': "SummerSquash", 'name': "Summer Squash", 'type': "Basic", 'category': -75, 'price': 45, 'offlimits': false },
			"_BroccoliSeeds": { 'id': "BroccoliSeeds", 'name': "Broccoli Seeds", 'type': "Seeds", 'category': -74, 'price': 40, 'offlimits': false },
			"_Broccoli": { 'id': "Broccoli", 'name': "Broccoli", 'type': "Basic", 'category': -75, 'price': 70, 'offlimits': false },
			"_PowdermelonSeeds": { 'id': "PowdermelonSeeds", 'name': "Powdermelon Seeds", 'type': "Seeds", 'category': -74, 'price': 20, 'offlimits': false },
			"_Powdermelon": { 'id': "Powdermelon", 'name': "Powdermelon", 'type': "Basic", 'category': -79, 'price': 60, 'offlimits': false },
			"_SeedSpot": { 'id': "SeedSpot", 'name': "Seed Spot", 'type': "asdf", 'category': 0, 'price': 0, 'offlimits': false },
			"_SmokedFish": { 'id': "SmokedFish", 'name': "Smoked", 'type': "Basic", 'category': -26, 'price': 25, 'offlimits': false },
			"_PurpleBook": { 'id': "PurpleBook", 'name': "Book Of Stars", 'type': "asdf", 'category': -103, 'price': 2500, 'offlimits': false },
			"_SkillBook_0": { 'id': "SkillBook_0", 'name': "Stardew Valley Almanac", 'type': "asdf", 'category': -103, 'price': 500, 'offlimits': false },
			"_SkillBook_2": { 'id': "SkillBook_2", 'name': "Woodcutter's Weekly", 'type': "asdf", 'category': -103, 'price': 500, 'offlimits': false },
			"_SkillBook_1": { 'id': "SkillBook_1", 'name': "Bait And Bobber", 'type': "asdf", 'category': -103, 'price': 500, 'offlimits': false },
			"_SkillBook_3": { 'id': "SkillBook_3", 'name': "Mining Monthly", 'type': "asdf", 'category': -103, 'price': 500, 'offlimits': false },
			"_SkillBook_4": { 'id': "SkillBook_4", 'name': "Combat Quarterly", 'type': "asdf", 'category': -103, 'price': 500, 'offlimits': false },
			"_Book_Trash": { 'id': "Book_Trash", 'name': "The Alleyway Buffet", 'type': "asdf", 'category': -102, 'price': 3000, 'offlimits': false },
			"_Book_Crabbing": { 'id': "Book_Crabbing", 'name': "The Art O' Crabbing", 'type': "asdf", 'category': -102, 'price': 1000, 'offlimits': false },
			"_Book_Bombs": { 'id': "Book_Bombs", 'name': "Dwarvish Safety Manual", 'type': "asdf", 'category': -102, 'price': 1000, 'offlimits': false },
			"_Book_Roe": { 'id': "Book_Roe", 'name': "Jewels Of The Sea", 'type': "asdf", 'category': -102, 'price': 800, 'offlimits': false },
			"_Book_WildSeeds": { 'id': "Book_WildSeeds", 'name': "Raccoon Journal", 'type': "asdf", 'category': -102, 'price': 1000, 'offlimits': false },
			"_Book_Woodcutting": { 'id': "Book_Woodcutting", 'name': "Woody's Secret", 'type': "asdf", 'category': -102, 'price': 500, 'offlimits': false },
			"_Book_Defense": { 'id': "Book_Defense", 'name': "Jack Be Nimble, Jack Be Thick", 'type': "asdf", 'category': -102, 'price': 500, 'offlimits': false },
			"_Book_Friendship": { 'id': "Book_Friendship", 'name': "Friendship 101", 'type': "asdf", 'category': -102, 'price': 3000, 'offlimits': false },
			"_Book_Void": { 'id': "Book_Void", 'name': "Monster Compendium", 'type': "asdf", 'category': -102, 'price': 2000, 'offlimits': false },
			"_Book_Speed": { 'id': "Book_Speed", 'name': "Way Of The Wind pt. 1", 'type': "asdf", 'category': -102, 'price': 5000, 'offlimits': false },
			"_Book_Marlon": { 'id': "Book_Marlon", 'name': "Mapping Cave Systems", 'type': "asdf", 'category': -102, 'price': 4000, 'offlimits': false },
			"_Book_PriceCatalogue": { 'id': "Book_PriceCatalogue", 'name': "Price Catalogue", 'type': "asdf", 'category': -102, 'price': 1000, 'offlimits': false },
			"_Book_QueenOfSauce": { 'id': "Book_QueenOfSauce", 'name': "Queen Of Sauce Cookbook", 'type': "asdf", 'category': -102, 'price': 10000, 'offlimits': false },
			"_Book_Diamonds": { 'id': "Book_Diamonds", 'name': "The Diamond Hunter", 'type': "asdf", 'category': -102, 'price': 1000, 'offlimits': false },
			"_Book_Mystery": { 'id': "Book_Mystery", 'name': "Book of Mysteries", 'type': "asdf", 'category': -102, 'price': 3000, 'offlimits': false },
			"_Book_AnimalCatalogue": { 'id': "Book_AnimalCatalogue", 'name': "Animal Catalogue", 'type': "asdf", 'category': -102, 'price': 2000, 'offlimits': false },
			"_Book_Speed2": { 'id': "Book_Speed2", 'name': "Way Of The Wind pt. 2", 'type': "asdf", 'category': -102, 'price': 10000, 'offlimits': false },
			"_GoldenAnimalCracker": { 'id': "GoldenAnimalCracker", 'name': "Golden Animal Cracker", 'type': "asdf", 'category': 0, 'price': 1000, 'offlimits': false },
			"_GoldenMysteryBox": { 'id': "GoldenMysteryBox", 'name': "Golden Mystery Box", 'type': "Basic", 'category': 0, 'price': 0, 'offlimits': false },
			"_SeaJelly": { 'id': "SeaJelly", 'name': "Sea Jelly", 'type': "Fish", 'category': 0, 'price': 200, 'offlimits': false },
			"_CaveJelly": { 'id': "CaveJelly", 'name': "Cave Jelly", 'type': "Fish", 'category': 0, 'price': 180, 'offlimits': false },
			"_RiverJelly": { 'id': "RiverJelly", 'name': "River Jelly", 'type': "Fish", 'category': 0, 'price': 125, 'offlimits': false },
			"_Goby": { 'id': "Goby", 'name': "Goby", 'type': "Fish", 'category': -4, 'price': 150, 'offlimits': false },
			"_VolcanoCoalNode0": { 'id': "VolcanoCoalNode0", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_VolcanoCoalNode1": { 'id': "VolcanoCoalNode1", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_PotOfGold": { 'id': "PotOfGold", 'name': "PotOfGold", 'type': "interactive", 'category': -999, 'price': 0, 'offlimits': false },
			"_Book_Artifact": { 'id': "Book_Artifact", 'name': "Ancient Treasures: Appraisal Guide", 'type': "asdf", 'category': -102, 'price': 500, 'offlimits': false },
			"_Book_Horse": { 'id': "Book_Horse", 'name': "Horse: The Book", 'type': "asdf", 'category': -102, 'price': 1000, 'offlimits': false },
			"_ButterflyPowder": { 'id': "ButterflyPowder", 'name': "Butterfly Powder", 'type': "Basic", 'category': 0, 'price': 0, 'offlimits': false },
			"_PetLicense": { 'id': "PetLicense", 'name': "Pet License", 'type': "Basic", 'category': 0, 'price': 0, 'offlimits': false },
			"_BlueGrassStarter": { 'id': "BlueGrassStarter", 'name': "Blue Grass Starter", 'type': "Crafting", 'category': 0, 'price': 50, 'offlimits': false },
			"_MossSoup": { 'id': "MossSoup", 'name': "Moss Soup", 'type': "Cooking", 'category': -7, 'price': 80, 'offlimits': false },
			"_Book_Grass": { 'id': "Book_Grass", 'name': "Ol' Slitherlegs", 'type': "asdf", 'category': -102, 'price': 1000, 'offlimits': false },
			"_BasicCoalNode0": { 'id': "BasicCoalNode0", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
			"_BasicCoalNode1": { 'id': "BasicCoalNode1", 'name': "Stone", 'type': "Litter", 'category': -999, 'price': 0, 'offlimits': false },
		};
		save.furniture = {
			"_0": { 'id': "0", 'name': "Oak Chair", 'price': 350, 'offlimits': false },
			"_3": { 'id': "3", 'name': "Walnut Chair", 'price': 350, 'offlimits': false },
			"_6": { 'id': "6", 'name': "Birch Chair", 'price': 350, 'offlimits': false },
			"_9": { 'id': "9", 'name': "Mahogany Chair", 'price': 1000, 'offlimits': false },
			"_12": { 'id': "12", 'name': "Red Diner Chair", 'price': 750, 'offlimits': false },
			"_15": { 'id': "15", 'name': "Blue Diner Chair", 'price': 750, 'offlimits': false },
			"_18": { 'id': "18", 'name': "Country Chair", 'price': 750, 'offlimits': false },
			"_21": { 'id': "21", 'name': "Breakfast Chair", 'price': 750, 'offlimits': false },
			"_24": { 'id': "24", 'name': "Pink Office Chair", 'price': 500, 'offlimits': false },
			"_27": { 'id': "27", 'name': "Purple Office Chair", 'price': 500, 'offlimits': false },
			"_30": { 'id': "30", 'name': "Green Office Stool", 'price': 350, 'offlimits': false },
			"_31": { 'id': "31", 'name': "Orange Office Stool", 'price': 350, 'offlimits': false },
			"_64": { 'id': "64", 'name': "Dark Throne", 'price': 2000, 'offlimits': false },
			"_67": { 'id': "67", 'name': "Dining Chair", 'price': 1200, 'offlimits': false },
			"_70": { 'id': "70", 'name': "Dining Chair", 'price': 1200, 'offlimits': false },
			"_73": { 'id': "73", 'name': "Green Plush Seat", 'price': 750, 'offlimits': false },
			"_76": { 'id': "76", 'name': "Pink Plush Seat", 'price': 750, 'offlimits': false },
			"_79": { 'id': "79", 'name': "Winter Chair", 'price': 750, 'offlimits': false },
			"_82": { 'id': "82", 'name': "Groovy Chair", 'price': 750, 'offlimits': false },
			"_85": { 'id': "85", 'name': "Cute Chair", 'price': 1200, 'offlimits': false },
			"_88": { 'id': "88", 'name': "Stump Seat", 'price': 2000, 'offlimits': false },
			"_91": { 'id': "91", 'name': "Metal Chair", 'price': 800, 'offlimits': false },
			"_94": { 'id': "94", 'name': "Green Stool", 'price': 350, 'offlimits': false },
			"_95": { 'id': "95", 'name': "Blue Stool", 'price': 350, 'offlimits': false },
			"_128": { 'id': "128", 'name': "King Chair", 'price': 3000, 'offlimits': false },
			"_131": { 'id': "131", 'name': "Crystal Chair", 'price': 3000, 'offlimits': true },
			"_192": { 'id': "192", 'name': "Oak Bench", 'price': 750, 'offlimits': false },
			"_197": { 'id': "197", 'name': "Walnut Bench", 'price': 750, 'offlimits': false },
			"_202": { 'id': "202", 'name': "Birch Bench", 'price': 750, 'offlimits': false },
			"_207": { 'id': "207", 'name': "Mahogany Bench", 'price': 2000, 'offlimits': false },
			"_212": { 'id': "212", 'name': "Modern Bench", 'price': 2000, 'offlimits': false },
			"_288": { 'id': "288", 'name': "Blue Armchair", 'price': 1000, 'offlimits': false },
			"_294": { 'id': "294", 'name': "Red Armchair", 'price': 1000, 'offlimits': false },
			"_300": { 'id': "300", 'name': "Green Armchair", 'price': 1000, 'offlimits': false },
			"_306": { 'id': "306", 'name': "Yellow Armchair", 'price': 1000, 'offlimits': false },
			"_312": { 'id': "312", 'name': "Brown Armchair", 'price': 1000, 'offlimits': false },
			"_416": { 'id': "416", 'name': "Blue Couch", 'price': 1750, 'offlimits': false },
			"_424": { 'id': "424", 'name': "Red Couch", 'price': 1750, 'offlimits': false },
			"_432": { 'id': "432", 'name': "Green Couch", 'price': 1750, 'offlimits': false },
			"_440": { 'id': "440", 'name': "Yellow Couch", 'price': 1750, 'offlimits': false },
			"_512": { 'id': "512", 'name': "Brown Couch", 'price': 1750, 'offlimits': false },
			"_520": { 'id': "520", 'name': "Dark Couch", 'price': 2500, 'offlimits': false },
			"_528": { 'id': "528", 'name': "Wizard Couch", 'price': 4000, 'offlimits': false },
			"_536": { 'id': "536", 'name': "Woodsy Couch", 'price': 3000, 'offlimits': false },
			"_704": { 'id': "704", 'name': "Oak Dresser", 'price': 5000, 'offlimits': false },
			"_709": { 'id': "709", 'name': "Walnut Dresser", 'price': 5000, 'offlimits': false },
			"_714": { 'id': "714", 'name': "Birch Dresser", 'price': 5000, 'offlimits': false },
			"_719": { 'id': "719", 'name': "Mahogany Dresser", 'price': 7500, 'offlimits': false },
			"_724": { 'id': "724", 'name': "Coffee Table", 'price': 1250, 'offlimits': false },
			"_727": { 'id': "727", 'name': "Stone Slab", 'price': 1000, 'offlimits': false },
			"_800": { 'id': "800", 'name': "Winter Dining Table", 'price': 3500, 'offlimits': false },
			"_807": { 'id': "807", 'name': "Festive Dining Table", 'price': 3500, 'offlimits': false },
			"_814": { 'id': "814", 'name': "Mahogany Dining Table", 'price': 3000, 'offlimits': false },
			"_821": { 'id': "821", 'name': "Modern Dining Table", 'price': 2700, 'offlimits': false },
			"_1120": { 'id': "1120", 'name': "Oak Table", 'price': 750, 'offlimits': false },
			"_1122": { 'id': "1122", 'name': "Walnut Table", 'price': 750, 'offlimits': false },
			"_1124": { 'id': "1124", 'name': "Birch Table", 'price': 750, 'offlimits': false },
			"_1126": { 'id': "1126", 'name': "Mahogany Table", 'price': 1500, 'offlimits': false },
			"_1128": { 'id': "1128", 'name': "Sun Table", 'price': 2500, 'offlimits': false },
			"_1130": { 'id': "1130", 'name': "Moon Table", 'price': 2500, 'offlimits': false },
			"_1132": { 'id': "1132", 'name': "Modern Table", 'price': 1250, 'offlimits': false },
			"_1134": { 'id': "1134", 'name': "Pub Table", 'price': 800, 'offlimits': false },
			"_1136": { 'id': "1136", 'name': "Luxury Table", 'price': 2000, 'offlimits': false },
			"_1138": { 'id': "1138", 'name': "Diviner Table", 'price': 2250, 'offlimits': false },
			"_1140": { 'id': "1140", 'name': "Neolithic Table", 'price': 1800, 'offlimits': false },
			"_1142": { 'id': "1142", 'name': "Puzzle Table", 'price': 1500, 'offlimits': false },
			"_1144": { 'id': "1144", 'name': "Winter Table", 'price': 1250, 'offlimits': false },
			"_1146": { 'id': "1146", 'name': "Candy Table", 'price': 1000, 'offlimits': false },
			"_1148": { 'id': "1148", 'name': "Luau Table", 'price': 1000, 'offlimits': false },
			"_1150": { 'id': "1150", 'name': "Dark Table", 'price': 2000, 'offlimits': false },
			"_1216": { 'id': "1216", 'name': "Oak Tea-Table", 'price': 750, 'offlimits': false },
			"_1218": { 'id': "1218", 'name': "Walnut Tea-Table", 'price': 750, 'offlimits': false },
			"_1220": { 'id': "1220", 'name': "Birch Tea-Table", 'price': 750, 'offlimits': false },
			"_1222": { 'id': "1222", 'name': "Mahogany Tea-Table", 'price': 1500, 'offlimits': false },
			"_1224": { 'id': "1224", 'name': "Modern Tea-Table", 'price': 1000, 'offlimits': false },
			"_1226": { 'id': "1226", 'name': "Furniture Catalogue", 'price': 200000, 'offlimits': true },
			"_1280": { 'id': "1280", 'name': "China Cabinet", 'price': 6000, 'offlimits': false },
			"_1283": { 'id': "1283", 'name': "Artist Bookcase", 'price': 1200, 'offlimits': false },
			"_1285": { 'id': "1285", 'name': "Luxury Bookcase", 'price': 2000, 'offlimits': false },
			"_1287": { 'id': "1287", 'name': "Modern Bookcase", 'price': 1600, 'offlimits': false },
			"_1289": { 'id': "1289", 'name': "Dark Bookcase", 'price': 2000, 'offlimits': false },
			"_1291": { 'id': "1291", 'name': "Ceramic Pillar", 'price': 250, 'offlimits': false },
			"_1292": { 'id': "1292", 'name': "Gold Pillar", 'price': 450, 'offlimits': false },
			"_1293": { 'id': "1293", 'name': "Industrial Pipe", 'price': 300, 'offlimits': false },
			"_1294": { 'id': "1294", 'name': "Indoor Palm", 'price': 600, 'offlimits': false },
			"_1295": { 'id': "1295", 'name': "Totem Pole", 'price': 750, 'offlimits': false },
			"_1296": { 'id': "1296", 'name': "Manicured Pine", 'price': 500, 'offlimits': false },
			"_1297": { 'id': "1297", 'name': "Topiary Tree", 'price': 500, 'offlimits': false },
			"_1298": { 'id': "1298", 'name': "Standing Geode", 'price': 500, 'offlimits': true },
			"_1299": { 'id': "1299", 'name': "Obsidian Vase", 'price': 500, 'offlimits': true },
			"_1300": { 'id': "1300", 'name': "Singing Stone", 'price': 500, 'offlimits': true },
			"_1301": { 'id': "1301", 'name': "Sloth Skeleton L", 'price': 500, 'offlimits': true },
			"_1302": { 'id': "1302", 'name': "Sloth Skeleton M", 'price': 500, 'offlimits': true },
			"_1303": { 'id': "1303", 'name': "Sloth Skeleton R", 'price': 500, 'offlimits': true },
			"_1304": { 'id': "1304", 'name': "Skeleton", 'price': 500, 'offlimits': true },
			"_1305": { 'id': "1305", 'name': "Chicken Statue", 'price': 500, 'offlimits': true },
			"_1306": { 'id': "1306", 'name': "Leah's Sculpture", 'price': 500, 'offlimits': true },
			"_1307": { 'id': "1307", 'name': "Dried Sunflowers", 'price': 500, 'offlimits': true },
			"_1308": { 'id': "1308", 'name': "Catalogue", 'price': 30000, 'offlimits': true },
			"_1309": { 'id': "1309", 'name': "Sam's Boombox", 'price': 500, 'offlimits': true },
			"_1362": { 'id': "1362", 'name': "Small Plant", 'price': 250, 'offlimits': false },
			"_1363": { 'id': "1363", 'name': "Table Plant", 'price': 250, 'offlimits': false },
			"_1364": { 'id': "1364", 'name': "Decorative Bowl", 'price': 250, 'offlimits': false },
			"_1365": { 'id': "1365", 'name': "Futan Bear", 'price': 1500, 'offlimits': false },
			"_1366": { 'id': "1366", 'name': "Globe", 'price': 750, 'offlimits': false },
			"_1367": { 'id': "1367", 'name': "Model Ship", 'price': 750, 'offlimits': false },
			"_1368": { 'id': "1368", 'name': "Small Crystal", 'price': 750, 'offlimits': false },
			"_1369": { 'id': "1369", 'name': "Decorative Lantern", 'price': 500, 'offlimits': false },
			"_1376": { 'id': "1376", 'name': "House Plant (1376)", 'price': 250, 'offlimits': false },
			"_1377": { 'id': "1377", 'name': "House Plant (1377)", 'price': 250, 'offlimits': false },
			"_1378": { 'id': "1378", 'name': "House Plant (1378)", 'price': 250, 'offlimits': false },
			"_1379": { 'id': "1379", 'name': "House Plant (1379)", 'price': 250, 'offlimits': false },
			"_1380": { 'id': "1380", 'name': "House Plant (1380)", 'price': 250, 'offlimits': false },
			"_1381": { 'id': "1381", 'name': "House Plant (1381)", 'price': 250, 'offlimits': false },
			"_1382": { 'id': "1382", 'name': "House Plant (1382)", 'price': 250, 'offlimits': false },
			"_1383": { 'id': "1383", 'name': "House Plant (1383)", 'price': 250, 'offlimits': false },
			"_1384": { 'id': "1384", 'name': "House Plant (1384)", 'price': 250, 'offlimits': false },
			"_1385": { 'id': "1385", 'name': "House Plant (1385)", 'price': 250, 'offlimits': false },
			"_1386": { 'id': "1386", 'name': "House Plant (1386)", 'price': 250, 'offlimits': false },
			"_1387": { 'id': "1387", 'name': "House Plant (1387)", 'price': 250, 'offlimits': false },
			"_1388": { 'id': "1388", 'name': "House Plant (1388)", 'price': 250, 'offlimits': false },
			"_1389": { 'id': "1389", 'name': "House Plant (1389)", 'price': 250, 'offlimits': false },
			"_1390": { 'id': "1390", 'name': "House Plant (1390)", 'price': 250, 'offlimits': false },
			"_1391": { 'id': "1391", 'name': "Oak End Table", 'price': 500, 'offlimits': false },
			"_1393": { 'id': "1393", 'name': "Walnut End Table", 'price': 500, 'offlimits': false },
			"_1395": { 'id': "1395", 'name': "Birch End Table", 'price': 500, 'offlimits': false },
			"_1397": { 'id': "1397", 'name': "Mahogany End Table", 'price': 1000, 'offlimits': false },
			"_1399": { 'id': "1399", 'name': "Modern End Table", 'price': 800, 'offlimits': false },
			"_1400": { 'id': "1400", 'name': "Grandmother End Table", 'price': 1000, 'offlimits': false },
			"_1401": { 'id': "1401", 'name': "Winter End Table", 'price': 800, 'offlimits': false },
			"_1402": { 'id': "1402", 'name': "Calendar", 'price': 2000, 'offlimits': true },
			"_1440": { 'id': "1440", 'name': "Tree of the Winter Star", 'price': 5000, 'offlimits': false },
			"_1443": { 'id': "1443", 'name': "Country Lamp", 'price': 500, 'offlimits': false },
			"_1445": { 'id': "1445", 'name': "Box Lamp", 'price': 750, 'offlimits': false },
			"_1447": { 'id': "1447", 'name': "Modern Lamp", 'price': 750, 'offlimits': false },
			"_1449": { 'id': "1449", 'name': "Classic Lamp", 'price': 1000, 'offlimits': false },
			"_1451": { 'id': "1451", 'name': "Red Rug", 'price': 1000, 'offlimits': false },
			"_1456": { 'id': "1456", 'name': "Patchwork Rug", 'price': 800, 'offlimits': false },
			"_1461": { 'id': "1461", 'name': "Dark Rug", 'price': 2000, 'offlimits': false },
			"_1466": { 'id': "1466", 'name': "Budget TV", 'price': 750, 'offlimits': true },
			"_1468": { 'id': "1468", 'name': "Plasma TV", 'price': 4500, 'offlimits': true },
			"_1539": { 'id': "1539", 'name': "'The Muzzamaroo'", 'price': 1000, 'offlimits': false },
			"_1541": { 'id': "1541", 'name': "'A Night On Eco-Hill'", 'price': 1000, 'offlimits': true },
			"_1543": { 'id': "1543", 'name': "'Pathways'", 'price': 750, 'offlimits': false },
			"_1545": { 'id': "1545", 'name': "'Burnt Offering'", 'price': 1000, 'offlimits': true },
			"_1547": { 'id': "1547", 'name': "'Queen of the Gem Sea'", 'price': 1200, 'offlimits': false },
			"_1550": { 'id': "1550", 'name': "'Vanilla Villa'", 'price': 500, 'offlimits': false },
			"_1552": { 'id': "1552", 'name': "'Primal Motion'", 'price': 1500, 'offlimits': false },
			"_1554": { 'id': "1554", 'name': "'Jade Hills'", 'price': 1750, 'offlimits': true },
			"_1557": { 'id': "1557", 'name': "'Sun #44'", 'price': 800, 'offlimits': false },
			"_1559": { 'id': "1559", 'name': "Wallflower Pal", 'price': 500, 'offlimits': false },
			"_1561": { 'id': "1561", 'name': "'Spires'", 'price': 800, 'offlimits': false },
			"_1563": { 'id': "1563", 'name': "'Highway 89'", 'price': 800, 'offlimits': false },
			"_1565": { 'id': "1565", 'name': "Calico Falls", 'price': 750, 'offlimits': false },
			"_1567": { 'id': "1567", 'name': "Needlepoint Flower", 'price': 500, 'offlimits': false },
			"_1600": { 'id': "1600", 'name': "Skull Poster", 'price': 500, 'offlimits': false },
			"_1601": { 'id': "1601", 'name': "'Sun #45'", 'price': 350, 'offlimits': false },
			"_1602": { 'id': "1602", 'name': "'Little Tree'", 'price': 350, 'offlimits': false },
			"_1603": { 'id': "1603", 'name': "'Blueberries'", 'price': 250, 'offlimits': false },
			"_1604": { 'id': "1604", 'name': "'Blue City'", 'price': 250, 'offlimits': false },
			"_1605": { 'id': "1605", 'name': "Little Photos", 'price': 250, 'offlimits': false },
			"_1606": { 'id': "1606", 'name': "'Dancing Grass'", 'price': 400, 'offlimits': false },
			"_1607": { 'id': "1607", 'name': "'VGA Paradise'", 'price': 1200, 'offlimits': false },
			"_1609": { 'id': "1609", 'name': "J. Cola Light", 'price': 1000, 'offlimits': true },
			"_1612": { 'id': "1612", 'name': "'Kitemaster '95'", 'price': 600, 'offlimits': false },
			"_1614": { 'id': "1614", 'name': "Basic Window", 'price': 300, 'offlimits': false },
			"_1616": { 'id': "1616", 'name': "Small Window", 'price': 300, 'offlimits': false },
			"_1618": { 'id': "1618", 'name': "Red Cottage Rug", 'price': 750, 'offlimits': false },
			"_1623": { 'id': "1623", 'name': "Green Cottage Rug", 'price': 750, 'offlimits': false },
			"_1628": { 'id': "1628", 'name': "Monster Rug", 'price': 1250, 'offlimits': false },
			"_1630": { 'id': "1630", 'name': "Boarded Window", 'price': 400, 'offlimits': false },
			"_1664": { 'id': "1664", 'name': "Mystic Rug", 'price': 1250, 'offlimits': false },
			"_1669": { 'id': "1669", 'name': "Lg. Futan Bear", 'price': 4000, 'offlimits': true },
			"_1733": { 'id': "1733", 'name': "Junimo Plush", 'price': 4000, 'offlimits': true },
			"_1671": { 'id': "1671", 'name': "Bear Statue", 'price': 4000, 'offlimits': true },
			"_1673": { 'id': "1673", 'name': "Porthole", 'price': 700, 'offlimits': false },
			"_1675": { 'id': "1675", 'name': "Anchor", 'price': 750, 'offlimits': false },
			"_1676": { 'id': "1676", 'name': "World Map", 'price': 500, 'offlimits': false },
			"_1678": { 'id': "1678", 'name': "Ornate Window", 'price': 900, 'offlimits': false },
			"_1680": { 'id': "1680", 'name': "Floor TV", 'price': 700, 'offlimits': true },
			"_1682": { 'id': "1682", 'name': "Carved Window", 'price': 900, 'offlimits': false },
			"_1737": { 'id': "1737", 'name': "Nautical Rug", 'price': 1250, 'offlimits': false },
			"_1742": { 'id': "1742", 'name': "Burlap Rug", 'price': 350, 'offlimits': false },
			"_1744": { 'id': "1744", 'name': "Tree Column", 'price': 1000, 'offlimits': false },
			"_1745": { 'id': "1745", 'name': "L. Light String", 'price': 400, 'offlimits': false },
			"_1747": { 'id': "1747", 'name': "S. Pine", 'price': 500, 'offlimits': false },
			"_1748": { 'id': "1748", 'name': "Bonsai Tree", 'price': 800, 'offlimits': false },
			"_1749": { 'id': "1749", 'name': "Metal Window", 'price': 800, 'offlimits': false },
			"_1751": { 'id': "1751", 'name': "Candle Lamp", 'price': 1000, 'offlimits': false },
			"_1753": { 'id': "1753", 'name': "Miner's Crest", 'price': 1000, 'offlimits': false },
			"_1755": { 'id': "1755", 'name': "Bamboo Mat", 'price': 250, 'offlimits': false },
			"_1758": { 'id': "1758", 'name': "Ornate Lamp", 'price': 1050, 'offlimits': false },
			"_1777": { 'id': "1777", 'name': "Woodcut Rug", 'price': 800, 'offlimits': false },
			"_1811": { 'id': "1811", 'name': "Hanging Shield", 'price': 500, 'offlimits': false },
			"_1812": { 'id': "1812", 'name': "Monster Danglers", 'price': 1000, 'offlimits': false },
			"_1814": { 'id': "1814", 'name': "Ceiling Flags", 'price': 50, 'offlimits': false },
			"_1838": { 'id': "1838", 'name': "'Red Eagle'", 'price': 1000, 'offlimits': true },
			"_1840": { 'id': "1840", 'name': "'Portrait Of A Mermaid'", 'price': 1000, 'offlimits': true },
			"_1842": { 'id': "1842", 'name': "'Solar Kingdom'", 'price': 1000, 'offlimits': true },
			"_1844": { 'id': "1844", 'name': "'Clouds'", 'price': 1000, 'offlimits': true },
			"_1846": { 'id': "1846", 'name': "'1000 Years From Now'", 'price': 1000, 'offlimits': true },
			"_1848": { 'id': "1848", 'name': "'Three Trees'", 'price': 1000, 'offlimits': true },
			"_1850": { 'id': "1850", 'name': "'The Serpent'", 'price': 1000, 'offlimits': true },
			"_1852": { 'id': "1852", 'name': "'Tropical Fish #173'", 'price': 1000, 'offlimits': true },
			"_1854": { 'id': "1854", 'name': "'Land Of Clay'", 'price': 1000, 'offlimits': true },
			"_1792": { 'id': "1792", 'name': "Brick Fireplace", 'price': 1000, 'offlimits': false },
			"_1794": { 'id': "1794", 'name': "Stone Fireplace", 'price': 1500, 'offlimits': false },
			"_1796": { 'id': "1796", 'name': "Iridium Fireplace", 'price': 15000, 'offlimits': true },
			"_1798": { 'id': "1798", 'name': "Stove Fireplace", 'price': 3000, 'offlimits': true },
			"_1800": { 'id': "1800", 'name': "Monster Fireplace", 'price': 25000, 'offlimits': true },
			"_1802": { 'id': "1802", 'name': "My First Painting", 'price': 500, 'offlimits': true },
			"_1866": { 'id': "1866", 'name': "Elegant Fireplace", 'price': 4000, 'offlimits': false },
			"_1900": { 'id': "1900", 'name': "Pirate Flag", 'price': 4000, 'offlimits': true },
			"_1902": { 'id': "1902", 'name': "Pirate Rug", 'price': 4000, 'offlimits': true },
			"_1964": { 'id': "1964", 'name': "Bone Rug", 'price': 1000, 'offlimits': false },
			"_1971": { 'id': "1971", 'name': "Butterfly Hutch", 'price': 50000, 'offlimits': true },
			"_1907": { 'id': "1907", 'name': "Strawberry Decal", 'price': 2500, 'offlimits': true },
			"_1909": { 'id': "1909", 'name': "Fruit Salad Rug", 'price': 4000, 'offlimits': true },
			"_1914": { 'id': "1914", 'name': "Night Sky Decal #1", 'price': 750, 'offlimits': true },
			"_1978": { 'id': "1978", 'name': "Snowy Rug", 'price': 1000, 'offlimits': false },
			"_1915": { 'id': "1915", 'name': "Night Sky Decal #2", 'price': 750, 'offlimits': true },
			"_1916": { 'id': "1916", 'name': "Night Sky Decal #3", 'price': 750, 'offlimits': true },
			"_1952": { 'id': "1952", 'name': "'The Brave Little Sapling'", 'price': 400, 'offlimits': true },
			"_1953": { 'id': "1953", 'name': "'Mysterium'", 'price': 400, 'offlimits': true },
			"_1954": { 'id': "1954", 'name': "'Journey Of The Prairie King: The Motion Picture'", 'price': 400, 'offlimits': true },
			"_1955": { 'id': "1955", 'name': "'Wumbus'", 'price': 400, 'offlimits': true },
			"_1956": { 'id': "1956", 'name': "'The Zuzu City Express'", 'price': 400, 'offlimits': true },
			"_1957": { 'id': "1957", 'name': "'The Miracle At Coldstar Ranch'", 'price': 400, 'offlimits': true },
			"_1958": { 'id': "1958", 'name': "'Natural Wonders: Exploring Our Vibrant World'", 'price': 400, 'offlimits': true },
			"_1959": { 'id': "1959", 'name': "'It Howls In The Rain'", 'price': 400, 'offlimits': true },
			"_1960": { 'id': "1960", 'name': "Indoor Hanging Basket", 'price': 400, 'offlimits': true },
			"_1961": { 'id': "1961", 'name': "Winter Tree Decal", 'price': 400, 'offlimits': true },
			"_1760": { 'id': "1760", 'name': "Small Junimo Plush", 'price': 1500, 'offlimits': true },
			"_1761": { 'id': "1761", 'name': "Small Junimo Plush", 'price': 1500, 'offlimits': true },
			"_1762": { 'id': "1762", 'name': "Small Junimo Plush", 'price': 1500, 'offlimits': true },
			"_1763": { 'id': "1763", 'name': "Small Junimo Plush", 'price': 1500, 'offlimits': true },
			"_1764": { 'id': "1764", 'name': "Futan Rabbit", 'price': 1500, 'offlimits': true },
			"_1371": { 'id': "1371", 'name': "Wumbus Statue", 'price': 500, 'offlimits': true },
			"_1373": { 'id': "1373", 'name': "Bobo Statue", 'price': 500, 'offlimits': true },
			"_1375": { 'id': "1375", 'name': "Purple Serpent Statue", 'price': 500, 'offlimits': true },
			"_1471": { 'id': "1471", 'name': "Green Serpent Statue", 'price': 500, 'offlimits': true },
			"_985": { 'id': "985", 'name': "Long Palm", 'price': 500, 'offlimits': true },
			"_984": { 'id': "984", 'name': "Long Cactus", 'price': 500, 'offlimits': true },
			"_986": { 'id': "986", 'name': "Exotic Tree", 'price': 500, 'offlimits': true },
			"_989": { 'id': "989", 'name': "Deluxe Tree", 'price': 500, 'offlimits': true },
			"_1917": { 'id': "1917", 'name': "Wall Pumpkin", 'price': 750, 'offlimits': true },
			"_1918": { 'id': "1918", 'name': "Small Wall Pumpkin", 'price': 750, 'offlimits': true },
			"_2048": { 'id': "2048", 'name': "Bed", 'price': 5000, 'offlimits': false },
			"_2052": { 'id': "2052", 'name': "Double Bed", 'price': 5000, 'offlimits': false },
			"_2058": { 'id': "2058", 'name': "Starry Double Bed", 'price': 5000, 'offlimits': true },
			"_2064": { 'id': "2064", 'name': "Strawberry Double Bed", 'price': 5000, 'offlimits': true },
			"_2070": { 'id': "2070", 'name': "Pirate Double Bed", 'price': 5000, 'offlimits': true },
			"_2076": { 'id': "2076", 'name': "Child Bed", 'price': 5000, 'offlimits': false },
			"_2176": { 'id': "2176", 'name': "Tropical Bed", 'price': 5000, 'offlimits': false },
			"_2180": { 'id': "2180", 'name': "Tropical Double Bed", 'price': 5000, 'offlimits': false },
			"_2186": { 'id': "2186", 'name': "Deluxe Red Double Bed", 'price': 6000, 'offlimits': true },
			"_2192": { 'id': "2192", 'name': "Modern Double Bed", 'price': 6000, 'offlimits': true },
			"_2304": { 'id': "2304", 'name': "Large Fish Tank", 'price': 5000, 'offlimits': false },
			"_2312": { 'id': "2312", 'name': "Deluxe Fish Tank", 'price': 10000, 'offlimits': false },
			"_2322": { 'id': "2322", 'name': "Small Fish Tank", 'price': 1000, 'offlimits': false },
			"_1228": { 'id': "1228", 'name': "Oceanic Rug", 'price': 1250, 'offlimits': false },
			"_2326": { 'id': "2326", 'name': "Tropical TV", 'price': 4500, 'offlimits': true },
			"_2329": { 'id': "2329", 'name': "'Volcano' Photo", 'price': 500, 'offlimits': true },
			"_2331": { 'id': "2331", 'name': "Jungle Torch", 'price': 500, 'offlimits': true },
			"_2393": { 'id': "2393", 'name': "Palm Wall Ornament", 'price': 500, 'offlimits': true },
			"_134": { 'id': "134", 'name': "Tropical Chair", 'price': 3000, 'offlimits': true },
			"_2400": { 'id': "2400", 'name': "Aquatic Sanctuary", 'price': 10000, 'offlimits': true },
			"_2414": { 'id': "2414", 'name': "Modern Fish Tank", 'price': 10000, 'offlimits': false },
			"_2496": { 'id': "2496", 'name': "Wild Double Bed", 'price': 6000, 'offlimits': true },
			"_2502": { 'id': "2502", 'name': "Fisher Double Bed", 'price': 6000, 'offlimits': true },
			"_2508": { 'id': "2508", 'name': "Birch Double Bed", 'price': 6000, 'offlimits': true },
			"_2514": { 'id': "2514", 'name': "Exotic Double Bed", 'price': 6000, 'offlimits': true },
			"_2418": { 'id': "2418", 'name': "Lifesaver", 'price': 1000, 'offlimits': true },
			"_2419": { 'id': "2419", 'name': "Foliage Print", 'price': 10000, 'offlimits': true },
			"_2421": { 'id': "2421", 'name': "'Boat'", 'price': 10000, 'offlimits': true },
			"_2423": { 'id': "2423", 'name': "'Vista'", 'price': 10000, 'offlimits': true },
			"_2425": { 'id': "2425", 'name': "Wall Basket", 'price': 10000, 'offlimits': true },
			"_2427": { 'id': "2427", 'name': "Decorative Trash Can", 'price': 500, 'offlimits': false },
			"_2396": { 'id': "2396", 'name': "Iridium Krobus", 'price': 5000, 'offlimits': true },
			"_2332": { 'id': "2332", 'name': "Gourmand Statue", 'price': 500, 'offlimits': true },
			"_2334": { 'id': "2334", 'name': "Pyramid Decal", 'price': 10000, 'offlimits': true },
			"_2397": { 'id': "2397", 'name': "Plain Torch", 'price': 500, 'offlimits': false },
			"_2398": { 'id': "2398", 'name': "Stump Torch", 'price': 500, 'offlimits': false },
			"_1973": { 'id': "1973", 'name': "Wall Flower", 'price': 500, 'offlimits': false },
			"_1974": { 'id': "1974", 'name': "S. Wall Flower", 'price': 500, 'offlimits': false },
			"_1975": { 'id': "1975", 'name': "Clouds Banner", 'price': 500, 'offlimits': false },
			"_1684": { 'id': "1684", 'name': "Colorful Set", 'price': 500, 'offlimits': false },
			"_2624": { 'id': "2624", 'name': "Pastel Banner", 'price': 500, 'offlimits': true },
			"_2625": { 'id': "2625", 'name': "Winter Banner", 'price': 500, 'offlimits': true },
			"_2626": { 'id': "2626", 'name': "Moonlight Jellies Banner", 'price': 500, 'offlimits': true },
			"_2627": { 'id': "2627", 'name': "Jungle Decal", 'price': 500, 'offlimits': false },
			"_2628": { 'id': "2628", 'name': "Jungle Decal", 'price': 500, 'offlimits': false },
			"_2629": { 'id': "2629", 'name': "Jungle Decal", 'price': 500, 'offlimits': false },
			"_2630": { 'id': "2630", 'name': "Jungle Decal", 'price': 500, 'offlimits': false },
			"_2631": { 'id': "2631", 'name': "Starport Decal", 'price': 500, 'offlimits': false },
			"_2632": { 'id': "2632", 'name': "Decorative Pitchfork", 'price': 500, 'offlimits': false },
			"_2633": { 'id': "2633", 'name': "Wood Panel", 'price': 500, 'offlimits': false },
			"_2634": { 'id': "2634", 'name': "Decorative Axe", 'price': 500, 'offlimits': false },
			"_2635": { 'id': "2635", 'name': "Log Panel", 'price': 500, 'offlimits': false },
			"_2636": { 'id': "2636", 'name': "Log Panel", 'price': 500, 'offlimits': false },
			"_1817": { 'id': "1817", 'name': "Ceiling Leaves", 'price': 50, 'offlimits': false },
			"_1818": { 'id': "1818", 'name': "Ceiling Leaves", 'price': 50, 'offlimits': false },
			"_1819": { 'id': "1819", 'name': "Ceiling Leaves", 'price': 50, 'offlimits': false },
			"_1820": { 'id': "1820", 'name': "Ceiling Leaves", 'price': 50, 'offlimits': false },
			"_1821": { 'id': "1821", 'name': "Ceiling Leaves", 'price': 50, 'offlimits': false },
			"_1687": { 'id': "1687", 'name': "Cloud Decal", 'price': 500, 'offlimits': true },
			"_1692": { 'id': "1692", 'name': "Cloud Decal", 'price': 500, 'offlimits': true },
			"_2637": { 'id': "2637", 'name': "Floor Divider R", 'price': 50, 'offlimits': false },
			"_2638": { 'id': "2638", 'name': "Floor Divider L", 'price': 50, 'offlimits': false },
			"_2639": { 'id': "2639", 'name': "Floor Divider R", 'price': 50, 'offlimits': false },
			"_2640": { 'id': "2640", 'name': "Floor Divider L", 'price': 50, 'offlimits': false },
			"_2641": { 'id': "2641", 'name': "Floor Divider R", 'price': 50, 'offlimits': false },
			"_2642": { 'id': "2642", 'name': "Floor Divider L", 'price': 50, 'offlimits': false },
			"_2643": { 'id': "2643", 'name': "Floor Divider R", 'price': 50, 'offlimits': false },
			"_2644": { 'id': "2644", 'name': "Floor Divider L", 'price': 50, 'offlimits': false },
			"_2645": { 'id': "2645", 'name': "Floor Divider R", 'price': 50, 'offlimits': false },
			"_2646": { 'id': "2646", 'name': "Floor Divider L", 'price': 50, 'offlimits': false },
			"_2647": { 'id': "2647", 'name': "Floor Divider R", 'price': 50, 'offlimits': false },
			"_2648": { 'id': "2648", 'name': "Floor Divider L", 'price': 50, 'offlimits': false },
			"_2649": { 'id': "2649", 'name': "Floor Divider R", 'price': 50, 'offlimits': false },
			"_2650": { 'id': "2650", 'name': "Floor Divider L", 'price': 50, 'offlimits': false },
			"_2651": { 'id': "2651", 'name': "Floor Divider R", 'price': 50, 'offlimits': false },
			"_2652": { 'id': "2652", 'name': "Floor Divider L", 'price': 50, 'offlimits': false },
			"_2488": { 'id': "2488", 'name': "Light Green Rug", 'price': 10000, 'offlimits': false },
			"_2584": { 'id': "2584", 'name': "'Jade Hills Extended'", 'price': 6750, 'offlimits': false },
			"_2720": { 'id': "2720", 'name': "Large Brown Couch", 'price': 5750, 'offlimits': false },
			"_2784": { 'id': "2784", 'name': "Large Green Rug", 'price': 10000, 'offlimits': false },
			"_2790": { 'id': "2790", 'name': "Icy Rug", 'price': 10000, 'offlimits': false },
			"_2794": { 'id': "2794", 'name': "Old World Rug", 'price': 10000, 'offlimits': false },
			"_2798": { 'id': "2798", 'name': "Large Red Rug", 'price': 10000, 'offlimits': false },
			"_2730": { 'id': "2730", 'name': "'Frozen Dreams'", 'price': 6750, 'offlimits': false },
			"_2653": { 'id': "2653", 'name': "Icy Banner", 'price': 500, 'offlimits': true },
			"_2654": { 'id': "2654", 'name': "Wall Palm", 'price': 500, 'offlimits': false },
			"_2655": { 'id': "2655", 'name': "Wall Cactus", 'price': 500, 'offlimits': false },
			"_2802": { 'id': "2802", 'name': "Large Cottage Rug", 'price': 10000, 'offlimits': false },
			"_2732": { 'id': "2732", 'name': "'Physics 101'", 'price': 6750, 'offlimits': true },
			"_2734": { 'id': "2734", 'name': "Wall Sconce", 'price': 500, 'offlimits': false },
			"_2736": { 'id': "2736", 'name': "Wall Sconce", 'price': 500, 'offlimits': false },
			"_2738": { 'id': "2738", 'name': "Wall Sconce", 'price': 1000, 'offlimits': false },
			"_2740": { 'id': "2740", 'name': "Wall Sconce", 'price': 500, 'offlimits': false },
			"_2748": { 'id': "2748", 'name': "Wall Sconce", 'price': 500, 'offlimits': false },
			"_2812": { 'id': "2812", 'name': "Wall Sconce", 'price': 500, 'offlimits': false },
			"_2750": { 'id': "2750", 'name': "Wall Sconce", 'price': 500, 'offlimits': false },
			"_2742": { 'id': "2742", 'name': "Blossom Rug", 'price': 10000, 'offlimits': false },
			"_2870": { 'id': "2870", 'name': "Funky Rug", 'price': 10000, 'offlimits': false },
			"_2875": { 'id': "2875", 'name': "Modern Rug", 'price': 10000, 'offlimits': false },
			"_2814": { 'id': "2814", 'name': "Squirrel Figurine", 'price': 500, 'offlimits': true },
			"_FreeCactus": { 'id': "FreeCactus", 'name': "Cactus", 'price': 350, 'offlimits': true },
			"_HangingFish": { 'id': "HangingFish", 'name': "Hanging Fish", 'price': 500, 'offlimits': true },
			"_RetroTV": { 'id': "RetroTV", 'name': "Retro TV", 'price': 5000, 'offlimits': true },
			"_ArtPhoto": { 'id': "ArtPhoto", 'name': "Art Photo", 'price': 500, 'offlimits': true },
			"_ArtPhoto2": { 'id': "ArtPhoto2", 'name': "Art Photo 2", 'price': 500, 'offlimits': true },
			"_ShortBookcase": { 'id': "ShortBookcase", 'name': "Short Bookcase", 'price': 1000, 'offlimits': true },
			"_PierresSign": { 'id': "PierresSign", 'name': "Pierre's Sign", 'price': 500, 'offlimits': true },
			"_SamsSkateboard": { 'id': "SamsSkateboard", 'name': "Sam's Skateboard", 'price': 500, 'offlimits': true },
			"_ChickenDecal": { 'id': "ChickenDecal", 'name': "Chicken Decal", 'price': 500, 'offlimits': true },
			"_ExoticPalace": { 'id': "ExoticPalace", 'name': "Exotic Palace", 'price': 5000, 'offlimits': true },
			"_PeriodicTable": { 'id': "PeriodicTable", 'name': "Periodic Table", 'price': 500, 'offlimits': true },
			"_DustySkull": { 'id': "DustySkull", 'name': "Dusty Skull", 'price': 500, 'offlimits': true },
			"_RadioDesk": { 'id': "RadioDesk", 'name': "Radio Desk", 'price': 500, 'offlimits': true },
			"_ModelPlanes": { 'id': "ModelPlanes", 'name': "Model Planes", 'price': 500, 'offlimits': true },
			"_CatStatue": { 'id': "CatStatue", 'name': "Calico Statue", 'price': 500, 'offlimits': true },
			"_SunDunes": { 'id': "SunDunes", 'name': "Sun Dunes", 'price': 500, 'offlimits': true },
			"_DesertTable": { 'id': "DesertTable", 'name': "Desert Table", 'price': 500, 'offlimits': true },
			"_DesertChair": { 'id': "DesertChair", 'name': "Desert Chair", 'price': 500, 'offlimits': true },
			"_DesertFireplace": { 'id': "DesertFireplace", 'name': "Desert Fireplace", 'price': 500, 'offlimits': true },
			"_SandyRug": { 'id': "SandyRug", 'name': "Sandy Rug", 'price': 500, 'offlimits': true },
			"_DesertRug": { 'id': "DesertRug", 'name': "Desert Rug", 'price': 500, 'offlimits': true },
			"_DesertEndTable": { 'id': "DesertEndTable", 'name': "Desert End Table", 'price': 500, 'offlimits': true },
			"_DesertFlags": { 'id': "DesertFlags", 'name': "Desert Flags", 'price': 500, 'offlimits': true },
			"_DecorativeBarrel": { 'id': "DecorativeBarrel", 'name': "Decorative Barrel", 'price': 500, 'offlimits': false },
			"_MountedTrout_Painting": { 'id': "MountedTrout_Painting", 'name': "Mounted Trout", 'price': 500, 'offlimits': true },
			"_SquidKid_Painting": { 'id': "SquidKid_Painting", 'name': "'Squid Kid'", 'price': 500, 'offlimits': true },
			"_CowDecal": { 'id': "CowDecal", 'name': "Cow Decal", 'price': 500, 'offlimits': true },
			"_BluePinstripeBed": { 'id': "BluePinstripeBed", 'name': "Blue Pinstripe Bed", 'price': 500, 'offlimits': true },
			"_JungleTank": { 'id': "JungleTank", 'name': "Jungle Tank", 'price': 5000, 'offlimits': true },
			"_CCFishTank": { 'id': "CCFishTank", 'name': "CCFishTank", 'price': 5000, 'offlimits': true },
			"_BluePinstripeDoubleBed": { 'id': "BluePinstripeDoubleBed", 'name': "Blue Pinstripe Double Bed", 'price': 500, 'offlimits': true },
			"_JojaBed": { 'id': "JojaBed", 'name': "Joja Bed", 'price': 999, 'offlimits': true },
			"_JojaVault": { 'id': "JojaVault", 'name': "Joja Vault", 'price': 999, 'offlimits': true },
			"_JojaChair": { 'id': "JojaChair", 'name': "Joja Chair", 'price': 999, 'offlimits': true },
			"_J": { 'id': "J", 'name': "J", 'price': 999, 'offlimits': true },
			"_JojaColaTeaTable": { 'id': "JojaColaTeaTable", 'name': "Joja Cola Tea Table", 'price': 999, 'offlimits': true },
			"_JojaTable": { 'id': "JojaTable", 'name': "Joja Table", 'price': 999, 'offlimits': true },
			"_JPainting": { 'id': "JPainting", 'name': "J. Painting", 'price': 999, 'offlimits': true },
			"_JLight": { 'id': "JLight", 'name': "J. Light", 'price': 999, 'offlimits': true },
			"_JojaCatalogue": { 'id': "JojaCatalogue", 'name': "Joja Furniture Catalogue", 'price': 25000, 'offlimits': true },
			"_JojaColaPainting": { 'id': "JojaColaPainting", 'name': "Joja Cola Painting", 'price': 999, 'offlimits': true },
			"_JojaColaOrnament": { 'id': "JojaColaOrnament", 'name': "Joja Cola Ornament", 'price': 999, 'offlimits': true },
			"_JojaFireplace": { 'id': "JojaFireplace", 'name': "Joja Fireplace", 'price': 999, 'offlimits': true },
			"_JojaColaCans": { 'id': "JojaColaCans", 'name': "Joja Cola Cans", 'price': 999, 'offlimits': true },
			"_CashRegister": { 'id': "CashRegister", 'name': "Cash Register", 'price': 999, 'offlimits': true },
			"_PlasticPlant": { 'id': "PlasticPlant", 'name': "Plastic Plant", 'price': 999, 'offlimits': true },
			"_PlasticSapling": { 'id': "PlasticSapling", 'name': "Plastic Sapling", 'price': 999, 'offlimits': true },
			"_GrayJojaCushion": { 'id': "GrayJojaCushion", 'name': "Gray Joja Cushion", 'price': 999, 'offlimits': true },
			"_JojaCushion": { 'id': "JojaCushion", 'name': "Joja Cushion", 'price': 999, 'offlimits': true },
			"_StackedJojaCrates": { 'id': "StackedJojaCrates", 'name': "Stacked Joja Boxes", 'price': 999, 'offlimits': true },
			"_JojaCouch": { 'id': "JojaCouch", 'name': "Joja Couch", 'price': 999, 'offlimits': true },
			"_MorrisPortrait": { 'id': "MorrisPortrait", 'name': "Manager of the Year", 'price': 999, 'offlimits': true },
			"_JojaHQPainting": { 'id': "JojaHQPainting", 'name': "Joja HQ Painting", 'price': 999, 'offlimits': true },
			"_JojaCrate": { 'id': "JojaCrate", 'name': "Joja Crate", 'price': 999, 'offlimits': true },
			"_JojaShoppingCart": { 'id': "JojaShoppingCart", 'name': "Joja Shopping Cart", 'price': 999, 'offlimits': true },
			"_LargeJojaCrate": { 'id': "LargeJojaCrate", 'name': "Large Joja Crate", 'price': 999, 'offlimits': true },
			"_JojaColaFridge": { 'id': "JojaColaFridge", 'name': "Joja Cola Fridge", 'price': 999, 'offlimits': true },
			"_JojaDresser": { 'id': "JojaDresser", 'name': "Joja Dresser", 'price': 999, 'offlimits': true },
			"_GrayJojaDresser": { 'id': "GrayJojaDresser", 'name': "Gray Joja Dresser", 'price': 999, 'offlimits': true },
			"_LargeJojaRug": { 'id': "LargeJojaRug", 'name': "Large Joja Rug", 'price': 999, 'offlimits': true },
			"_SmallJojaRug": { 'id': "SmallJojaRug", 'name': "Small Joja Rug", 'price': 999, 'offlimits': true },
			"_SquareJojaRug": { 'id': "SquareJojaRug", 'name': "Square Joja Rug", 'price': 999, 'offlimits': true },
			"_JojaRug": { 'id': "JojaRug", 'name': "Joja Rug", 'price': 999, 'offlimits': true },
			"_JojaCoffeeTable": { 'id': "JojaCoffeeTable", 'name': "Joja Coffee Table", 'price': 999, 'offlimits': true },
			"_GrayJojaCoffeeTable": { 'id': "GrayJojaCoffeeTable", 'name': "Gray Joja Coffee Table", 'price': 999, 'offlimits': true },
			"_JojaLamp": { 'id': "JojaLamp", 'name': "Joja Lamp", 'price': 999, 'offlimits': true },
			"_GrayJojaBookcase": { 'id': "GrayJojaBookcase", 'name': "Gray Joja Bookcase", 'price': 999, 'offlimits': true },
			"_JojaBookcase": { 'id': "JojaBookcase", 'name': "Joja Bookcase", 'price': 999, 'offlimits': true },
			"_JojaStool": { 'id': "JojaStool", 'name': "Joja Stool", 'price': 999, 'offlimits': true },
			"_JojaEndTable": { 'id': "JojaEndTable", 'name': "Joja End Table", 'price': 999, 'offlimits': true },
			"_GrayJojaEndTable": { 'id': "GrayJojaEndTable", 'name': "Gray Joja End Table", 'price': 999, 'offlimits': true },
			"_DecorativeJojaDoor": { 'id': "DecorativeJojaDoor", 'name': "Decorative Joja Door", 'price': 999, 'offlimits': true },
			"_WizardBed": { 'id': "WizardBed", 'name': "Wizard Bed", 'price': 999, 'offlimits': true },
			"_LargeWizardBookcase": { 'id': "LargeWizardBookcase", 'name': "Large Wizard Bookcase", 'price': 999, 'offlimits': true },
			"_WizardBookcase": { 'id': "WizardBookcase", 'name': "Wizard Bookcase", 'price': 999, 'offlimits': true },
			"_ShortWizardBookcase": { 'id': "ShortWizardBookcase", 'name': "Short Wizard Bookcase", 'price': 999, 'offlimits': true },
			"_SmallWizardBookcase": { 'id': "SmallWizardBookcase", 'name': "Small Wizard Bookcase", 'price': 999, 'offlimits': true },
			"_WizardStool": { 'id': "WizardStool", 'name': "Wizard Stool", 'price': 999, 'offlimits': true },
			"_WizardFireplace": { 'id': "WizardFireplace", 'name': "Wizard Fireplace", 'price': 999, 'offlimits': true },
			"_WizardDresser": { 'id': "WizardDresser", 'name': "Wizard Dresser", 'price': 999, 'offlimits': true },
			"_WizardStudy": { 'id': "WizardStudy", 'name': "Wizard Study", 'price': 999, 'offlimits': true },
			"_WizardEndTable": { 'id': "WizardEndTable", 'name': "Wizard End Table", 'price': 999, 'offlimits': true },
			"_WitchBroom": { 'id': "WitchBroom", 'name': "Witch's Broom", 'price': 999, 'offlimits': true },
			"_Cauldron": { 'id': "Cauldron", 'name': "Cauldron", 'price': 999, 'offlimits': true },
			"_CurlyTree": { 'id': "CurlyTree", 'name': "Curly Tree", 'price': 999, 'offlimits': true },
			"_LeafyPlant": { 'id': "LeafyPlant", 'name': "Swamp Plant", 'price': 999, 'offlimits': true },
			"_WizardChair": { 'id': "WizardChair", 'name': "Wizard Chair", 'price': 999, 'offlimits': true },
			"_WizardTable": { 'id': "WizardTable", 'name': "Wizard Table", 'price': 999, 'offlimits': true },
			"_WizardCushion": { 'id': "WizardCushion", 'name': "Wizard Cushion", 'price': 999, 'offlimits': true },
			"_DarkWizardCushion": { 'id': "DarkWizardCushion", 'name': "Dark Wizard Cushion", 'price': 999, 'offlimits': true },
			"_WizardTeaTable": { 'id': "WizardTeaTable", 'name': "Wizard Tea Table", 'price': 999, 'offlimits': true },
			"_SmallElixirShelf": { 'id': "SmallElixirShelf", 'name': "Small Elixir Shelf", 'price': 999, 'offlimits': true },
			"_ElixirShelf": { 'id': "ElixirShelf", 'name': "Elixir Shelf", 'price': 999, 'offlimits': true },
			"_SmallStackedElixirShelf": { 'id': "SmallStackedElixirShelf", 'name': "Small Stacked Elixir Shelf", 'price': 999, 'offlimits': true },
			"_StackedElixirShelf": { 'id': "StackedElixirShelf", 'name': "Stacked Elixir Shelf", 'price': 999, 'offlimits': true },
			"_ElixirBundle": { 'id': "ElixirBundle", 'name': "Elixir Bundle", 'price': 999, 'offlimits': true },
			"_CoupleElixirs": { 'id': "CoupleElixirs", 'name': "Two Elixirs", 'price': 999, 'offlimits': true },
			"_ElixirTable": { 'id': "ElixirTable", 'name': "Elixir Table", 'price': 999, 'offlimits': true },
			"_LongElixirTable": { 'id': "LongElixirTable", 'name': "Long Elixir Table", 'price': 999, 'offlimits': true },
			"_WizardLamp": { 'id': "WizardLamp", 'name': "Wizard Lamp", 'price': 999, 'offlimits': true },
			"_Runes": { 'id': "Runes", 'name': "'Runes'", 'price': 999, 'offlimits': true },
			"_WizardTower": { 'id': "WizardTower", 'name': "'Wizard's Tower'", 'price': 999, 'offlimits': true },
			"_PottedRedMushroom": { 'id': "PottedRedMushroom", 'name': "Potted Red Mushroom", 'price': 999, 'offlimits': true },
			"_WizardCatalogue": { 'id': "WizardCatalogue", 'name': "Wizard Catalogue", 'price': 999, 'offlimits': true },
			"_VoidSwirls": { 'id': "VoidSwirls", 'name': "'Void Swirls'", 'price': 999, 'offlimits': true },
			"_WizardBookshelf": { 'id': "WizardBookshelf", 'name': "Wizard Bookshelf", 'price': 999, 'offlimits': true },
			"_Glyph": { 'id': "Glyph", 'name': "Glyph", 'price': 999, 'offlimits': true },
			"_StoneFlooring": { 'id': "StoneFlooring", 'name': "Stone Flooring", 'price': 999, 'offlimits': true },
			"_RuneRug": { 'id': "RuneRug", 'name': "Rune Rug", 'price': 999, 'offlimits': true },
			"_SwirlRug": { 'id': "SwirlRug", 'name': "Swirl Rug", 'price': 999, 'offlimits': true },
			"_StarryMoonRug": { 'id': "StarryMoonRug", 'name': "Starry Moon Rug", 'price': 999, 'offlimits': true },
			"_CrystalBall": { 'id': "CrystalBall", 'name': "Crystal Ball", 'price': 999, 'offlimits': true },
			"_AmethystCrystalBall": { 'id': "AmethystCrystalBall", 'name': "Amethyst Crystal Ball", 'price': 999, 'offlimits': true },
			"_TopazCrystalBall": { 'id': "TopazCrystalBall", 'name': "Topaz Crystal Ball", 'price': 999, 'offlimits': true },
			"_AquamarineCrystalBall": { 'id': "AquamarineCrystalBall", 'name': "Aquamarine Crystal Ball", 'price': 999, 'offlimits': true },
			"_EmeraldCrystalBall": { 'id': "EmeraldCrystalBall", 'name': "Emerald Crystal Ball", 'price': 999, 'offlimits': true },
			"_RubyCrystalBall": { 'id': "RubyCrystalBall", 'name': "Ruby Crystal Ball", 'price': 999, 'offlimits': true },
			"_SmallBookStack": { 'id': "SmallBookStack", 'name': "Small Book Stack", 'price': 999, 'offlimits': true },
			"_BookStack": { 'id': "BookStack", 'name': "Book Stack", 'price': 999, 'offlimits': true },
			"_LargeBookStack": { 'id': "LargeBookStack", 'name': "Large Book Stack", 'price': 999, 'offlimits': true },
			"_PurpleBook": { 'id': "PurpleBook", 'name': "Purple Book", 'price': 999, 'offlimits': true },
			"_BlueBook": { 'id': "BlueBook", 'name': "Blue Book", 'price': 999, 'offlimits': true },
			"_YellowBook": { 'id': "YellowBook", 'name': "Yellow Book", 'price': 999, 'offlimits': true },
			"_RedBook": { 'id': "RedBook", 'name': "Red Book", 'price': 999, 'offlimits': true },
			"_GreenBook": { 'id': "GreenBook", 'name': "Green Book", 'price': 999, 'offlimits': true },
			"_BrownBook": { 'id': "BrownBook", 'name': "Brown Book", 'price': 999, 'offlimits': true },
			"_FallenPurpleBook": { 'id': "FallenPurpleBook", 'name': "Fallen Purple Book", 'price': 999, 'offlimits': true },
			"_FallenBlueBook": { 'id': "FallenBlueBook", 'name': "Fallen Blue Book", 'price': 999, 'offlimits': true },
			"_FallenYellowBook": { 'id': "FallenYellowBook", 'name': "Fallen Yellow Book", 'price': 999, 'offlimits': true },
			"_FallenRedBook": { 'id': "FallenRedBook", 'name': "Fallen Red Book", 'price': 999, 'offlimits': true },
			"_FallenGreenBook": { 'id': "FallenGreenBook", 'name': "Fallen Green Book", 'price': 999, 'offlimits': true },
			"_FallenBrownBook": { 'id': "FallenBrownBook", 'name': "Fallen Brown Book", 'price': 999, 'offlimits': true },
			"_SmallBookPile": { 'id': "SmallBookPile", 'name': "Small Book Pile", 'price': 999, 'offlimits': true },
			"_BookPile": { 'id': "BookPile", 'name': "Book Pile", 'price': 999, 'offlimits': true },
			"_LargeBookPile": { 'id': "LargeBookPile", 'name': "Large Book Pile", 'price': 999, 'offlimits': true },
			"_DecorativeWizardDoor": { 'id': "DecorativeWizardDoor", 'name': "Decorative Wizard Door", 'price': 999, 'offlimits': true },
			"_JunimoBed": { 'id': "JunimoBed", 'name': "Junimo Bed", 'price': 999, 'offlimits': true },
			"_JunimoHut": { 'id': "JunimoHut", 'name': "Junimo Hut", 'price': 999, 'offlimits': true },
			"_LargeJunimoHut": { 'id': "LargeJunimoHut", 'name': "Large Junimo Hut", 'price': 999, 'offlimits': true },
			"_SmallJunimoHut": { 'id': "SmallJunimoHut", 'name': "Small Junimo Hut", 'price': 999, 'offlimits': true },
			"_JunimoFireplace": { 'id': "JunimoFireplace", 'name': "Junimo Fireplace", 'price': 999, 'offlimits': true },
			"_JunimoBookcase": { 'id': "JunimoBookcase", 'name': "Junimo Bookcase", 'price': 999, 'offlimits': true },
			"_JunimoPot": { 'id': "JunimoPot", 'name': "Junimo Pot", 'price': 999, 'offlimits': true },
			"_JunimoBag": { 'id': "JunimoBag", 'name': "Junimo Bag", 'price': 999, 'offlimits': true },
			"_JunimoBundle": { 'id': "JunimoBundle", 'name': "Junimo Bundle", 'price': 999, 'offlimits': true },
			"_JunimoStool": { 'id': "JunimoStool", 'name': "Junimo Stool", 'price': 999, 'offlimits': true },
			"_JunimoTable": { 'id': "JunimoTable", 'name': "Junimo Table", 'price': 999, 'offlimits': true },
			"_JunimoChair": { 'id': "JunimoChair", 'name': "Junimo Chair", 'price': 999, 'offlimits': true },
			"_SmallJunimoPot": { 'id': "SmallJunimoPot", 'name': "Small Junimo Pot", 'price': 999, 'offlimits': true },
			"_JunimoFlower": { 'id': "JunimoFlower", 'name': "Junimo Flower", 'price': 999, 'offlimits': true },
			"_JunimoEndTable": { 'id': "JunimoEndTable", 'name': "Junimo End Table", 'price': 999, 'offlimits': true },
			"_JunimoCatalogue": { 'id': "JunimoCatalogue", 'name': "Junimo Catalogue", 'price': 999, 'offlimits': true },
			"_JunimoTeaTable": { 'id': "JunimoTeaTable", 'name': "Junimo Tea Table", 'price': 999, 'offlimits': true },
			"_JunimoDresser": { 'id': "JunimoDresser", 'name': "Junimo Dresser", 'price': 999, 'offlimits': true },
			"_JunimoLamp": { 'id': "JunimoLamp", 'name': "Junimo Lamp", 'price': 999, 'offlimits': true },
			"_JunimoPlant": { 'id': "JunimoPlant", 'name': "Junimo Plant", 'price': 999, 'offlimits': true },
			"_JunimoWallPlaque": { 'id': "JunimoWallPlaque", 'name': "Junimo Wall Plaque", 'price': 999, 'offlimits': true },
			"_JunimoPlaque": { 'id': "JunimoPlaque", 'name': "Junimo Plaque", 'price': 999, 'offlimits': true },
			"_JunimoCushion": { 'id': "JunimoCushion", 'name': "Junimo Cushion", 'price': 999, 'offlimits': true },
			"_DarkJunimoCushion": { 'id': "DarkJunimoCushion", 'name': "Dark Junimo Cushion", 'price': 999, 'offlimits': true },
			"_JunimoTree": { 'id': "JunimoTree", 'name': "Junimo Tree", 'price': 999, 'offlimits': true },
			"_JunimoCouch": { 'id': "JunimoCouch", 'name': "Junimo Couch", 'price': 999, 'offlimits': true },
			"_GreenSleepingJunimo": { 'id': "GreenSleepingJunimo", 'name': "Green Sleeping Junimo", 'price': 999, 'offlimits': true },
			"_BlueSleepingJunimo": { 'id': "BlueSleepingJunimo", 'name': "Blue Sleeping Junimo", 'price': 999, 'offlimits': true },
			"_RedSleepingJunimo": { 'id': "RedSleepingJunimo", 'name': "Red Sleeping Junimo", 'price': 999, 'offlimits': true },
			"_PurpleSleepingJunimo": { 'id': "PurpleSleepingJunimo", 'name': "Purple Sleeping Junimo", 'price': 999, 'offlimits': true },
			"_YellowSleepingJunimo": { 'id': "YellowSleepingJunimo", 'name': "Yellow Sleeping Junimo", 'price': 999, 'offlimits': true },
			"_OrangeSleepingJunimo": { 'id': "OrangeSleepingJunimo", 'name': "Orange Sleeping Junimo", 'price': 999, 'offlimits': true },
			"_GraySleepingJunimo": { 'id': "GraySleepingJunimo", 'name': "Gray Sleeping Junimo", 'price': 999, 'offlimits': true },
			"_SquareJunimoRug": { 'id': "SquareJunimoRug", 'name': "Square Junimo Rug", 'price': 999, 'offlimits': true },
			"_JunimoRug": { 'id': "JunimoRug", 'name': "Junimo Rug", 'price': 999, 'offlimits': true },
			"_JunimoMat": { 'id': "JunimoMat", 'name': "Junimo Mat", 'price': 999, 'offlimits': true },
			"_CircularJunimoRug": { 'id': "CircularJunimoRug", 'name': "Circular Junimo Rug", 'price': 999, 'offlimits': true },
			"_SmallJunimoMat": { 'id': "SmallJunimoMat", 'name': "Small Junimo Mat", 'price': 999, 'offlimits': true },
			"_CommunityCenter": { 'id': "CommunityCenter", 'name': "'Community Center'", 'price': 999, 'offlimits': true },
			"_LittleBuddies": { 'id': "LittleBuddies", 'name': "'Little Buddies'", 'price': 999, 'offlimits': true },
			"_Stardrop": { 'id': "Stardrop", 'name': "'Stardrop'", 'price': 999, 'offlimits': true },
			"_Hut": { 'id': "Hut", 'name': "'Hut'", 'price': 999, 'offlimits': true },
			"_AbigailPortrait": { 'id': "AbigailPortrait", 'name': "Abigail Portrait", 'price': 999, 'offlimits': true },
			"_EmilyPortrait": { 'id': "EmilyPortrait", 'name': "Emily Portrait", 'price': 999, 'offlimits': true },
			"_HaleyPortrait": { 'id': "HaleyPortrait", 'name': "Haley Portrait", 'price': 999, 'offlimits': true },
			"_LeahPortrait": { 'id': "LeahPortrait", 'name': "Leah Portrait", 'price': 999, 'offlimits': true },
			"_MaruPortrait": { 'id': "MaruPortrait", 'name': "Maru Portrait", 'price': 999, 'offlimits': true },
			"_PennyPortrait": { 'id': "PennyPortrait", 'name': "Penny Portrait", 'price': 999, 'offlimits': true },
			"_AlexPortrait": { 'id': "AlexPortrait", 'name': "Alex Portrait", 'price': 999, 'offlimits': true },
			"_ElliottPortrait": { 'id': "ElliottPortrait", 'name': "Elliott Portrait", 'price': 999, 'offlimits': true },
			"_HarveyPortrait": { 'id': "HarveyPortrait", 'name': "Harvey Portrait", 'price': 999, 'offlimits': true },
			"_SamPortrait": { 'id': "SamPortrait", 'name': "Sam Portrait", 'price': 999, 'offlimits': true },
			"_SebastianPortrait": { 'id': "SebastianPortrait", 'name': "Sebastian Portrait", 'price': 999, 'offlimits': true },
			"_ShanePortrait": { 'id': "ShanePortrait", 'name': "Shane Portrait", 'price': 999, 'offlimits': true },
			"_KrobusPortrait": { 'id': "KrobusPortrait", 'name': "Krobus Portrait", 'price': 999, 'offlimits': true },
			"_JunimoStar": { 'id': "JunimoStar", 'name': "Junimo Star", 'price': 999, 'offlimits': true },
			"_BulletinBoard": { 'id': "BulletinBoard", 'name': "Bulletin Board", 'price': 999, 'offlimits': true },
			"_BrochureCabinet": { 'id': "BrochureCabinet", 'name': "Brochure Cabinet", 'price': 999, 'offlimits': true },
			"_LeafyWallPanel": { 'id': "LeafyWallPanel", 'name': "Leafy Wall Panel", 'price': 999, 'offlimits': true },
			"_LightLeafyWallPanel": { 'id': "LightLeafyWallPanel", 'name': "Light Leafy Wall Panel", 'price': 999, 'offlimits': true },
			"_DarkLeafyWallPanel": { 'id': "DarkLeafyWallPanel", 'name': "Dark Leafy Wall Panel", 'price': 999, 'offlimits': true },
			"_DecorativeJunimoDoor": { 'id': "DecorativeJunimoDoor", 'name': "Decorative Junimo Door", 'price': 999, 'offlimits': true },
			"_RetroBed": { 'id': "RetroBed", 'name': "Retro Bed", 'price': 999, 'offlimits': true },
			"_RetroDresser": { 'id': "RetroDresser", 'name': "Retro Dresser", 'price': 999, 'offlimits': true },
			"_RetroBookcase": { 'id': "RetroBookcase", 'name': "Retro Bookcase", 'price': 999, 'offlimits': true },
			"_RetroFireplace": { 'id': "RetroFireplace", 'name': "Retro Fireplace", 'price': 999, 'offlimits': true },
			"_RetroCouch": { 'id': "RetroCouch", 'name': "Retro Couch", 'price': 999, 'offlimits': true },
			"_RetroCushion": { 'id': "RetroCushion", 'name': "Retro Cushion", 'price': 999, 'offlimits': true },
			"_DarkRetroCushion": { 'id': "DarkRetroCushion", 'name': "Dark Retro Cushion", 'price': 999, 'offlimits': true },
			"_RetroStool": { 'id': "RetroStool", 'name': "Retro Stool", 'price': 999, 'offlimits': true },
			"_RetroFlower": { 'id': "RetroFlower", 'name': "Retro Flower", 'price': 999, 'offlimits': true },
			"_RetroChair": { 'id': "RetroChair", 'name': "Retro Chair", 'price': 999, 'offlimits': true },
			"_RetroTable": { 'id': "RetroTable", 'name': "Retro Table", 'price': 999, 'offlimits': true },
			"_RetroPlant": { 'id': "RetroPlant", 'name': "Retro Plant", 'price': 999, 'offlimits': true },
			"_RetroEndTable": { 'id': "RetroEndTable", 'name': "Retro End Table", 'price': 999, 'offlimits': true },
			"_RetroTeaTable": { 'id': "RetroTeaTable", 'name': "Retro Tea Table", 'price': 999, 'offlimits': true },
			"_RetroCatalogue": { 'id': "RetroCatalogue", 'name': "Retro Catalogue", 'price': 999, 'offlimits': true },
			"_RetroCabinet": { 'id': "RetroCabinet", 'name': "Retro Cabinet", 'price': 999, 'offlimits': true },
			"_RetroRadio": { 'id': "RetroRadio", 'name': "Retro Radio", 'price': 999, 'offlimits': true },
			"_RetroBanner": { 'id': "RetroBanner", 'name': "Retro Banner", 'price': 999, 'offlimits': true },
			"_Groovy": { 'id': "Groovy", 'name': "'Groovy'", 'price': 999, 'offlimits': true },
			"_RetroLamp": { 'id': "RetroLamp", 'name': "Retro Lamp", 'price': 999, 'offlimits': true },
			"_RetroRug": { 'id': "RetroRug", 'name': "Retro Rug", 'price': 999, 'offlimits': true },
			"_RetroSquareRug": { 'id': "RetroSquareRug", 'name': "Retro Square Rug", 'price': 999, 'offlimits': true },
			"_RetroMat": { 'id': "RetroMat", 'name': "Retro Mat", 'price': 999, 'offlimits': true },
			"_LargeRetroRug": { 'id': "LargeRetroRug", 'name': "Large Retro Rug", 'price': 999, 'offlimits': true },
			"_Abstract": { 'id': "Abstract", 'name': "'Abstract'", 'price': 999, 'offlimits': true },
			"_Starship": { 'id': "Starship", 'name': "'Starship'", 'price': 999, 'offlimits': true },
			"_Binary": { 'id': "Binary", 'name': "'Binary'", 'price': 999, 'offlimits': true },
			"_Checkers": { 'id': "Checkers", 'name': "'Checkers'", 'price': 999, 'offlimits': true },
			"_UFO": { 'id': "UFO", 'name': "'UFO'", 'price': 999, 'offlimits': true },
			"_DecorativeRetroDoor": { 'id': "DecorativeRetroDoor", 'name': "Decorative Retro Door", 'price': 999, 'offlimits': true },
			"_DecorativeDoor1": { 'id': "DecorativeDoor1", 'name': "Decorative Door", 'price': 5000, 'offlimits': false },
			"_DecorativeDoor2": { 'id': "DecorativeDoor2", 'name': "Decorative Door", 'price': 5000, 'offlimits': false },
			"_DecorativeDoor3": { 'id': "DecorativeDoor3", 'name': "Decorative Door", 'price': 5000, 'offlimits': false },
			"_DecorativeDoor4": { 'id': "DecorativeDoor4", 'name': "Decorative Door", 'price': 5000, 'offlimits': false },
			"_DecorativeDoor5": { 'id': "DecorativeDoor5", 'name': "Decorative Door", 'price': 5000, 'offlimits': false },
			"_DecorativeDoor6": { 'id': "DecorativeDoor6", 'name': "Decorative Door", 'price': 5000, 'offlimits': false },
			"_WallClock": { 'id': "WallClock", 'name': "Wall Clock", 'price': 2500, 'offlimits': false },
			"_DecorativeHatch": { 'id': "DecorativeHatch", 'name': "Decorative Hatch", 'price': 1000, 'offlimits': false },
			"_DecorativeOakLadder": { 'id': "DecorativeOakLadder", 'name': "Decorative Oak Ladder", 'price': 2500, 'offlimits': false },
			"_DecorativeWalnutLadder": { 'id': "DecorativeWalnutLadder", 'name': "Decorative Walnut Ladder", 'price': 2500, 'offlimits': false },
			"_UprightPiano": { 'id': "UprightPiano", 'name': "Upright Piano", 'price': 999, 'offlimits': true },
			"_CoatStand": { 'id': "CoatStand", 'name': "Coat Stand", 'price': 999, 'offlimits': true },
			"_BirdHouse": { 'id': "BirdHouse", 'name': "Bird House", 'price': 999, 'offlimits': true },
			"_DecorativeShovel": { 'id': "DecorativeShovel", 'name': "Decorative Shovel", 'price': 2000, 'offlimits': false },
			"_WallSword": { 'id': "WallSword", 'name': "Wall Sword", 'price': 999, 'offlimits': true },
			"_DecorativeSword": { 'id': "DecorativeSword", 'name': "Decorative Sword", 'price': 999, 'offlimits': true },
			"_WineTable": { 'id': "WineTable", 'name': "Wine Table", 'price': 4000, 'offlimits': false },
			"_SpiritsTable": { 'id': "SpiritsTable", 'name': "Spirits Table", 'price': 4000, 'offlimits': false },
			"_TallHousePlant": { 'id': "TallHousePlant", 'name': "Tall House Plant", 'price': 1000, 'offlimits': false },
			"_CornPlant": { 'id': "CornPlant", 'name': "Corn Plant", 'price': 1000, 'offlimits': false },
			"_BlueCushion": { 'id': "BlueCushion", 'name': "Blue Cushion", 'price': 500, 'offlimits': false },
			"_YellowCushion": { 'id': "YellowCushion", 'name': "Yellow Cushion", 'price': 500, 'offlimits': false },
			"_GreenCushion": { 'id': "GreenCushion", 'name': "Green Cushion", 'price': 500, 'offlimits': false },
			"_RedCushion": { 'id': "RedCushion", 'name': "Red Cushion", 'price': 500, 'offlimits': false },
			"_BrownCushion": { 'id': "BrownCushion", 'name': "Brown Cushion", 'price': 500, 'offlimits': false },
			"_BlackCushion": { 'id': "BlackCushion", 'name': "Black Cushion", 'price': 500, 'offlimits': false },
			"_FoodPetBowl": { 'id': "FoodPetBowl", 'name': "Food Pet Bowl", 'price': 999, 'offlimits': true },
			"_WaterPetBowl": { 'id': "WaterPetBowl", 'name': "Water Pet Bowl", 'price': 999, 'offlimits': true },
			"_OakLampEndTable": { 'id': "OakLampEndTable", 'name': "Oak Lamp End Table", 'price': 2000, 'offlimits': false },
			"_WalnutLampEndTable": { 'id': "WalnutLampEndTable", 'name': "Walnut Lamp End Table", 'price': 2000, 'offlimits': false },
			"_BirchLampEndTable": { 'id': "BirchLampEndTable", 'name': "Birch Lamp End Table", 'price': 2000, 'offlimits': false },
			"_MahoganyLampEndTable": { 'id': "MahoganyLampEndTable", 'name': "Mahogany Lamp End Table", 'price': 3000, 'offlimits': false },
			"_TriangleWindow": { 'id': "TriangleWindow", 'name': "Triangle Window", 'price': 800, 'offlimits': false },
			"_Clothesline": { 'id': "Clothesline", 'name': "Clothesline", 'price': 999, 'offlimits': true },
			"_TrashCatalogue": { 'id': "TrashCatalogue", 'name': "Trash Catalogue", 'price': 999, 'offlimits': true },
			"_ElegantVase": { 'id': "ElegantVase", 'name': "Elegant Vase", 'price': 5000, 'offlimits': false },
			"_CatTree": { 'id': "CatTree", 'name': "Cat Tree", 'price': 999, 'offlimits': true },
			"_DarkCatTree": { 'id': "DarkCatTree", 'name': "Dark Cat Tree", 'price': 999, 'offlimits': true },
			"_LightSwitch": { 'id': "LightSwitch", 'name': "Light Switch", 'price': 600, 'offlimits': false },
			"_Outlet": { 'id': "Outlet", 'name': "Outlet", 'price': 600, 'offlimits': false },
			"_Doghouse": { 'id': "Doghouse", 'name': "Doghouse", 'price': 999, 'offlimits': true },
			"_DarkDoghouse": { 'id': "DarkDoghouse", 'name': "Dark Doghouse", 'price': 999, 'offlimits': true },
			"_BountifulDiningTable": { 'id': "BountifulDiningTable", 'name': "Bountiful Dining Table", 'price': 10000, 'offlimits': false },
			"_PlasticLawnEndTable": { 'id': "PlasticLawnEndTable", 'name': "Plastic Lawn End Table", 'price': 999, 'offlimits': true },
			"_PlasticLawnChair": { 'id': "PlasticLawnChair", 'name': "Plastic Lawn Chair", 'price': 999, 'offlimits': true },
			"_BrokenTelevision": { 'id': "BrokenTelevision", 'name': "Broken Television", 'price': 999, 'offlimits': true },
			"_SixPackRings": { 'id': "SixPackRings", 'name': "Six-Pack Rings", 'price': 999, 'offlimits': true },
			"_GreenBottle": { 'id': "GreenBottle", 'name': "Green Bottle", 'price': 999, 'offlimits': true },
			"_PlasticBag": { 'id': "PlasticBag", 'name': "Plastic Bag", 'price': 999, 'offlimits': true },
			"_AluminumCan": { 'id': "AluminumCan", 'name': "Aluminum Can", 'price': 999, 'offlimits': true },
			"_BlueBottle": { 'id': "BlueBottle", 'name': "Blue Bottle", 'price': 999, 'offlimits': true },
			"_BuriedTire": { 'id': "BuriedTire", 'name': "Buried Tire", 'price': 999, 'offlimits': true },
			"_Tire": { 'id': "Tire", 'name': "Tire", 'price': 999, 'offlimits': true },
			"_Wrapper": { 'id': "Wrapper", 'name': "Wrapper", 'price': 999, 'offlimits': true },
			"_SpilledBeverage": { 'id': "SpilledBeverage", 'name': "Spilled Beverage", 'price': 999, 'offlimits': true },
			"_MessyShirt": { 'id': "MessyShirt", 'name': "Messy Shirt", 'price': 999, 'offlimits': true },
			"_MessyShorts": { 'id': "MessyShorts", 'name': "Messy Shorts", 'price': 999, 'offlimits': true },
			"_MoldyCouch": { 'id': "MoldyCouch", 'name': "Moldy Couch", 'price': 999, 'offlimits': true },
			"_FancyTree1": { 'id': "FancyTree1", 'name': "Fancy House Plant", 'price': 500, 'offlimits': true },
			"_FancyTree2": { 'id': "FancyTree2", 'name': "Fancy House Plant", 'price': 500, 'offlimits': true },
			"_FancyTree3": { 'id': "FancyTree3", 'name': "Fancy House Plant", 'price': 500, 'offlimits': true },
			"_FancyHousePlant3": { 'id': "FancyHousePlant3", 'name': "House Plant (FancyHousePlant3)", 'price': 250, 'offlimits': true },
			"_FancyHousePlant1": { 'id': "FancyHousePlant1", 'name': "House Plant (FancyHousePlant1)", 'price': 250, 'offlimits': true },
			"_FancyHousePlant2": { 'id': "FancyHousePlant2", 'name': "House Plant (FancyHousePlant2)", 'price': 250, 'offlimits': true },
			"_FancyHousePlant4": { 'id': "FancyHousePlant4", 'name': "House Plant (FancyHousePlant4)", 'price': 250, 'offlimits': true },
			"_FancyHousePlant5": { 'id': "FancyHousePlant5", 'name': "House Plant (FancyHousePlant5)", 'price': 250, 'offlimits': true },
			"_PigPainting": { 'id': "PigPainting", 'name': "Pig Painting", 'price': 500, 'offlimits': true },
			"_MidnightBeachBed": { 'id': "MidnightBeachBed", 'name': "Midnight Beach Bed", 'price': 5000, 'offlimits': true },
			"_MidnightBeachDoubleBed": { 'id': "MidnightBeachDoubleBed", 'name': "Midnight Beach Double Bed", 'price': 5000, 'offlimits': true },
			"_DarkPiano": { 'id': "DarkPiano", 'name': "Dark Piano", 'price': 999, 'offlimits': true },
		};
		save.shirts = {
			"_1000": { 'id': "1000", 'name': "Classic Overalls", 'price': 50, 'offlimits': false },
			"_1001": { 'id': "1001", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1002": { 'id': "1002", 'name': "Mint Blouse", 'price': 50, 'offlimits': false },
			"_1003": { 'id': "1003", 'name': "Dark Shirt", 'price': 50, 'offlimits': false },
			"_1004": { 'id': "1004", 'name': "Skull Shirt", 'price': 50, 'offlimits': false },
			"_1005": { 'id': "1005", 'name': "Light Blue Shirt", 'price': 50, 'offlimits': false },
			"_1006": { 'id': "1006", 'name': "Tan Striped Shirt", 'price': 50, 'offlimits': false },
			"_1007": { 'id': "1007", 'name': "Green Overalls", 'price': 50, 'offlimits': false },
			"_1008": { 'id': "1008", 'name': "Good Grief Shirt", 'price': 50, 'offlimits': false },
			"_1009": { 'id': "1009", 'name': "Aquamarine Shirt", 'price': 50, 'offlimits': false },
			"_1010": { 'id': "1010", 'name': "Suit Top", 'price': 50, 'offlimits': false },
			"_1011": { 'id': "1011", 'name': "Green Belted Shirt", 'price': 50, 'offlimits': false },
			"_1012": { 'id': "1012", 'name': "Lime Green Striped Shirt", 'price': 50, 'offlimits': false },
			"_1013": { 'id': "1013", 'name': "Red Striped Shirt", 'price': 50, 'offlimits': false },
			"_1014": { 'id': "1014", 'name': "Skeleton Shirt", 'price': 50, 'offlimits': false },
			"_1015": { 'id': "1015", 'name': "Orange Shirt", 'price': 50, 'offlimits': false },
			"_1016": { 'id': "1016", 'name': "Night Sky Shirt", 'price': 50, 'offlimits': false },
			"_1017": { 'id': "1017", 'name': "Mayoral Suspenders", 'price': 50, 'offlimits': false },
			"_1018": { 'id': "1018", 'name': "Brown Jacket", 'price': 50, 'offlimits': false },
			"_1019": { 'id': "1019", 'name': "Sailor Shirt", 'price': 50, 'offlimits': false },
			"_1020": { 'id': "1020", 'name': "Green Vest", 'price': 50, 'offlimits': false },
			"_1021": { 'id': "1021", 'name': "Yellow and Green Shirt", 'price': 50, 'offlimits': false },
			"_1022": { 'id': "1022", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1023": { 'id': "1023", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1024": { 'id': "1024", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1025": { 'id': "1025", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1026": { 'id': "1026", 'name': "Light Blue Striped Shirt", 'price': 50, 'offlimits': false },
			"_1027": { 'id': "1027", 'name': "Pink Striped Shirt", 'price': 50, 'offlimits': false },
			"_1028": { 'id': "1028", 'name': "Heart Shirt", 'price': 50, 'offlimits': false },
			"_1029": { 'id': "1029", 'name': "Work Shirt", 'price': 50, 'offlimits': false },
			"_1030": { 'id': "1030", 'name': "Store Owner's Jacket", 'price': 50, 'offlimits': false },
			"_1031": { 'id': "1031", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1032": { 'id': "1032", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1033": { 'id': "1033", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1034": { 'id': "1034", 'name': "Green Tunic", 'price': 50, 'offlimits': false },
			"_1035": { 'id': "1035", 'name': "Fancy Red Blouse", 'price': 50, 'offlimits': false },
			"_1036": { 'id': "1036", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1037": { 'id': "1037", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1038": { 'id': "1038", 'name': "Plain Shirt (M)", 'price': 50, 'offlimits': false },
			"_1039": { 'id': "1039", 'name': "Retro Rainbow Shirt", 'price': 50, 'offlimits': false },
			"_1040": { 'id': "1040", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1041": { 'id': "1041", 'name': "Plain Shirt (F)", 'price': 50, 'offlimits': false },
			"_1042": { 'id': "1042", 'name': "Lime Green Tunic", 'price': 50, 'offlimits': false },
			"_1043": { 'id': "1043", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1044": { 'id': "1044", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1045": { 'id': "1045", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1046": { 'id': "1046", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1047": { 'id': "1047", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1048": { 'id': "1048", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1049": { 'id': "1049", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1050": { 'id': "1050", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1051": { 'id': "1051", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1052": { 'id': "1052", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1053": { 'id': "1053", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1054": { 'id': "1054", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1055": { 'id': "1055", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1056": { 'id': "1056", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1057": { 'id': "1057", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1058": { 'id': "1058", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1059": { 'id': "1059", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1060": { 'id': "1060", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1061": { 'id': "1061", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1062": { 'id': "1062", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1063": { 'id': "1063", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1064": { 'id': "1064", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1065": { 'id': "1065", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1066": { 'id': "1066", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1067": { 'id': "1067", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1068": { 'id': "1068", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1069": { 'id': "1069", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1070": { 'id': "1070", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1071": { 'id': "1071", 'name': "White Overalls Shirt", 'price': 50, 'offlimits': false },
			"_1072": { 'id': "1072", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1073": { 'id': "1073", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1074": { 'id': "1074", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1075": { 'id': "1075", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1076": { 'id': "1076", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1077": { 'id': "1077", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1078": { 'id': "1078", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1079": { 'id': "1079", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1080": { 'id': "1080", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1081": { 'id': "1081", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1082": { 'id': "1082", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1083": { 'id': "1083", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1084": { 'id': "1084", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1085": { 'id': "1085", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1086": { 'id': "1086", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1087": { 'id': "1087", 'name': "Neat Bow Shirt", 'price': 50, 'offlimits': false },
			"_1088": { 'id': "1088", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1089": { 'id': "1089", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1090": { 'id': "1090", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1091": { 'id': "1091", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1092": { 'id': "1092", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1093": { 'id': "1093", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1094": { 'id': "1094", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1095": { 'id': "1095", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1096": { 'id': "1096", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1097": { 'id': "1097", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1098": { 'id': "1098", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1099": { 'id': "1099", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1100": { 'id': "1100", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1101": { 'id': "1101", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1102": { 'id': "1102", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1103": { 'id': "1103", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1104": { 'id': "1104", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1105": { 'id': "1105", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1106": { 'id': "1106", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1107": { 'id': "1107", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1108": { 'id': "1108", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1109": { 'id': "1109", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1110": { 'id': "1110", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1111": { 'id': "1111", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1112": { 'id': "1112", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1113": { 'id': "1113", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1114": { 'id': "1114", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1115": { 'id': "1115", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1116": { 'id': "1116", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1117": { 'id': "1117", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1118": { 'id': "1118", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1119": { 'id': "1119", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1120": { 'id': "1120", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1121": { 'id': "1121", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1122": { 'id': "1122", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1123": { 'id': "1123", 'name': "Shirt And Tie", 'price': 50, 'offlimits': false },
			"_1124": { 'id': "1124", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1125": { 'id': "1125", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1126": { 'id': "1126", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1127": { 'id': "1127", 'name': "Emily's Magic Shirt", 'price': 50, 'offlimits': false },
			"_1128": { 'id': "1128", 'name': "Striped Shirt", 'price': 50, 'offlimits': false },
			"_1129": { 'id': "1129", 'name': "Tank Top (M)", 'price': 50, 'offlimits': false },
			"_1130": { 'id': "1130", 'name': "Tank Top (F)", 'price': 50, 'offlimits': false },
			"_1131": { 'id': "1131", 'name': "Cowboy Poncho", 'price': 50, 'offlimits': false },
			"_1132": { 'id': "1132", 'name': "Crop Tank Top (M)", 'price': 50, 'offlimits': false },
			"_1133": { 'id': "1133", 'name': "Crop Tank Top (F)", 'price': 50, 'offlimits': false },
			"_1134": { 'id': "1134", 'name': "Bikini Top", 'price': 50, 'offlimits': false },
			"_1135": { 'id': "1135", 'name': "Wumbus Shirt", 'price': 50, 'offlimits': false },
			"_1136": { 'id': "1136", 'name': "80's Shirt (F)", 'price': 50, 'offlimits': false },
			"_1137": { 'id': "1137", 'name': "Letterman Jacket", 'price': 50, 'offlimits': false },
			"_1138": { 'id': "1138", 'name': "Black Leather Jacket", 'price': 50, 'offlimits': false },
			"_1139": { 'id': "1139", 'name': "Strapped Top", 'price': 50, 'offlimits': false },
			"_1140": { 'id': "1140", 'name': "Button Down Shirt", 'price': 50, 'offlimits': false },
			"_1141": { 'id': "1141", 'name': "Crop Top Shirt", 'price': 50, 'offlimits': false },
			"_1142": { 'id': "1142", 'name': "Tube Top", 'price': 50, 'offlimits': false },
			"_1143": { 'id': "1143", 'name': "Tie Dye Shirt", 'price': 50, 'offlimits': false },
			"_1144": { 'id': "1144", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1145": { 'id': "1145", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1146": { 'id': "1146", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1147": { 'id': "1147", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1148": { 'id': "1148", 'name': "Steel Breastplate", 'price': 50, 'offlimits': false },
			"_1149": { 'id': "1149", 'name': "Copper Breastplate", 'price': 50, 'offlimits': false },
			"_1150": { 'id': "1150", 'name': "Gold Breastplate", 'price': 50, 'offlimits': false },
			"_1151": { 'id': "1151", 'name': "Iridium Breastplate", 'price': 50, 'offlimits': false },
			"_1152": { 'id': "1152", 'name': "80's Shirt (M)", 'price': 50, 'offlimits': false },
			"_1153": { 'id': "1153", 'name': "Fake Muscles Shirt", 'price': 50, 'offlimits': false },
			"_1154": { 'id': "1154", 'name': "Flannel Shirt", 'price': 50, 'offlimits': false },
			"_1155": { 'id': "1155", 'name': "Bomber Jacket", 'price': 50, 'offlimits': false },
			"_1156": { 'id': "1156", 'name': "Caveman Shirt", 'price': 50, 'offlimits': false },
			"_1157": { 'id': "1157", 'name': "Fishing Vest", 'price': 50, 'offlimits': false },
			"_1158": { 'id': "1158", 'name': "Fish Shirt", 'price': 50, 'offlimits': false },
			"_1159": { 'id': "1159", 'name': "Shirt And Belt", 'price': 50, 'offlimits': false },
			"_1160": { 'id': "1160", 'name': "Gray Hoodie", 'price': 50, 'offlimits': false },
			"_1161": { 'id': "1161", 'name': "Blue Hoodie", 'price': 50, 'offlimits': false },
			"_1162": { 'id': "1162", 'name': "Red Hoodie", 'price': 50, 'offlimits': false },
			"_1163": { 'id': "1163", 'name': "Denim Jacket", 'price': 50, 'offlimits': false },
			"_1164": { 'id': "1164", 'name': "Track Jacket", 'price': 50, 'offlimits': false },
			"_1165": { 'id': "1165", 'name': "White Gi", 'price': 50, 'offlimits': false },
			"_1166": { 'id': "1166", 'name': "Orange Gi", 'price': 50, 'offlimits': false },
			"_1167": { 'id': "1167", 'name': "Gray Vest", 'price': 50, 'offlimits': false },
			"_1168": { 'id': "1168", 'name': "Kelp Shirt", 'price': 50, 'offlimits': false },
			"_1169": { 'id': "1169", 'name': "Studded Vest", 'price': 50, 'offlimits': false },
			"_1170": { 'id': "1170", 'name': "Gaudy Shirt", 'price': 50, 'offlimits': false },
			"_1171": { 'id': "1171", 'name': "Oasis Gown", 'price': 50, 'offlimits': false },
			"_1172": { 'id': "1172", 'name': "Blacksmith Apron", 'price': 50, 'offlimits': false },
			"_1173": { 'id': "1173", 'name': "Neat Bow Shirt", 'price': 50, 'offlimits': false },
			"_1174": { 'id': "1174", 'name': "High-Waisted Shirt", 'price': 50, 'offlimits': false },
			"_1175": { 'id': "1175", 'name': "High-Waisted Shirt", 'price': 50, 'offlimits': false },
			"_1176": { 'id': "1176", 'name': "Basic Pullover (M)", 'price': 50, 'offlimits': false },
			"_1177": { 'id': "1177", 'name': "Basic Pullover (F)", 'price': 50, 'offlimits': false },
			"_1178": { 'id': "1178", 'name': "Turtleneck Sweater", 'price': 50, 'offlimits': false },
			"_1179": { 'id': "1179", 'name': "Iridium Energy Shirt", 'price': 50, 'offlimits': false },
			"_1180": { 'id': "1180", 'name': "Tunnelers Jersey", 'price': 50, 'offlimits': false },
			"_1181": { 'id': "1181", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1182": { 'id': "1182", 'name': "Shirt", 'price': 50, 'offlimits': false },
			"_1183": { 'id': "1183", 'name': "Gray Suit", 'price': 50, 'offlimits': false },
			"_1184": { 'id': "1184", 'name': "Red Tuxedo", 'price': 50, 'offlimits': false },
			"_1185": { 'id': "1185", 'name': "Navy Tuxedo", 'price': 50, 'offlimits': false },
			"_1186": { 'id': "1186", 'name': "Holiday Shirt", 'price': 50, 'offlimits': false },
			"_1187": { 'id': "1187", 'name': "Leafy Top", 'price': 50, 'offlimits': false },
			"_1188": { 'id': "1188", 'name': "Goodnight Shirt", 'price': 50, 'offlimits': false },
			"_1189": { 'id': "1189", 'name': "Green Belted Shirt", 'price': 50, 'offlimits': false },
			"_1190": { 'id': "1190", 'name': "Happy Shirt", 'price': 50, 'offlimits': false },
			"_1191": { 'id': "1191", 'name': "Shirt with Bow", 'price': 50, 'offlimits': false },
			"_1192": { 'id': "1192", 'name': "Jester Shirt", 'price': 50, 'offlimits': false },
			"_1193": { 'id': "1193", 'name': "Ocean Shirt", 'price': 50, 'offlimits': false },
			"_1194": { 'id': "1194", 'name': "Dark Striped Shirt", 'price': 50, 'offlimits': false },
			"_1195": { 'id': "1195", 'name': "Bandana Shirt", 'price': 50, 'offlimits': false },
			"_1196": { 'id': "1196", 'name': "Backpack Shirt", 'price': 50, 'offlimits': false },
			"_1197": { 'id': "1197", 'name': "Purple Blouse", 'price': 50, 'offlimits': false },
			"_1198": { 'id': "1198", 'name': "Vintage Polo", 'price': 50, 'offlimits': false },
			"_1199": { 'id': "1199", 'name': "Toga Shirt", 'price': 50, 'offlimits': false },
			"_1200": { 'id': "1200", 'name': "Star Shirt", 'price': 50, 'offlimits': false },
			"_1201": { 'id': "1201", 'name': "Classy Top (M)", 'price': 50, 'offlimits': false },
			"_1202": { 'id': "1202", 'name': "Classy Top (F)", 'price': 50, 'offlimits': false },
			"_1203": { 'id': "1203", 'name': "Bandana Shirt", 'price': 50, 'offlimits': false },
			"_1204": { 'id': "1204", 'name': "Vacation Shirt", 'price': 50, 'offlimits': false },
			"_1205": { 'id': "1205", 'name': "Green Thumb Shirt", 'price': 50, 'offlimits': false },
			"_1206": { 'id': "1206", 'name': "Bandana Shirt", 'price': 50, 'offlimits': false },
			"_1207": { 'id': "1207", 'name': "Slime Shirt", 'price': 50, 'offlimits': false },
			"_1208": { 'id': "1208", 'name': "Excavator Shirt", 'price': 50, 'offlimits': false },
			"_1209": { 'id': "1209", 'name': "Sports Shirt", 'price': 50, 'offlimits': false },
			"_1210": { 'id': "1210", 'name': "Heart Shirt", 'price': 50, 'offlimits': false },
			"_1211": { 'id': "1211", 'name': "Dark Jacket", 'price': 50, 'offlimits': false },
			"_1212": { 'id': "1212", 'name': "Sunset Shirt", 'price': 50, 'offlimits': false },
			"_1213": { 'id': "1213", 'name': "Chef Coat", 'price': 50, 'offlimits': false },
			"_1214": { 'id': "1214", 'name': "Shirt O' The Sea", 'price': 50, 'offlimits': false },
			"_1215": { 'id': "1215", 'name': "Arcane Shirt", 'price': 50, 'offlimits': false },
			"_1216": { 'id': "1216", 'name': "Plain Overalls", 'price': 50, 'offlimits': false },
			"_1217": { 'id': "1217", 'name': "Sleeveless Overalls", 'price': 50, 'offlimits': false },
			"_1218": { 'id': "1218", 'name': "Cardigan", 'price': 50, 'offlimits': false },
			"_1219": { 'id': "1219", 'name': "Yoba Shirt", 'price': 50, 'offlimits': false },
			"_1220": { 'id': "1220", 'name': "Necklace Shirt", 'price': 50, 'offlimits': false },
			"_1221": { 'id': "1221", 'name': "Belted Coat", 'price': 50, 'offlimits': false },
			"_1222": { 'id': "1222", 'name': "Gold Trimmed Shirt", 'price': 50, 'offlimits': false },
			"_1223": { 'id': "1223", 'name': "Prismatic Shirt", 'price': 50, 'offlimits': false },
			"_1224": { 'id': "1224", 'name': "Pendant Shirt", 'price': 50, 'offlimits': false },
			"_1225": { 'id': "1225", 'name': "High Heat Shirt", 'price': 50, 'offlimits': false },
			"_1226": { 'id': "1226", 'name': "Flames Shirt", 'price': 50, 'offlimits': false },
			"_1227": { 'id': "1227", 'name': "Antiquity Shirt", 'price': 50, 'offlimits': false },
			"_1228": { 'id': "1228", 'name': "Soft Arrow Shirt", 'price': 50, 'offlimits': false },
			"_1229": { 'id': "1229", 'name': "Doll Shirt", 'price': 50, 'offlimits': false },
			"_1230": { 'id': "1230", 'name': "Jewelry Shirt", 'price': 50, 'offlimits': false },
			"_1231": { 'id': "1231", 'name': "Canvas Jacket", 'price': 50, 'offlimits': false },
			"_1232": { 'id': "1232", 'name': "Trash Can Shirt", 'price': 50, 'offlimits': false },
			"_1233": { 'id': "1233", 'name': "Rusty Shirt", 'price': 50, 'offlimits': false },
			"_1234": { 'id': "1234", 'name': "Circuitboard Shirt", 'price': 50, 'offlimits': false },
			"_1235": { 'id': "1235", 'name': "Fluffy Shirt", 'price': 50, 'offlimits': false },
			"_1236": { 'id': "1236", 'name': "Sauce-Stained Shirt", 'price': 50, 'offlimits': false },
			"_1237": { 'id': "1237", 'name': "Brown Suit", 'price': 50, 'offlimits': false },
			"_1238": { 'id': "1238", 'name': "Golden Shirt", 'price': 50, 'offlimits': false },
			"_1239": { 'id': "1239", 'name': "Captain's Uniform", 'price': 50, 'offlimits': false },
			"_1240": { 'id': "1240", 'name': "Officer Uniform", 'price': 50, 'offlimits': false },
			"_1241": { 'id': "1241", 'name': "Ranger Uniform", 'price': 50, 'offlimits': false },
			"_1242": { 'id': "1242", 'name': "Blue Long Vest", 'price': 50, 'offlimits': false },
			"_1243": { 'id': "1243", 'name': "Regal Mantle", 'price': 50, 'offlimits': false },
			"_1244": { 'id': "1244", 'name': "Relic Shirt", 'price': 50, 'offlimits': false },
			"_1245": { 'id': "1245", 'name': "Bobo Shirt", 'price': 50, 'offlimits': false },
			"_1246": { 'id': "1246", 'name': "Fried Egg Shirt", 'price': 50, 'offlimits': false },
			"_1247": { 'id': "1247", 'name': "Burger Shirt", 'price': 50, 'offlimits': false },
			"_1248": { 'id': "1248", 'name': "Collared Shirt", 'price': 50, 'offlimits': false },
			"_1249": { 'id': "1249", 'name': "Toasted Shirt", 'price': 50, 'offlimits': false },
			"_1250": { 'id': "1250", 'name': "Carp Shirt", 'price': 50, 'offlimits': false },
			"_1251": { 'id': "1251", 'name': "Red Flannel Shirt", 'price': 50, 'offlimits': false },
			"_1252": { 'id': "1252", 'name': "Tortilla Shirt", 'price': 50, 'offlimits': false },
			"_1253": { 'id': "1253", 'name': "Warm Flannel Shirt", 'price': 50, 'offlimits': false },
			"_1254": { 'id': "1254", 'name': "Sugar Shirt", 'price': 50, 'offlimits': false },
			"_1255": { 'id': "1255", 'name': "Green Flannel Shirt", 'price': 50, 'offlimits': false },
			"_1256": { 'id': "1256", 'name': "Oil Stained Shirt", 'price': 50, 'offlimits': false },
			"_1257": { 'id': "1257", 'name': "Morel Shirt", 'price': 50, 'offlimits': false },
			"_1258": { 'id': "1258", 'name': "Spring Shirt", 'price': 50, 'offlimits': false },
			"_1259": { 'id': "1259", 'name': "Sailor Shirt", 'price': 50, 'offlimits': false },
			"_1260": { 'id': "1260", 'name': "Rain Coat", 'price': 50, 'offlimits': false },
			"_1261": { 'id': "1261", 'name': "Sailor Shirt", 'price': 50, 'offlimits': false },
			"_1262": { 'id': "1262", 'name': "Dark Bandana Shirt", 'price': 50, 'offlimits': false },
			"_1263": { 'id': "1263", 'name': "Dark Highlight Shirt", 'price': 50, 'offlimits': false },
			"_1264": { 'id': "1264", 'name': "Omni Shirt", 'price': 50, 'offlimits': false },
			"_1265": { 'id': "1265", 'name': "Bridal Shirt", 'price': 50, 'offlimits': false },
			"_1266": { 'id': "1266", 'name': "Brown Overalls", 'price': 50, 'offlimits': false },
			"_1267": { 'id': "1267", 'name': "Orange Bow Shirt", 'price': 50, 'offlimits': false },
			"_1268": { 'id': "1268", 'name': "White Overalls", 'price': 50, 'offlimits': false },
			"_1269": { 'id': "1269", 'name': "Pour-Over Shirt", 'price': 50, 'offlimits': false },
			"_1270": { 'id': "1270", 'name': "Green Jacket Shirt", 'price': 50, 'offlimits': false },
			"_1271": { 'id': "1271", 'name': "Short Jacket", 'price': 50, 'offlimits': false },
			"_1272": { 'id': "1272", 'name': "Polka Dot Shirt", 'price': 50, 'offlimits': false },
			"_1273": { 'id': "1273", 'name': "White Dot Shirt", 'price': 50, 'offlimits': false },
			"_1274": { 'id': "1274", 'name': "Camo Shirt", 'price': 50, 'offlimits': false },
			"_1275": { 'id': "1275", 'name': "Dirt Shirt", 'price': 50, 'offlimits': false },
			"_1276": { 'id': "1276", 'name': "Crab Cake Shirt", 'price': 50, 'offlimits': false },
			"_1277": { 'id': "1277", 'name': "Silky Shirt", 'price': 50, 'offlimits': false },
			"_1278": { 'id': "1278", 'name': "Blue Buttoned Vest", 'price': 50, 'offlimits': false },
			"_1279": { 'id': "1279", 'name': "Faded Denim Shirt", 'price': 50, 'offlimits': false },
			"_1280": { 'id': "1280", 'name': "Red Buttoned Vest", 'price': 50, 'offlimits': false },
			"_1281": { 'id': "1281", 'name': "Green Buttoned Vest", 'price': 50, 'offlimits': false },
			"_1282": { 'id': "1282", 'name': "Tomato Shirt", 'price': 50, 'offlimits': false },
			"_1283": { 'id': "1283", 'name': "Fringed Vest", 'price': 50, 'offlimits': false },
			"_1284": { 'id': "1284", 'name': "Globby Shirt", 'price': 50, 'offlimits': false },
			"_1285": { 'id': "1285", 'name': "Midnight Dog Jacket", 'price': 50, 'offlimits': false },
			"_1286": { 'id': "1286", 'name': "Shrimp Enthusiast Shirt", 'price': 50, 'offlimits': false },
			"_1287": { 'id': "1287", 'name': "Tea Shirt", 'price': 50, 'offlimits': false },
			"_1288": { 'id': "1288", 'name': "Trinket Shirt", 'price': 50, 'offlimits': false },
			"_1289": { 'id': "1289", 'name': "Darkness Suit", 'price': 50, 'offlimits': false },
			"_1290": { 'id': "1290", 'name': "Mineral Dog Jacket", 'price': 50, 'offlimits': false },
			"_1291": { 'id': "1291", 'name': "Magenta Shirt", 'price': 50, 'offlimits': false },
			"_1292": { 'id': "1292", 'name': "Ginger Overalls", 'price': 50, 'offlimits': false },
			"_1293": { 'id': "1293", 'name': "Banana Shirt", 'price': 50, 'offlimits': false },
			"_1294": { 'id': "1294", 'name': "Yellow Suit", 'price': 50, 'offlimits': false },
			"_1295": { 'id': "1295", 'name': "Hot Pink Shirt", 'price': 50, 'offlimits': false },
			"_1296": { 'id': "1296", 'name': "Tropical Sunrise Shirt", 'price': 50, 'offlimits': false },
			"_1297": { 'id': "1297", 'name': "Island Bikini", 'price': 50, 'offlimits': false },
			"_1997": { 'id': "1997", 'name': "Magic Sprinkle Shirt", 'price': 50, 'offlimits': false },
			"_1998": { 'id': "1998", 'name': "Prismatic Shirt", 'price': 50, 'offlimits': false },
			"_1999": { 'id': "1999", 'name': "Prismatic Shirt", 'price': 50, 'offlimits': false },
			"_MysteryShirt": { 'id': "MysteryShirt", 'name': "Mystery Shirt", 'price': 50, 'offlimits': false },
			"_SoftEdgePullover": { 'id': "SoftEdgePullover", 'name': "Basic Pullover (M)", 'price': 50, 'offlimits': false },
		};

		// We start the actual save information with reasonable default values for the various items we want to read from the save.
		save.version =  "1.6";
		save.farmName = "Unknown Farm";
		save.niceDate = '';
		save.gameID = null;
		save.daysPlayed = 1;
		save.year = 1;
		save.geodesCracked = [0];
		save.mysteryBoxesOpened = [0];
		save.ticketPrizesClaimed = [0];
		save.timesEnchanted = [0];
		save.trashCansChecked = [0];
		save.deepestMineLevel = 0;
		save.timesFedRaccoons = 0;
		save.dailyLuck = -.1;
		save.luckLevel = 0;
		save.canHaveChildren = false;
		save.quarryUnlocked = false;
		save.desertUnlocked = false;
		save.greenhouseUnlocked = false;
		save.theaterUnlocked = false;
		save.ccComplete = false;
		save.jojaComplete = false;
		save.hasFurnaceRecipe = false;
		save.hasSpecialCharm = false;
		save.leoMoved = false;
		save.hasGarbageBook = false;
		save.gotMysteryBook = false;
		save.useLegacyRandom = false;
		save.hardmodeMines = false;
		save.qiCropsActive = false;
		save.visitsUntilY1Guarantee = -1;
		save.names = [];
		save.gender = [];
		// save.characters should actually be built by iterating over game locations so the order will change depending on 
		// big changes such as marriages and Pam moving from trailer to house.
		// Here we provide a reasonable default setup in case the app is run from gameID parameter
		save.characters = ["George", "Evelyn", "Alex", "Haley", "Emily", "Vincent", "Sam", "Jodi", "Kent", "Clint", "Lewis", "Pierre", "Abigail", "Caroline", "Gus", "Penny", "Pam", "Harvey", "Elliott", "Demetrius", "Robin", "Maru", "Sebastian", "Linus", "Wizard", "Jas", "Marnie", "Shane", "Leah", "Dwarf", "Krobus", "Sandy", "Willy", "Leo"];
		// This structure will be used by the geode cracker code so that it knows what to mark as donatable. It gets
		// initialized with items that could be obtained from geodes that are not museum donations.
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
			'Banana Sapling': 1,
			'Mango Sapling': 1,
			'Pineapple Seeds': 1,
			'Taro Tuber': 1,
			'Mahogany Seed': 1,
			'Fossilized Skull': 1,
			"Ancient Treasures: Appraisal Guide": 1
		};
		// Large multiplayer games will sometimes get out of synch between the actual number of days played and the current date
		// This variable stores that value (and it can be set with a URL parameter processed later).
		save.dayAdjust = 0;

		// Now we parse the save if there was one.
		if (typeof xmlDoc !== 'undefined') {
			// gameID is a 64bit ulong which could technically be larger than JS precision and force us to use bigInts much more often.
			save.gameID = Number($(xmlDoc).find('uniqueIDForThisGame').text());
			save.version = $(xmlDoc).find('gameVersion').first().text();
			if (save.version === "") {
				save.version = "1.2";
				if ($(xmlDoc).find('hasApplied1_4_UpdateChanges').text() === 'true') {
					save.version = "1.4";
				} else if ($(xmlDoc).find('hasApplied1_3_UpdateChanges').text() === 'true') {
					save.version = "1.3";
				}
			}

			if (compareSemVer(save.version, "1.3") >= 0) {
				$('#cart-title').html('Traveling Merchant Cart and Night Market Boat');
			} else {
				$('#cart-title').html('Traveling Merchant Cart');
			}
			save.ns_prefix = ($(xmlDoc).find('SaveGame[xmlns\\:xsi]').length > 0) ? 'xsi': 'p3';
			// Farmer & farm names are read as html() because they come from user input and might contain characters
			// which must be escaped.
			save.mp_ids = [];
			save.geodesCracked = [];
			save.mysteryBoxesOpened = [];
			save.ticketPrizesClaimed = [];
			save.timesEnchanted = [];
			save.trashCansChecked = [];
			save.visitsUntilY1Guarantee = Number($(xmlDoc).find('SaveGame > visitsUntilY1Guarantee').text());
			save.farmName = $(xmlDoc).find('SaveGame > player > farmName').html() + ' Farm (' + farmTypes[$(xmlDoc).find('whichFarm').text()] + ')';
			save.names.push($(xmlDoc).find('SaveGame > player > name').html());
			save.gender.push($(xmlDoc).find('SaveGame > player > gender').text());
			// stats can be in multiple places. In 1.2 they were under SaveGame, but in 1.3 they moved under the
			// player and farmhand elements to support multiplayer. Then 1.6 changed both where the farmhands
			// are stored and how the stats are stored. Most stat processing is now done in this section
			if (compareSemVer(save.version, "1.3") >= 0) {
				save.mp_ids.push(bigInt($(xmlDoc).find('SaveGame > player > UniqueMultiplayerID').text()));
			}
			if (compareSemVer(save.version, "1.6") >= 0) {
				// some of these can be missing so we need to initialize to zero.
				var geodesCracked = 0,
					mysteryBoxesOpened = 0,
					ticketPrizesClaimed = 0,
					timesEnchanted = 0,
					trashCansChecked = 0;
				$(xmlDoc).find('SaveGame > player > stats > Values > item').each(function() {
					var key = $(this).find('key > string').text();
					var value = $(this).find('value > *').text();
					if (key === 'geodesCracked') {
						geodesCracked = Number(value);
					} else if (key === 'daysPlayed') {
						save.daysPlayed = Number(value);
					} else if (key === 'MysteryBoxesOpened') {
						mysteryBoxesOpened = Number(value);
					} else if (key === 'ticketPrizesClaimed') {
						ticketPrizesClaimed = Number(value);
					} else if (key === 'timesEnchanted') {
						timesEnchanted = Number(value);
					} else if (key === 'trashCansChecked') {
						trashCansChecked = Number(value);
					} else if (key === 'Book_Trash') {
						if (Number(value) > 0) {
							save.hasGarbageBook = true;
						}
					}
				});
				save.geodesCracked.push(geodesCracked);
				save.mysteryBoxesOpened.push(mysteryBoxesOpened);
				save.ticketPrizesClaimed.push(ticketPrizesClaimed);
				save.timesEnchanted.push(timesEnchanted);
				save.trashCansChecked.push(trashCansChecked);
				$(xmlDoc).find('farmhands > Farmer').each(function() {
					var name = $(this).find('name').html();
					var user = $(this).find('userID').text();
					geodesCracked = 0;
					mysteryBoxesOpened = 0;
					timesEnchanted = 0;
					if (name !== '' && user !== '') {
						save.names.push(name);
						save.gender.push($(this).children('gender').first().text());
						save.mp_ids.push(bigInt($(this).find('UniqueMultiplayerID').text()));
						$(this).find('stats > Values > item').each(function() {
							var key = $(this).find('key > string').text();
							var value = $(this).find('value > *').text();
							if (key === 'geodesCracked') {
								geodesCracked = Number(value);
							} else if (key === 'MysteryBoxesOpened') {
								mysteryBoxesOpened = Number(value);
							} else if (key === 'ticketPrizesClaimed') {
								ticketPrizesClaimed = Number(value);
							} else if (key === 'timesEnchanted') {
								timesEnchanted = Number(value);
							} else if (key === 'trashCansChecked') {
								trashCansChecked = Number(value);
							}
						});
						save.geodesCracked.push(geodesCracked);
						save.mysteryBoxesOpened.push(mysteryBoxesOpened);
						save.ticketPrizesClaimed.push(ticketPrizesClaimed);
						save.timesEnchanted.push(timesEnchanted);
						save.trashCansChecked.push(trashCansChecked);
					}
				});
				// some other things that 1.6 adds/changes are good to put here
				save.timesFedRaccoons = Number($(xmlDoc).find("SaveGame > timesFedRaccoons").text()),
				save.useLegacyRandom = ($(xmlDoc).find('useLegacyRandom').text() === 'true');
				save.geodeContents[275].push("_Book_Artifact");
			} else if (compareSemVer(save.version, "1.3") >= 0) {
				save.mp_ids.push(bigInt($(xmlDoc).find('SaveGame > player > UniqueMultiplayerID').text()));
				save.geodesCracked.push(Number($(xmlDoc).find('SaveGame > player > stats > geodesCracked').text()));
				$(xmlDoc).find('farmhand').each(function() {
					save.names.push($(this).find('name').html());
					save.gender.push( $(this).find('isMale').first().text() == "true" ? "Male" : "Female" );
					save.mp_ids.push(bigInt($(this).find('UniqueMultiplayerID').text()));
					save.geodesCracked.push(Number($(this).find('stats > geodesCracked').text()));
				});
				save.daysPlayed = Number($(xmlDoc).find('stats > daysPlayed').first().text());
				// version 1.4 had a stat_dictionary that was similar to the way all stats are stored in 1.6
				// We need to check the trashCansChecked stat from it and also the timesEnchanted stat that
				// was actually added to that dictionary in 1.5
				if (compareSemVer(save.version, "1.4") >= 0) {
					var timesEnchanted = 0,
						trashCansChecked = 0;
					$(xmlDoc).find('SaveGame > player > stats > stat_dictionary > item').each(function() {
						var key = $(this).find('key > string').text();
						if (key === "timesEnchanted") {
							timesEnchanted = Number($(this).find('value > unsignedInt').text());
						} else if (key === 'trashCansChecked') {
							trashCansChecked = Number($(this).find('value > unsignedInt').text());
						}
					});
					save.timesEnchanted.push(timesEnchanted);
					save.trashCansChecked.push(trashCansChecked);
					$(xmlDoc).find('farmhand').each(function() {
						timesEnchanted = 0;
						trashCansChecked = 0;
						$(this).find('stats > stat_dictionary > item').each(function() {
							var key = $(this).find('key > string').text();
							if (key === "timesEnchanted") {
								timesEnchanted = Number($(this).find('value > unsignedInt').text());
							} else if (key === 'trashCansChecked') {
								trashCansChecked = Number($(this).find('value > unsignedInt').text());
							}
						});
						save.timesEnchanted.push(timesEnchanted);
						save.trashCansChecked.push(trashCansChecked);
					});
				}
			} else {
				save.geodesCracked.push(Number($(xmlDoc).find('SaveGame > stats > geodesCracked').text()));
				save.daysPlayed = Number($(xmlDoc).find('stats > daysPlayed').first().text());
			}

			if (save.trashCansChecked.length === 0) { save.trashCansChecked.push(0); }
			if (save.timesEnchanted.length === 0) { save.timesEnchanted.push(0); }
			if (save.mysteryBoxesOpened.length === 0) { save.mysteryBoxesOpened.push(0); }
			// Date originally used XXForSaveGame elements, but those were not always present on saves downloaded from upload.farm
			save.year = Number($(xmlDoc).find('SaveGame > year').first().text());
			save.niceDate = 'Day ' + Number($(xmlDoc).find('SaveGame > dayOfMonth').text()) + ' of ' +
				capitalize($(xmlDoc).find('SaveGame > currentSeason').html()) + ', Year ' + save.year;
			if (compareSemVer(save.version, "1.5") >= 0) {
				save.hardmodeMines = Number($(xmlDoc).find('SaveGame > minesDifficulty').text()) > 0;
			}
			save.deepestMineLevel = Number($(xmlDoc).find('player > deepestMineLevel').text());
			// Donation status used to be limited to items which could be found in geodes. We now store everything.
			$(xmlDoc).find('locations > GameLocation').each(function () {
				if ($(this).attr(save.ns_prefix + ':type') === 'LibraryMuseum') {
					$(this).find('museumPieces > item').each(function () {
						var id = "_" + $(this).find('value > *').text();
						// makes sure mod items don't break the parse.
						if (save.objects.hasOwnProperty(id)) {
							save.donatedItems[save.objects[id].name] = 1;
						}
					});
				}
			});
			// Need to know if the baby question is possible. For now, only doing for 1.2
			save.canHaveChildren = false;
			if (compareSemVer(save.version, "1.3") < 0) {
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
			// Quarry unlock needed for mine predictions, desert for Garbage Can, greenhouse for night events.
			var sawTheater = false;
			var sawJojaTheater = false;
			$(xmlDoc).find('player > mailReceived > string').each(function () {
				var id = $(this).text();
				if (id === 'ccCraftsRoom') {
					save.quarryUnlocked = true;
				} else if (id === 'ccPantry') {
					save.greenhouseUnlocked = true;
				} else if (id === 'ccVault') {
					save.desertUnlocked = true;
				} else if (id === 'ccMovieTheater') {
					sawTheater = true;
				} else if (id === 'ccMovieTheaterJoja') {
					sawJojaTheater = true;
				} else if (id === 'HasSpecialCharm') {
					save.hasSpecialCharm = true;
				} else if (id === 'GotMysteryBook') {
					save.gotMysteryBook = true;
				} else if (id === 'leoMoved') {
					save.leoMoved = true;
				}
			});
			save.theaterUnlocked = (sawTheater && !sawJojaTheater);
			if (compareSemVer(save.version, "1.6") < 0) {
				// This is a mail flag in 1.6 (see above) but was a separate element before that
				if ($(xmlDoc).find('player > hasSpecialCharm').text() === "true") {
					save.hasSpecialCharm = true;
				}
			}
			// The furnace unlock is necessary for Garbage Can predictions. As this
			// is player-specific, we will just check the host.
			$(xmlDoc).find('player > craftingRecipes > item').each(function () {
				var id = $(this).find('key > string').text();
				if (id === 'Furnace') {
					save.hasFurnaceRecipe = true;
				}
			});

			$(xmlDoc).find('player > eventsSeen > *').each(function () {
				if ($(this).text() === '191393') {
					save.ccComplete = true;
				} else if ($(this).text() === '502261') {
					// The game actually does a complicated mail flag check for this
					save.jojaComplete = true;
				}
			});

			// Let's try to build a list of NPCs. This sorta follows the logic of Utility.getAllCharacters() and we
			//  also need to filter out monsters and such now since the later logic that follows CanVisitIslandToday() will
			//  not have access to those fields. Reusing some code from Stardew Checkup to do this.
			var includeKrobus = false;
			var ignore = {
				'Horse': 1,
				'Cat': 1,
				'Dog': 1,
				'Fly': 1,
				'Grub': 1,
				'GreenSlime': 1,
				'Gunther': 1,
				'Marlon': 1,
				'Bouncer': 1,
				'Mister Qi': 1,
				'Henchman': 1,
				'Birdie': 1,
				'Child': 1,
				'Pet': 1,
				'Fizz': 1,
				'Raccoon': 1
			};
			$(xmlDoc).find('player > friendshipData > item').each(function () {
				var who = $(this).find('key > string').html();
				// We used to check for meeting Leo here but now we handle him differently
				if (who === 'Krobus') {
					var status = $(this).find('value > Friendship > Status').html();
					if (status !== 'Unmet') {
						includeKrobus = true;
					}
				}
			});
			save.characters = [];
			$(xmlDoc).find('locations > GameLocation').each(function () {
				$(this).find('characters').each(function () {
					$(this).find('NPC').each(function () {
						var who = $(this).find('name').html();
						var type = $(this).attr(save.ns_prefix + ':type');
						// Filter out animals and monsters and other undesirables
						if (ignore.hasOwnProperty(type) || ignore.hasOwnProperty(who)) {
							return true;
						}
						if (who === 'Leo') {
							if (save.leoMoved) {
								save.characters.push(who);
							}
						} else if (who === 'Krobus') {
							if (includeKrobus) {
								save.characters.push(who);
							}
						} else if (who === 'Sandy') {
							if (save.desertUnlocked) {
								save.characters.push(who);
							}
						} else {
							save.characters.push(who);
						}
					});
				});
			});
			// Qi Crops Special Order
			if (compareSemVer(save.version, "1.5") >= 0) {
				var beanRegex = /DROP_QI_BEANS/;
				$(xmlDoc).find('SaveGame > specialOrders > SpecialOrder').each(function () {
					var rules = $(this).find('specialRule').text();
					if (rules.match(beanRegex)) {
						save.qiCropsActive = true;
						return false;
					}
				});
			}
		}

		// Parse URL parameters to override values in save or defaults
		var wasChanged = {};
		wasChanged.version = overrideSaveData("version", "version", "v", "text");
		wasChanged.gameID = overrideSaveData("gameID", "gameID", "id", "bigint");
		wasChanged.dayAdjust = overrideSaveData("dayAdjust", "dayAdjust", "da", "int");
		wasChanged.daysPlayed = overrideSaveData("daysPlayed", "daysPlayed", "dp", "int");
		if (save.dayAdjust > 0 || wasChanged.daysPlayed) {
			save.year = 1 + Math.floor( (save.daysPlayed + save.dayAdjust) / 112);
			save.niceDate = '';
		}
		wasChanged.geodesCracked = overrideSaveData("geodesCracked", "geodesCracked", "gc", "array");
		wasChanged.mysteryBoxesOpened = overrideSaveData("mysteryBoxesOpened", "mysteryBoxesOpened", "mb", "array");
		wasChanged.ticketPrizesClaimed = overrideSaveData("ticketPrizesClaimed", "ticketPrizesClaimed", "pt", "array");
		wasChanged.timesEnchanted = overrideSaveData("timesEnchanted", "timesEnchanted", "te", "array");
		wasChanged.trashCansChecked = overrideSaveData("trashCansChecked", "trashCansChecked", "tc", "array");
		wasChanged.deepestMineLevel = overrideSaveData("deepestMineLevel", "deepestMineLevel", "dml", "int");
		wasChanged.timesFedRaccoons = overrideSaveData("timesFedRaccoons", "timesFedRaccoons", "tfr", "int");
		wasChanged.visitsUntilY1Guarantee = overrideSaveData("visitsUntilY1Guarantee", "visitsUntilY1Guarantee", "vg", "int");
		wasChanged.dailyLuck = overrideSaveData("dailyLuck", "dailyLuck", "dl", "num");
		wasChanged.luckLevel = overrideSaveData("luckLevel", "luckLevel", "ll", "int");
		wasChanged.canHaveChildren = overrideSaveData("canHaveChildren", "canHaveChildren", "chc", "bool");
		wasChanged.quarryUnlocked = overrideSaveData("quarryUnlocked", "quarryUnlocked", "qu", "bool");
		wasChanged.desertUnlocked = overrideSaveData("desertUnlocked", "desertUnlocked", "du", "bool");
		wasChanged.greenhouseUnlocked = overrideSaveData("greenhouseUnlocked", "greenhouseUnlocked", "gu", "bool");
		wasChanged.hasFurnaceRecipe = overrideSaveData("hasFurnaceRecipe", "hasFurnaceRecipe", "hfr", "bool");
		wasChanged.hasSpecialCharm = overrideSaveData("hasSpecialCharm", "hasSpecialCharm", "hsc", "bool");
		wasChanged.leoMoved = overrideSaveData("leoMoved", "leoMoved", "leo", "bool");
		wasChanged.hasGarbageBook = overrideSaveData("hasGarbageBook", "hasGarbageBook", "hgb", "bool");
		wasChanged.gotMysteryBook = overrideSaveData("gotMysteryBook", "gotMysteryBook", "gmb", "bool");
		wasChanged.hardmodeMines = overrideSaveData("hardmodeMines", "hardmodeMines", "hm", "bool");
		wasChanged.useLegacyRandom = overrideSaveData("useLegacyRandom", "useLegacyRandom", "leg", "bool");
		wasChanged.theaterUnlocked = overrideSaveData("theaterUnlocked", "theaterUnlocked", "tu", "bool");
		wasChanged.ccComplete = overrideSaveData("ccComplete", "ccComplete", "cc", "bool");
		wasChanged.jojaComplete = overrideSaveData("jojaComplete", "jojaComplete", "jc", "bool");
		wasChanged.qiCropsActive = overrideSaveData("qiCropsActive", "qiCropsActive", "qc", "bool");
		
		// It is easier to deal with the guaranteed red cabbage if we knew the value on day 1 of the save.
		// We reverse-engineer the original value unless URL parameter forces us to reroll.
		save.originalGuarantee = -1;
		if (save.visitsUntilY1Guarantee >= 0) {
			var dayOfSave = save.daysPlayed + save.dayAdjust;
			save.originalGuarantee = save.visitsUntilY1Guarantee + Math.floor(dayOfSave/7) + Math.floor((dayOfSave + 2)/7);
			if (dayOfSave >= 99) { save.originalGuarantee++; }
			if (dayOfSave >= 100) { save.originalGuarantee++; }
			if (dayOfSave >= 101) { save.originalGuarantee++; }
		} else if (save.visitsUntilY1Guarantee == -99) {
			var rng = new CSRandom(12*save.gameID);
			save.originalGuarantee = rng.Next(2, 31);
		}
		save.dailyLuck = Math.min(0.1, Math.max(-0.1, save.dailyLuck));
		// Add share URL. dayAdjust and all boolean options only included if non-default
		var share_URL = window.location.protocol + '//' + window.location.host + window.location.pathname + "?id=" + save.gameID +
			"&amp;v=" + save.version + "&amp;dp=" + save.daysPlayed + "&amp;dl=" + save.dailyLuck + "&amp;ll=" + save.luckLevel +
			"&amp;dml=" + save.deepestMineLevel + "&amp;vg=" + save.visitsUntilY1Guarantee + "&amp;gc=" + save.geodesCracked[0] +
			"&amp;mb=" + save.mysteryBoxesOpened[0] + "&amp;te=" + save.timesEnchanted[0] + "&amp;tc=" + save.trashCansChecked[0] +  
			"&amp;pt=" + save.ticketPrizesClaimed[0] + "&amp;tfr=" + save.timesFedRaccoons + 
			(save.dayAdjust !== 0 ? ("&amp;da=" + save.dayAdjust) : "") +
			(save.canHaveChildren ? "&amp;chc=" : "") +
			(save.quarryUnlocked ? "&amp;qu=1" : "") +
			(save.desertUnlocked ? "&amp;du=1" : "") +
			(save.greenhouseUnlocked ? "&amp;gu=1" : "") +
			(save.ccComplete ? "&amp;cc=1" : "") +
			(save.jojaComplete ? "&amp;jc=1" : "") +
			(save.theaterUnlocked ? "&amp;tu=1" : "") +
			(save.hasFurnaceRecipe ? "&amp;hfr=1" : "") +
			(save.hasSpecialCharm ? "&amp;hsc=1" : "") +
			(save.leoMoved ? "&amp;leo=1" : "") +
			(save.hasGarbageBook ? "&amp;hgb=1" : "") +
			(save.gotMysteryBook ? "&amp;gmb=1" : "") +
			(save.hardmodeMines ? "&amp;hm=1" : "") +
			(save.qiCropsActive ? "&amp;qc=1" : "") +
			(save.useLegacyRandom ? "&amp;leg=1" : "");
		$("#share_URL").html('<a href="' + share_URL + '">' + share_URL + '</a>');

		// Now that the save and/or URL parameters have been parsed, we can make some price changes.
		// We really only care about things that are involved in price predictions such as the Traveling Cart but this may
		// include other items as well.
		if (compareSemVer(save.version, "1.1") < 0) {
			save.objects["_424"].price = 160;
			save.objects["_426"].price = 300;
			save.objects["_444"].price = 100;
		} else if (compareSemVer(save.version, "1.4") < 0) {
			save.objects["_424"].price = 200;
			save.objects["_426"].price = 375;
		} else if (compareSemVer(save.version, "1.5") < 0) {
			save.objects["_444"].price = 175;
		} else if (compareSemVer(save.version, "1.6") < 0) {
			save.objects["_251"].price = 500;
			save.objects["_459"].price = 200;
			save.objects["_773"].price = 500;
		}
		// Finally we prepare the summary
		if (save.gameID === null) {
			return '<span class="error">Fatal Error: Problem reading save file and no ID passed via query string.</span>';
		}
		output += '<h3>Save State Summary</h3><p>Important information taken from the save file which is needed for predictions. Anything that was overridden by <a href="#advanced_usage">a URL parameter</a> is marked with an asterisk (*).</p>';
		output += '<table class="summary"><tr><td>';
		output += '<span class="result">' + (wasChanged.gameID ? "*":'') + 'Game ID: ' + save.gameID + '</span><br/>';
		output += '<span class="result">' + (wasChanged.version ? "*":'') + 'Stardew version: ' + save.version + '</span><br/>';
		if (save.names.length === 0) { save.names[0] = "Unknown Farmer"; }
		output += '<span class="result">Farmer ' + save.names[0] + ' of ' + save.farmName + '</span><br/>';
		if (save.names.length > 1) {
			output += '<span class="result">Farmhands: ' + save.names.slice(1).join(', ') + '</span><br/>';
		}
		if (save.niceDate !== '') {
			output += '<span class="result">' + save.niceDate + ' (' + save.daysPlayed + ' days played)</span><br/>\n';
		} else {
			output += '<span class="result">' + ((wasChanged.daysPlayed || wasChanged.dayAdjust) ? '*' : '') +
				(save.daysPlayed + save.dayAdjust) + ' days played</span><br/>\n';
		}
		output += '<span class="result">' + (wasChanged.geodesCracked ? "*":'') + 'Geodes cracked: ';
		for (var i = 0; i < save.names.length; i++) {
			output += save.geodesCracked[i] + ' (' + save.names[i] + ') ';
		}
		output += '</span><br/>';
		if (compareSemVer(save.version, "1.6") >= 0) {
			output += '<span class="result">' + (wasChanged.mysteryBoxesOpened ? "*":'') + 'Mystery Boxes opened: ';
			for (var i = 0; i < save.names.length; i++) {
				output += save.mysteryBoxesOpened[i] + ' (' + save.names[i] + ') ';
			}
			output += '</span><br/>';
			output += '<span class="result">' + (wasChanged.ticketPrizesClaimed ? "*":'') + 'Prize Tickets claimed: ';
			for (var i = 0; i < save.names.length; i++) {
				output += save.ticketPrizesClaimed[i] + ' (' + save.names[i] + ') ';
			}
			output += '</span><br/>';
		}
		if (compareSemVer(save.version, "1.5") >= 0) {
			output += '<span class="result">' + (wasChanged.timesEnchanted ? "*":'') + 'Times enchanted: ';
			for (var i = 0; i < save.names.length; i++) {
				output += save.timesEnchanted[i] + ' (' + save.names[i] + ') ';
			}
			output += '</span><br/>';
		}
		output += '<span class="result">' + (wasChanged.trashCansChecked ? "*":'') + 'Trash cans checked: ';
		for (var i = 0; i < save.names.length; i++) {
			output += save.trashCansChecked[i] + ' (' + save.names[i] + ') ';
		}
		output += '</span><br/>';
		output += '<span class="result">' + (wasChanged.deepestMineLevel ? "*":'') + 'Deepest mine level: ' + Math.min(120, save.deepestMineLevel) + '</span><br/>';
		output += '<span class="result">' + (wasChanged.timesFedRaccoons ? "*":'') + 'Times fed raccoons: ' + save.timesFedRaccoons + '</span><br/>';
		output += '<span class="result">' + (wasChanged.visitsUntilY1Guarantee ? "*":'') + 'Cart Y1 Guarantee: ';
		if (save.visitsUntilY1Guarantee >= 0) {
			output += save.visitsUntilY1Guarantee + " visits left";
		} else if (save.originalGuarantee > 0) {
			output += save.originalGuarantee + " visits originally rolled";
		} else {
			output += " not active or already past";
		}
		output += '</span><br/>';
		output += '<span class="result">' + (wasChanged.dailyLuck ? "*":'') + 'Daily Luck is assumed to be ' + save.dailyLuck + '</span><br/>';
		output += '<span class="result">' + (wasChanged.luckLevel ? "*":'') + 'Luck buffs are assumed to be ' + save.luckLevel + '</span><br/>';
		output += '</td><td>';
		
		output += '<span class="result">' + (wasChanged.useLegacyRandom ? "*":'') + 'Legacy RNG Seeding is ' + (save.useLegacyRandom ? "on" : "off") +
			'</span><br/>';
		output += '<span class="result">' + (wasChanged.quarryUnlocked ? "*":'') + 'Quarry is ' + (save.quarryUnlocked ? "" : "not") +
			' unlocked</span><br/>';
		output += '<span class="result">' + (wasChanged.desertUnlocked ? "*":'') + 'Desert is ' + (save.desertUnlocked ? "" : "not") +
			' unlocked</span><br/>';
		output += '<span class="result">' + (wasChanged.greenhouseUnlocked ? "*":'') + 'Greenhouse is ' + (save.greenhouseUnlocked ? "" : "not") +
			' unlocked</span><br/>';
		output += '<span class="result">' + (wasChanged.ccComplete ? "*":'') + 'Community Center is ' + (save.ccComplete ? "" : "not") +
			' complete</span><br/>';
		output += '<span class="result">' + (wasChanged.jojaComplete ? "*":'') + 'Joja Community Development is ' + (save.jojaComplete ? "" : "not") +
			' complete</span><br/>';
		output += '<span class="result">' + (wasChanged.theaterUnlocked ? "*":'') + 'Theater is ' + (save.theaterUnlocked ? "" : "not") +
			' unlocked</span><br/>';
		if (compareSemVer(save.version, "1.3") < 0) {
			output += '<span class="result">' + (wasChanged.canHaveChildren ? "*":'') + 'Farmer can' + (save.canHaveChildren ? "" : "not") +
			' have more children</span><br/>';
		}
		output += '<span class="result">' + (wasChanged.hasFurnaceRecipe ? "*":'') + 'Farmer ' + (save.hasFurnaceRecipe ? "has" : "does not have") +
			' furnace recipe</span><br/>';
		output += '<span class="result">' + (wasChanged.hasSpecialCharm ? "*":'') + 'Farmer ' + (save.hasSpecialCharm ? "has" : "does not have") +
			' special luck charm</span><br/>';
		output += '<span class="result">' + (wasChanged.hasGarbageBook ? "*":'') + 'Farmer has ' + (save.hasGarbageBook ? "" : "not") +
			' read <span class="book">The Alleyway Buffet</span></span><br/>';
		output += '<span class="result">' + (wasChanged.gotMysteryBook ? "*":'') + 'Farmer has ' + (save.gotMysteryBook ? "" : "not") +
			' gotten <span class="book">Mystery Book</span> from Mystery Boxes</span><br/>';
		output += '<span class="result">' + (wasChanged.leoMoved ? "*":'') + 'Leo has ' + (save.leoMoved ? "" : "not") +
			' moved to the Valley</span><br/>';
		output += '<span class="result">' + (wasChanged.hardmodeMines ? "*":'') + 'Mines are ' + (save.hardmodeMines ? "" : "not") +
			' currently hard difficulty</span><br/>';
		output += '<span class="result">' + (wasChanged.qiCropsActive ? "*":'') + 'Qi Crops special order is ' + (save.qiCropsActive ? "" : "not") +
			' active</span><br/>';
		output += '</td></tr></table>';
		return output;
	}

	function buttonHandler(button) {
		// This assumes there is only 1 set of buttons and that the updateTab function has only 2 parameters,
		// but there are exceptions
		var field = button.id.split('-');
		var tab = field[0];
		if (tab === 'cj') {
			var which = field[1];
			if (which === 'd') {
				if (typeof(button.value) === 'undefined' || button.value === 'reset') {
					updateTab(tab, false);
				} else {
					updateTab(tab, false, Number(button.value));
				}
			} else {
				// Preserve current offset and change extra parameter
				var offset = Number($("#" + tab + "-d-next-day").val()) - 1;
				if (typeof(button.value) === 'undefined' || button.value === 'reset') {
					updateTab(tab, false, offset);
				} else {
					updateTab(tab, false, offset, Number(button.value));
				}				
			}
		} else {
			if (typeof(button.value) === 'undefined' || button.value === 'reset') {
				updateTab(tab, false);
			} else {
				updateTab(tab, false, Number(button.value));
			}
		}
	}

	function selectHandler(element) {
		// Assumes there are also browse buttons which can be used to find current offset
		var field = element.id.split('-');
		var tab = field[0];
		var offset = Number($("#" + tab + "-next").val()) - 20;
		updateTab(tab, false, offset);
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
			dinoLevel,
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
				dinoLevel = [];
				day = 7 * week + weekDay + offset;
				// This is unlike other pages because there is no search capability. Instead, we just have separate logic
				// based on different versions since RNG seeding was changed in 1.4
				// Start with logic for 1.3 & earlier
				if (compareSemVer(save.version, "1.4") < 0) {
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
						if (compareSemVer(save.version, "1.6") < 0) {
							rng = new CSRandom(day + save.dayAdjust + mineLevel*100 + save.gameID / 2);
						} else {
							rng = new CSRandom(getRandomSeed(day + save.dayAdjust, save.gameID/2, mineLevel*100));
						}
						if (rng.NextDouble() < 0.044 && mineLevel % 40 > 5 && mineLevel % 40 < 30 && mineLevel % 40 !== 19) {

							if (rng.NextDouble() < 0.5) {
								infestedMonster.push(mineLevel);
							} else {
								infestedSlime.push(mineLevel);
							}
							skipMushroomCheck = true;
						} else if (rng.NextDouble() < 0.044 && save.quarryUnlocked && mineLevel % 40 > 1 ) {
							// 1.5 removed possibility of infested quarry levels.
							if (rng.NextDouble() < 0.25 && compareSemVer(save.version, "1.5") < 0) {
								quarryLevel.push(mineLevel + '*');
							} else {
								quarryLevel.push(mineLevel);
							}
							skipMushroomCheck = true;
						}
						if (skipMushroomCheck) {
							continue;
						}
						// Reset the seed for checking Mushrooms. Note, there are a couple checks related to
						// darker than normal lighting. We don't care about the results but need to mimic them.
						if (compareSemVer(save.version, "1.6") < 0) {
							rng = new CSRandom((day + save.dayAdjust) * mineLevel + (4 * mineLevel) + save.gameID / 2);
						} else {
							rng = new CSRandom(getRandomSeed(day + save.dayAdjust, save.gameID/2, day + save.dayAdjust, mineLevel, 4 * mineLevel));
						}
						if (!save.hardmodeMines) {
							if (rng.NextDouble() < 0.3 && mineLevel > 2) {
								rng.NextDouble(); // checked vs < 0.3 again
							}
						}
						rng.NextDouble(); // checked vs < 0.15
						if (rng.NextDouble() < 0.035 && mineLevel > 80) {
							rainbowLights.push(mineLevel);
						}
					}
					// We are now checking Skull Cavern for Dino levels too. I am arbitrarily choosing 500 Skull Cavern
					// levels as the cutoff point, and duplicating some of the similar code checks here.
					// The game's Dino check has a >126 component, so we just start at 127.
					// Unfortunately, the game chooses a map to use first, and that choice is not predictable. We are
					// assuming that that check always passes so that we get a list of *potential* dino levels.
					for (mineLevel = 127; mineLevel < 621; mineLevel++) {
						if (compareSemVer(save.version, "1.6") < 0) {
							rng = new CSRandom(day + save.dayAdjust + mineLevel*100 + save.gameID / 2);
						} else {
							rng = new CSRandom(getRandomSeed(day + save.dayAdjust, save.gameID/2, mineLevel*100));
						}
						if (rng.NextDouble() < 0.044) {
							if (rng.NextDouble() < 0.5) {
								//infestedMonster.push(mineLevel);
							} else {
								//infestedSlime.push(mineLevel);
							}
							if (rng.NextDouble() < 0.5) {
								dinoLevel.push(mineLevel-120);
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
				}
				var mushroomText = '<img src="blank.png" class="small-icon" alt="Mushroom" id="icon_m">&nbsp;';
				if (rainbowLights.length === 0) {
					mushroomText = '<span class="none">' + mushroomText + 'None</span>';
				} else {
					if (rainbowLights.length > 5) {
						mushroomText = '<span data-tooltip="All results: ' + rainbowLights + '">' + mushroomText +
							rainbowLights.slice(0,4).join(',&nbsp;') + ',...</span>';
					} else {
						mushroomText += rainbowLights.join(',&nbsp;');
					}
				}
				var infestedText = '<img src="blank.png" class="small-icon" alt="Sword" id="icon_i">&nbsp;';
				if (infestedMonster.length === 0) {
					infestedText = '<span class="none">' + infestedText + 'None</span>';
				} else {
					if (infestedMonster.length > 5) {
						infestedText = '<span data-tooltip="All results: ' + infestedMonster + '">' + infestedText +
							infestedMonster.slice(0,4).join(',&nbsp;') + ',...</span>';
					} else {
						infestedText += infestedMonster.join(',&nbsp;');
					}
				}
				var slimeText = '<img src="blank.png" class="small-icon" alt="Slime" id="icon_s">&nbsp;';
				if (infestedSlime.length === 0) {
					slimeText = '<span class="none">' + slimeText + 'None</span>';
				} else {
					if (infestedSlime.length > 5) {
						slimeText = '<span data-tooltip="All results: ' + infestedSlime + '">' + slimeText +
							infestedSlime.slice(0,4).join(',&nbsp;') + ',...</span>';
					} else {
						slimeText += infestedSlime.join(',&nbsp;');
					}
				}
				var quarryText = '<img src="blank.png" class="small-icon" alt="Skull" id="icon_q">&nbsp;';
				if (quarryLevel.length === 0) {
					quarryText = '<span class="none">' + quarryText + 'None</span>';
				} else {
					if (quarryLevel.length > 5) {
						quarryText = '<span data-tooltip="All results: ' + quarryLevel + '">' + quarryText +
							quarryLevel.slice(0,4).join(',&nbsp;') + ',...</span>';
					} else {
						quarryText += quarryLevel.join(',&nbsp;');
					}
				}
				var dinoText = '<img src="blank.png" class="small-icon" alt="Dino" id="icon_d">&nbsp;';
				if (dinoLevel.length === 0) {
					dinoText = '<span class="none">' + dinoText + 'None</span>';
				} else {
					if (dinoLevel.length > 5) {
						dinoText = '<span data-tooltip="All results (level 1-500): ' + dinoLevel + '">' + dinoText +
							dinoLevel.slice(0,4).join(',&nbsp;') + ',...</span>';
					} else {
						dinoText += dinoLevel.join(',&nbsp;');
					}
				}
				output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br/>' +
					'<span class="cell">' + mushroomText +
					'<br/>' + infestedText +
					'<br/>' + slimeText +
					'<br/>' + quarryText +
					'<hr />' + dinoText + '</span></td>';
			}
			output += "</tr>\n";
		}
		output += '<tr><td colspan="7" class="legend">Regular Mine: <img src="blank.png" class="small-icon" alt="Mushroom" id="icon_m"> Mushroom Level | <img src="blank.png" class="small-icon" alt="Sword" id="icon_i"> Monster Infestation | <img src="blank.png" class="small-icon" alt="Slime" id="icon_s"> Slime Infestation | <img src="blank.png" class="small-icon" alt="Skull" id="icon_q"> Quarry Level (* = Infested; 1.4 only)<br/>Skull Cavern: <img src="blank.png" class="small-icon" alt="Dino" id="icon_d"> Potential Dinosaur Level (not guaranteed)</td></tr>';
		output += "</tbody></table>\n";
		return output;
	}

	function getRandomItemFromSeason(rng, season) {
		// This is a version of StardewValley.Utility.getRandomItemFromSeason() as it is used in the Garbage Can item determination.
		var possibleItems = ["Topaz","Amethyst","Cave Carrot","Quartz","Earth Crystal","Seaweed","Joja Cola","Green Algae","Red Mushroom"];
		if (save.deepestMineLevel > 40) {
			possibleItems.push("Aquamarine","Jade","Diamond","Frozen Tear","Purple Mushroom");
		}
		if (save.deepestMineLevel > 80) {
			possibleItems.push("Ruby","Emerald","Fire Quartz");
		}
		if (save.desertUnlocked) {
			possibleItems.push("Coconut","Cactus Fruit","Sandfish","Scorpion Carp");
		}
		if (save.hasFurnaceRecipe) {
			possibleItems.push("Copper Bar","Iron Bar","Gold Bar","Refined Quartz");
		}
		switch(season) {
			case 0:
				possibleItems.push("Wild Horseradish","Daffodil","Leek","Dandelion","Anchovy","Sardine","Bream","Largemouth Bass",
					"Smallmouth Bass","Carp","Catfish","Sunfish","Herring","Eel","Seaweed","Joja Cola","Flounder");
				break;
			case 1:
				possibleItems.push("Pufferfish","Tuna","Bream","Largemouth Bass","Rainbow Trout","Carp","Pike","Sunfish",
					"Red Mullet","Octopus","Red Snapper","Super Cucumber","Spice Berry","Grape","Sweet Pea","Flounder");
				break;
			case 2:
				possibleItems.push("Common Mushroom","Wild Plum","Hazelnut","Blackberry","Anchovy","Sardine","Bream","Largemouth Bass",
					"Smallmouth Bass","Salmon","Walleye","Carp","Catfish","Eel","Red Snapper","Sea Cucumber","Super Cucumber","Midnight Carp");
				break;
			case 3:
				possibleItems.push("Winter Root","Crystal Fruit","Snow Yam","Crocus","Tuna","Sardine","Bream","Largemouth Bass",
					"Walleye","Perch","Pike","Red Mullet","Herring","Red Snapper","Squid","Sea Cucumber","Midnight Carp");
				break;
		}
		return possibleItems[rng.Next(possibleItems.length)];
	}

	function predictTrash(isSearch, offset) {
		// original ref StardewValley.Locations.Town.checkAction()
		// changed in 1.6 to StardewValley.GameLocation.TryGetGarbageItem() along with datafile Data/GarbageCans
		var output = "",
			seed,
			rng,
			prewarm,
			i,
			mega,
			doubleMega,
			baseChancePassed,
			luckCheck = 0.2 + save.dailyLuck,
			whichCan,
			canList = ["Jodi", "Emily", "Mayor", "Museum", "Clint", "Saloon", "George", "Joja"],
			canID = ["JodiAndKent", "EmilyAndHaley", "Mayor", "Museum", "Blacksmith", "Saloon", "Evelyn", "JojaMart"],
			tileX = [13,19,56,108,97,47,52,110],
			tileY = [86,89,85,91,80,70,63,56],
			trashItem,
			goodStuff,
			day,
			weekDay,
			week,
			monthName,
			month,
			year,
			fallbackList = ["_153", "_216", "_403", "_309", "_310", "_311", "SEASON", "_168", "_167", "_170", "_171", "_172"],
			tclass;
		if (typeof(offset) === 'undefined') {
			offset = 28 * Math.floor(save.daysPlayed/28);
		}
		if (offset < 112) {
			$('#trash-prev-year').prop("disabled", true);
		} else {
			$('#trash-prev-year').val(offset - 112);
			$('#trash-prev-year').prop("disabled", false);
		}
		if (offset < 28) {
			$('#trash-prev-month').prop("disabled", true);
		} else {
			$('#trash-prev-month').val(offset - 28);
			$('#trash-prev-month').prop("disabled", false);
		}
		$('#trash-reset').val('reset');
		$('#trash-next-month').val(offset + 28);
		$('#trash-next-year').val(offset + 112);
		month = Math.floor(offset / 28);
		monthName = save.seasonNames[month % 4];
		year = 1 + Math.floor(offset / 112);
		output += '<table class="calendar"><thead><tr><th colspan="7">' + monthName + ' Year ' + year + '</th></tr>\n';
		output += '<tr><th>M</th><th>T</th><th>W</th><th>Th</th><th>F</th><th>Sa</th><th>Su</th></tr></thead>\n<tbody>';
		// Note luckCheck was initialized above to 0.2 + save.dailyLuck
		// The base 0.2 could technically vary per can but does not in vanilla Stardew. save.dailyLuck is assumed to be worst
		// possible value (-0.1) but can be overridden by URL parameters to alter the prediction.
		if (save.hasSpecialCharm) { luckCheck += 0.025; }
		if (compareSemVer(save.version, "1.6") >= 0 && save.hasGarbageBook) { luckCheck += .2; }
		for (week = 0; week < 4; week++) {
			output += "<tr>";
			for (weekDay = 1; weekDay < 8; weekDay++) {
				goodStuff = [];
				day = 7 * week + weekDay + offset;
				for (whichCan = 0; whichCan < 8; whichCan++) {
					if (compareSemVer(save.version, "1.6") >= 0) {
						seed = getRandomSeed(day + save.dayAdjust, save.gameID / 2, 777 + getHashFromString(canID[whichCan]));
					} else {
						seed = save.gameID / 2 + day + save.dayAdjust + 777 + whichCan * 77;
					}
					rng = new CSRandom(seed);
					// Code runs the prewarm routine twice
					prewarm = rng.Next(0,100);
					for (i = 0; i < prewarm; i++) {
						rng.NextDouble();
					}
					prewarm = rng.Next(0,100);
					for (i = 0; i < prewarm; i++) {
						rng.NextDouble();
					}
					trashItem = "";
					if (compareSemVer(save.version, "1.6") >= 0) {
						mega = false;
						doubleMega = false;
						baseChancePassed = (rng.NextDouble() < luckCheck);
						if (save.trashCansChecked[0] >= 20 && rng.NextDouble() < 0.002) {
							doubleMega = true;
							trashItem = wikify("Garbage Hat");
						} else if (save.trashCansChecked[0] >= 50 && rng.NextDouble() < 0.002) {
							doubleMega = true;
							trashItem = wikify("Trash Catalogue");
						}
						if (trashItem === "") {
							var rngSynced;
							if (save.qiCropsActive && rng.NextDouble() < 0.25) {
								trashItem = wikify("Qi Bean");
							} else if (baseChancePassed) {
								switch(whichCan) {
									case 4:
										if (rng.NextDouble() < (0.2 + save.dailyLuck)) {
											switch(rng.Next(3)) {
												case 0:	trashItem = wikify("Copper Ore"); break;
												case 1: trashItem = wikify("Iron Ore"); break;
												case 2: trashItem = wikify("Coal"); break;
											}
											var stack = rng.Next(1,5);
											if (stack > 1) {
												trashItem += " x" + stack;
											}
										}
										break;
									case 6:
										if (rng.NextDouble() < (0.2 + save.dailyLuck)) {
											trashItem = wikify("Cookie");
										}
										break;
									case 7:
										rngSynced = new CSRandom(getRandomSeed(getHashFromString("garbage_joja"), save.gameID, day + save.dayAdjust));
										if (rngSynced.NextDouble() < 0.2) {
											if (save.theaterUnlocked) {
												if (rng.Next(4) > 0) {
													trashItem = wikify("Corn");
												} else {
													trashItem = wikify("Movie Ticket");
												}
											} else if (!save.ccComplete) {
												trashItem = wikify("Joja Cola");
											}
										}
										break;
									case 3:
										rngSynced = new CSRandom(getRandomSeed(getHashFromString("garbage_museum_535"), save.gameID, day + save.dayAdjust));
										if (rngSynced.NextDouble() < (0.2 + save.dailyLuck)) {
											rngSynced = new CSRandom(getRandomSeed(getHashFromString("garbage_museum_749"), save.gameID, day + save.dayAdjust));
											if (rngSynced.NextDouble() < 0.05) {
												trashItem = wikify("Omni Geode");
											} else {
												trashItem = wikify("Geode");
											}
										}
										break;
									case 5:
										rngSynced = new CSRandom(getRandomSeed(getHashFromString("garbage_saloon_dish"), save.gameID, day + save.dayAdjust));
										if (rngSynced.NextDouble() < (0.2 + save.dailyLuck)) {
											trashItem = '<a href="https://stardewvalleywiki.com/The_Stardrop_Saloon#Rotating_Stock">Dish of the Day</a>';
										}
										break;
								}
							}
						}
						// AfterAll fallback checks
						if (trashItem === "") {
							mega = (save.trashCansChecked[0] >= 20 && rng.NextDouble() < 0.01);
							if (mega || baseChancePassed) {
								var roll = rng.Next(mega ? 7 : fallbackList.length);
								if (fallbackList[roll] === "SEASON") {
									trashItem = wikify(getRandomItemFromSeason(rng, month % 4));
								} else {
									trashItem = wikify(save.objects[fallbackList[roll]].name);
								}
							}
						}
					} else {
						mega = (rng.NextDouble() < 0.01) ? true : false;
						doubleMega = (save.trashCansChecked[0] >= 20 && rng.NextDouble() < 0.002) ? true : false;
						if (doubleMega) {
							trashItem = wikify("Garbage Hat");
						} else if (mega || rng.NextDouble() < luckCheck) {
							switch(rng.Next(10)) {
								case 0:	trashItem = wikify("Trash (item)"); break;
								case 1: trashItem = wikify("Joja Cola"); break;
								case 2: trashItem = wikify("Broken Glasses"); break;
								case 3: trashItem = wikify("Broken CD"); break;
								case 4: trashItem = wikify("Soggy Newspaper"); break;
								case 5: trashItem = wikify("Bread"); break;
								case 6: 
									//trashItem = wikify(getSeasonalItem(whichCan, month % 4, day)); break;
									var rngSeason = new CSRandom(save.gameID + day + save.dayAdjust + tileX[whichCan]*653 + tileY[whichCan]*777);
									trashItem = wikify(getRandomItemFromSeason(rngSeason, month % 4)); break;
								case 7: trashItem = wikify("Field Snack"); break;
								case 8:
									switch(rng.Next(3)) {
										case 0: trashItem = wikify("Acorn"); break;
										case 1: trashItem = wikify("Maple Seed"); break;
										case 2: trashItem = wikify("Pine Cone"); break;
									}
									break;
								case 9: trashItem = wikify("Green Algae"); break;
							}
							// Here is where the game checks for location-specific loot.
							if (whichCan === 3 && rng.NextDouble() < luckCheck) {
								trashItem = wikify("Geode");
								if (rng.NextDouble() < 0.05) {
									trashItem = wikify("Omni Geode");
								}
							}
							if (whichCan === 4 && rng.NextDouble() < luckCheck) {
								switch(rng.Next(3)) {
									case 0:	trashItem = wikify("Copper Ore"); break;
									case 1: trashItem = wikify("Iron Ore"); break;
									case 2: trashItem = wikify("Coal"); break;
								}
								rng.Next(1,5); // This seems a dead roll, but the game does it so we will too.
							}
							if (whichCan === 5 && rng.NextDouble() < luckCheck) {
								// can't wikify this one, so just hardcoding the URL
								trashItem = '<a href="https://stardewvalleywiki.com/The_Stardrop_Saloon#Rotating_Stock">Dish of the Day</a>';
							}
							if (whichCan === 6 && rng.NextDouble() < luckCheck) {
								trashItem = wikify("Cookie");
							}
							if (whichCan === 7 && rng.NextDouble() < 0.2) {
								trashItem = wikify("Joja Cola");
								if (rng.NextDouble() < 0.25) {
									trashItem += " or " + wikify("Movie Ticket");
								} else {
									trashItem += " or " + wikify("Corn");
								}
							}
						}
					}
					if (trashItem !== "") {
						var trashText = "<em>" + canList[whichCan] + ":</em> " + trashItem;
						if (doubleMega) {
							trashText = '<span class="strong">' + trashText + '</span>';
						}
						goodStuff.push(trashText);
					}
				}

				if (day < save.daysPlayed) {
					tclass = "past";
				} else if (day === save.daysPlayed) {
					tclass = "current";
				} else {
					tclass = "future";
				}

				var results = "";
				if (goodStuff.length === 0) {
					results = '<span class="none">None</span>';
				} else {
					results = goodStuff.sort().join(',<br/>');
				}
				output += '<td class="compact ' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br/>' +
					'<span class="cell">' + results + '</span></td>';
			}
			output += "</tr>\n";
		}
		//output += '<tr><td colspan="7" class="legend"></td></tr>';
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
			'<th class="wp-result"><img src="blank.png" class="dark icon" id="pierre"> Pierre\'s General Store</th>' +
			'<th class="wp-result"><img src="blank.png" class="dark icon" id="morris"> Joja Mart</th></tr></thead><tbody>';

		for (weekDay = 1; weekDay < 8; weekDay++) {
			day = weekDay + offset;
			if (compareSemVer(save.version, "1.6") >= 0) {
				// These are now pulled from Data/Shops
				// Game Wallpaper goes from 0-111 as well as 0-8 in MoreWalls
				// Game Flooring goes from 0-87 with just a single entry in MoreFloors
				rng_p =  new CSRandom(getRandomSeed(day + save.dayAdjust, save.gameID/2));
				rng_j =  new CSRandom(getRandomSeed(day + save.dayAdjust, save.gameID/2));
				wp_p = getRandomWallFloor(rng_p, 0, 111, 9, { 21: true})[0];
				fl_p = 1 + getRandomWallFloor(rng_p, 0, 55, 22)[0];
				wp_j = getRandomWallFloor(rng_j, 0, 111, 9, { 21: true})[0];
				fl_j = 1 + getRandomWallFloor(rng_j, 0, 39, 48)[0];
			} else {
				rng_p = new CSRandom(day + save.gameID / 2 + save.dayAdjust);
				rng_j = new CSRandom(day + save.gameID / 2 + 1 + save.dayAdjust);
				wp_p = rng_p.Next(112);
				fl_p = 1 + rng_p.Next(40);
				wp_j = rng_j.Next(112);
				if (wp_j === 21) {
					wp_j = 22;
				}
				fl_j = 1 + rng_j.Next(40);
			}
			if (save.wallpaperEquiv.hasOwnProperty(wp_p)) {
				eq_p = wikify(save.wallpaperEquiv[wp_p]);
			} else {
				eq_p = "(No valid equivalence)";
			}
			wp_p++;
			if (save.wallpaperEquiv.hasOwnProperty(wp_j)) {
				eq_j = wikify(save.wallpaperEquiv[wp_j]);
			} else {
				eq_j = "(No valid equivalence)";
			}
			wp_j++;
			if (day < save.daysPlayed) {
				tclass = "past";
			} else if (day === save.daysPlayed) {
				tclass = "current";
			} else {
				tclass = "future";
			}
			var showPierre = (save.ccComplete || weekDay !== 3);
			var showJoja = !save.ccComplete;
			output += '<tr><td class="' + tclass + '">' + save.dayNames[(day - 1) % 7] + '<br/>' +
				monthName + ' ' + ((day - 1) % 28 + 1) +', Year ' + year + '</td><td class="' + tclass + '">';
			output += showPierre ? ('<div class="wp"><img src="blank.png" class="wp left" id="wp_' + wp_p +
				'"><img src="blank.png" class="wp right" id="wp_' + wp_p + '"> ' + 'Wallpaper #' + wp_p + '<br/>' + eq_p + '<br/></div><br/>' +
				'<div class="fl"><img src="blank.png" class="fl" id="fl_' + fl_p + '"> ' + 'Floor # ' + fl_p + '</div>') :
				"(Closed)";
			output += '</td><td class="' + tclass + '">';
			output += showJoja ? ('<div class="wp"><img src="blank.png" class="wp left" id="wp_' + wp_j +
				'"><img src="blank.png" class="wp right" id="wp_' + wp_j + '"> ' + 'Wallpaper #' + wp_j + '<br/>' + eq_j + '<br/></div><br/>' +
				'<div class="fl"><img src="blank.png" class="fl" id="fl_' + fl_j + '"> ' + 'Floor # ' + fl_j + '</div>') :
				"(Closed)";
			output += '</td></tr>';
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
		if (compareSemVer(save.version, "1.4") >= 0) {
			var keepGoing = true;
			while (keepGoing) {
				itemID++;
				itemID %= 790;
				if (save.cartItems_1_4.hasOwnProperty(itemID)) {
					theItem.name = save.cartItems_1_4[itemID];
					theItem.price = Math.max(rng.Next(1,11)*100, save.objects["_" + itemID].price*rng.Next(3,6));
					theItem.qty = (rng.NextDouble() < 0.1) ? 5 : 1;
					//console.log(rng.Next(1,11));
					if (!(theItem.name in seenItems)) {
						seenItems[theItem.name] = 1;
						keepGoing = false;
					}
				}
			}
		} else {
			theItem.name = save.cartItems[itemID];
			// Although the cartItems data structure was made to handle invalid IDs, we no longer
			// keep a similar price structure and must iterate to get the prices.
			// The failsafe prevents an infinite loop in case of a naming mismatch between old and new logic
			var failsafe = 0;
			while(failsafe++ < 800 && (!save.objects.hasOwnProperty("_" + itemID) ||save.objects["_" + itemID].name !== theItem.name )) {
				itemID++;
				itemID %= 790;
			}
			theItem.price = Math.max(rng.Next(1,11)*100, save.objects["_" + itemID].price*rng.Next(3,6));
			theItem.qty = (rng.NextDouble() < 0.1) ? 5 : 1;
		}
		return theItem;
	}

	function predictCart(isSearch, offset) {
		// logic from StardewValley.Utility.getTravelingMerchantStock()
		// Note, we only handle Y1 Guarantee in 1.6 or later saves
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
		// 1.6 is way different so we just bail out into a different function
		if (compareSemVer(save.version, "1.6") >= 0) {
			return predictCart_1_6(isSearch, offset);
		}
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
				if (compareSemVer(save.version, "1.3") >= 0 && offset % 112 === 98) {
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
			if (compareSemVer(save.version, "1.3") >= 0 && offset % 112 === 94) {
				isNightMarket = true;
				$('#cart-next-week').val(offset + 4);
				$('#cart-prev-week').val(offset - 3);
				startDay = 0;
			} else {
				isNightMarket = false;
				startDay = 4;
				if (compareSemVer(save.version, "1.3") >= 0 && offset % 112 === 91) {
					// weekend before night market
					$('#cart-next-week').val(offset + 3);
					$('#cart-prev-week').val(offset - 7);
				} else if (compareSemVer(save.version, "1.3") >= 0 && offset % 112 === 98) {
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
			output += '<table class="output"><thead><tr><th rowspan="2">' + (isNightMarket ? 'Night Market<br/>Boat' : 'Forest Cart') + '</th>';
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

	function getRandomItems(rng, type, min, max, requirePrice, isRandomSale, doCategoryChecks = false, howMany = 1) {
		// partial implementation of StardewValley.Internal.ItemQueryResolver.DefaultResolvers.RANDOM_ITEMS()
		// with parameters specific to our limited needs
		// doCategoryChecks does the extra condition checks for the traveling cart's 10 random items
		var shuffledItems = {};
		for (const id in save[type]) {
			var key = rng.Next();
			if (isNaN(save[type][id].id)) {
				continue;
			}
			if (requirePrice && save[type][id].price == 0) {
				continue;
			}
			if (isRandomSale && save[type][id].offlimits) {
				continue;
			}
			var index = parseInt(save[type][id].id);
			if (index >= min && index <= max) {
				shuffledItems[key] = id;
			}
		}
		var selectedItems = [];
		var slot = 1;
		// All PerItemCondition checks happen here
		for (const key in shuffledItems) {
			if (doCategoryChecks && (save[type][shuffledItems[key]].category >= 0 || save[type][shuffledItems[key]].category === -999)) {
				continue;
			}
			if (doCategoryChecks && (save[type][shuffledItems[key]].type === 'Arch' || save[type][shuffledItems[key]].type === 'Minerals' || save[type][shuffledItems[key]].type === 'Quest')) {
				continue;
			}
			selectedItems.push(shuffledItems[key]);
			if (slot++ >= howMany) {
				break;
			}
		}
		return selectedItems;
	}

	function getRandomWallFloor(rng, min, max, extra, exclude = {}, howMany = 1) {
		// I don't even know where the wallpaper and floor data is defined and so we can't use the normal
		// getRandomItems() function which does checks against prices and such. Instead we have this hack
		// which just assumes everything in the range has a price and is not offlimits.
		// "extra" is for the number of IDs beyond the max that exist.
		var shuffledItems = {};
		for (var id = min; id <= max + extra; id++) {
			var key = rng.Next();
			shuffledItems[key] = id;
		}
		var selectedItems = [];
		var slot = 1;
		for (const key in shuffledItems) {
			if (exclude.hasOwnProperty(shuffledItems[key]) || shuffledItems[key] > max) {
				continue;
			}
			selectedItems.push(shuffledItems[key]);
			if (slot++ >= howMany) {
				break;
			}
		}
		return selectedItems;
	}

	function predictCart_1_6(isSearch, offset) {
		// logic from StardewValley.Internal.ShopBuilder.GetShopStock(), StardewValley.Internal.ItemQueryResolver.TryResolve(),
		// and Data/Shops
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
			name,
			searchTerm,
			searchStart,
			searchEnd,
			count,
			startDay,
			skillBookList = ["Stardew Valley Almanac", "Bait And Bobber", "Woodcutter's Weekly", "Mining Monthly", "Combat Quarterly"];
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
				var days = [5,7];
				var dayOfYear = offset % 112;
				if (dayOfYear === 98 || dayOfYear === 14) {
					days = [1,2,3,5,7];
				}
				month = Math.floor(offset / 28);
				monthName = save.seasonNames[month % 4];
				year = 1 + Math.floor(offset / 112);
				for (var i = 0; i < days.length; i++) {
					var seenRareSeed = false;
					dayOfMonth = offset % 28 + days[i];
					dayOfWeek = save.dayNames[days[i]-1];
					var rng =  new CSRandom(getRandomSeed(offset + days[i] + save.dayAdjust, save.gameID/2));
					var rngSynced;
					var pick = getRandomItems(rng, "objects", 2, 789, true, true, true, 10);
					var name, price, qty;
					for (var slot = 0; slot < 10; slot++) {
						price = Math.max(rng.Next(1,11) * 100, rng.Next(3,6) * save.objects[pick[slot]].price);
						qty = (rng.NextDouble() < 0.1) ? 5 : 1;
						if (save.objects[pick[slot]].name === 'Rare Seed') {
							seenRareSeed = true;
						}
						if (searchTerm.test(save.objects[pick[slot]].name)) {
							count++;
							output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
								wikify(save.objects[pick[slot]].name) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
						}
					}										
					if (save.originalGuarantee >= 0) {
						var dayOfPrediction = offset + days[i] + save.dayAdjust;
						var visitsNow = save.originalGuarantee - Math.floor(dayOfPrediction/7) - Math.floor((dayOfPrediction + 2)/7);
						if (dayOfPrediction >= 99) { visitsNow--; }
						if (dayOfPrediction >= 100) { visitsNow--; }
						if (dayOfPrediction >= 101) { visitsNow--; }
						if (visitsNow == 0) {
							name = save.objects["_485"].name;
							price = Math.max(rng.Next(1,11) * 100, rng.Next(3,6) * save.objects["_485"].price);
							qty = (rng.NextDouble() < 0.1) ? 5 : 1;
							if (searchTerm.test(name)) {
								count++;
								output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
									wikify(name) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
							}
						}
					}
					pick = getRandomItems(rng, "furniture", 0, 1612, true, true);
					name = save.furniture[pick[0]].name;
					price = rng.Next(1,11) * 250;
					if (searchTerm.test(name)) {
						count++;
						output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
							wikify(name, "Furniture") + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
					}
					if (month % 4 < 2) {
						if (!seenRareSeed) {
							name = 'Rare Seed';
							price = 1000;
							qty = (rng.NextDouble() < 0.1) ? 5 : 1;
							if (searchTerm.test(name)) {
								count++;
								output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
									wikify(name) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
							}
						}
					} else {
						rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_rarecrow"), save.gameID, offset + days[i] + save.dayAdjust));
						name = 'Rarecrow (Snowman)';
						if (rngSynced.NextDouble() < 0.4 && searchTerm.test(name)) {
							price = 4000;
							qty = 1;
							count++;
							output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
								wikify(name) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
						}
					}
					if (month % 4 > 1) {
						rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_coffee_bean"), save.gameID, offset + days[i] + save.dayAdjust));
						name = 'Coffee Bean';
						if (rngSynced.NextDouble() < 0.25 && searchTerm.test(name)) {
							price = 2500;
							qty = 1;
							count++;
							output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
								wikify(name) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
						}
					}
					rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_fez"), save.gameID, offset + days[i] + save.dayAdjust));
					name = 'Red Fez';
					if (rngSynced.NextDouble() < 0.1 && searchTerm.test(name)) {
						price = 8000;
						qty = 1;
						count++;
						output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
							wikify(name, "Hats") + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
					}
					if (save.ccComplete || save.jojaComplete) {
						rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_jojaCatalogue"), save.gameID, offset + days[i] + save.dayAdjust));
						name = 'Joja Catalogue';
						if (rngSynced.NextDouble() < 0.1 && searchTerm.test(name)) {
							price = 30000;
							qty = 1;
							count++;
							output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
								wikify(name) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
						}
						rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_junimoCatalogue"), save.gameID, offset + days[i] + save.dayAdjust));
						name = 'Junimo Catalogue';
						if (rngSynced.NextDouble() < 0.1 && searchTerm.test(name)) {
							price = 70000;
							qty = 1;
							count++;
							output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
								wikify(name) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
						}
					}
					rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_retroCatalogue"), save.gameID, offset + days[i] + save.dayAdjust));
					name = 'Retro Catalogue';
					if (rngSynced.NextDouble() < 0.1 && searchTerm.test(name)) {
						price = 110000;
						qty = 1;
						count++;
						output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
							wikify(name) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
					}
					rngSynced = new CSRandom(getRandomSeed(getHashFromString("teaset"), save.gameID, offset + days[i] + save.dayAdjust));
					name = 'Tea Set';
					if (rngSynced.NextDouble() < 0.1 && searchTerm.test(name) && offset + save.dayAdjust >= 2688) {
						price = 1000000;
						qty = 1;
						count++;
						output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
							wikify(name) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td></tr>";
					}
					// Skill book not included yet until we can get more reliable identification of which book it is.
				}
			}
			output += '<tr><td colspan="4" class="count">Found ' + count + ' matching item(s)</td></tr></tbody></table>\n';
		} else {
			if (typeof(offset) === 'undefined' || offset === '') {
				offset = 7 * Math.floor((save.daysPlayed - 1) / 7);
			}
			// 1.6 adds traveling cart to a new 3-day Desert Festival.
			// The cart is technically also at the Ice Festival, but that has a fixed stock so we don't include it
			var days;
			var dayOfYear = offset % 112;
			var cartName = "Forest Cart";
			var nameOffset = 1;
			if (dayOfYear === 94 || dayOfYear === 10) {
				// Night Market and Desert Festival
				days = [5, 6, 7];
				$('#cart-next-week').val(offset + 4);
				$('#cart-prev-week').val(offset - 3);
				nameOffset = 5;
				cartName = (dayOfYear === 94) ? "Night Market<br/>Boat" : "Desert Festival<br/>Cart";
			} else {
				days = [5, 7];
				$('#cart-next-week').val(offset + 7);
				$('#cart-prev-week').val(offset - 7);
				if (dayOfYear === 7 || dayOfYear === 91 ) {
					// Weekend before a festival
					$('#cart-next-week').val(offset + 3);
				}
				if (dayOfYear === 14 || dayOfYear === 98 ) {
					// Weekend after a festival
					$('#cart-prev-week').val(offset - 4);
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

			output += '<table class="output"><thead><tr><th rowspan="2">' + cartName + '</th>';
			for (var d = 0; d < days.length; d++) {
				output += '<th colspan="3" class="multi">' + save.dayNames[days[d] - nameOffset] + ' ' +
					monthName + ' ' + (dayOfMonth + days[d]) + ', Year ' + year +	'</th>';
			}
			output += '</tr><tr>';
			for (var d = 0; d < days.length; d++) {
				output += '<th class="item">Item</th><th class="qty">Qty</th><th class="price">Price</th>';
			}
			output += '</tr><tbody>';
			var cart = {};
			for (var d = 0; d < days.length; d++) {
				cart[d] = {};
				cart[d].rng = new CSRandom(getRandomSeed(offset + days[d] + save.dayAdjust, save.gameID/2));
				cart[d].seenRareSeed = false;
				cart[d].selectedItems = {};
				var pick = getRandomItems(cart[d].rng, "objects", 2, 789, true, true, true, 10);
				for (var slot = 1; slot <= 10; slot++) {
					cart[d].selectedItems[slot] = {};
					cart[d].selectedItems[slot].name = save.objects[pick[slot-1]].name;
					if (cart[d].selectedItems[slot].name === "Rare Seed") {
						cart[d].seenRareSeed = true;
					}
					cart[d].selectedItems[slot].price = Math.max(cart[d].rng.Next(1,11) * 100, cart[d].rng.Next(3,6) * save.objects[pick[slot-1]].price);
					cart[d].selectedItems[slot].qty = (cart[d].rng.NextDouble() < 0.1) ? 5 : 1;
				}										
			}
			for (var slot = 1; slot <= 10; slot++) {
				output += "<tr><td>Basic Item " + slot + "</td>";
				for (var d = 0; d < days.length; d++) {
					output += '<td class="item">' + wikify(cart[d].selectedItems[slot].name) + "</td><td>" + cart[d].selectedItems[slot].qty + "</td><td>" + addCommas(cart[d].selectedItems[slot].price) + "g</td>";
				}
				output += "</tr>";
			}
			// The Red Cabbage Y1 Guarantee which can only reliably look forward
			if (save.originalGuarantee >= 0) {
				output += "<tr><td>Year 1 Guarantee</td>";
				for (var d = 0; d < days.length; d++) {
					var dayOfPrediction = offset + days[d] + save.dayAdjust;
					var visitsNow = save.originalGuarantee - Math.floor(dayOfPrediction/7) - Math.floor((dayOfPrediction + 2)/7);
					if (dayOfPrediction >= 99) { visitsNow--; }
					if (dayOfPrediction >= 100) { visitsNow--; }
					if (dayOfPrediction >= 101) { visitsNow--; }
					if (visitsNow == 0) {
						name = save.objects["_485"].name;
						price = Math.max(cart[d].rng.Next(1,11) * 100, cart[d].rng.Next(3,6) * save.objects["_485"].price);
						qty = (cart[d].rng.NextDouble() < 0.1) ? 5 : 1;
						output += '<td class="item">' + wikify(name) + "</td><td>" + qty + "</td><td>" + addCommas(price) + "g</td>";
					} else if (visitsNow > 0) {
						output += '<td class="item">(' + visitsNow + (visitsNow == 1 ? ' visit' : ' visits') + " left)</td><td>--</td><td>--</td>";
					} else {
						output += '<td class="item">(Already passed)</td><td>--</td><td>--</td>';
					}
				}
				output += "</tr>";
			}
			output += '<tr><td>Furniture</td>';
			for (var d = 0; d < days.length; d++) {
				var pick = getRandomItems(cart[d].rng, "furniture", 0, 1612, true, true);
				name = save.furniture[pick[0]].name;
				price = cart[d].rng.Next(1,11) * 250;
				output += '<td class="item">' + wikify(name,'Furniture') + '</td><td>1</td><td>' + addCommas(price) + 'g</td>';
			}
			output += "</tr>";
			output += "<tr><td>Seasonal Special</td>";
			if (month % 4 < 2) {
				for (var d = 0; d < days.length; d++) {
					if (!cart[d].seenRareSeed) {
						name = wikify('Rare Seed');
						price = 1000;
						qty = (cart[d].rng.NextDouble() < 0.1) ? 5 : 1;
					} else {
						name = '(None)';
						price = '--';
						qty = '--';
					}
					output += '<td class="item">' + name + "</td><td>" + qty + "</td><td>" + addCommas(price) + (price == '--' ? '' : 'g') + "</td>";
				}
			} else {
				for (var d = 0; d < days.length; d++) {
					var rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_rarecrow"), save.gameID, offset + days[d] + save.dayAdjust));
					if (rngSynced.NextDouble() < 0.4) {
						name = wikify('Rarecrow (Snowman)');
						price = 4000;
						qty = 1;
					} else {
						name = '(None)';
						price = '--';
						qty = '--';
					}
					output += '<td class="item">' + name + "</td><td>" + qty + "</td><td>" + addCommas(price) + (price == '--' ? '' : 'g') + "</td>";
				}
			}
			output += "</tr>";
			output += "<tr><td>Coffee Bean</td>";
			if (month % 4 > 1) {
				for (var d = 0; d < days.length; d++) {
					var rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_coffee_bean"), save.gameID, offset + days[d] + save.dayAdjust));
					if (rngSynced.NextDouble() < 0.25) {
						name = wikify('Coffee Bean');
						price = 2500;
						qty = 1;
					} else {
						name = '(None)';
						price = '--';
						qty = '--';
					}
					output += '<td class="item">' + name + "</td><td>" + qty + "</td><td>" + addCommas(price) + (price == '--' ? '' : 'g') + "</td>";
				}
			} else {
				var span = days.length * 3;
				output += '<td class="item note" colspan="' + span + '">Only possible in Fall or Winter</td>';
			}
			output += "</tr>";
			output += "<tr><td>Red Fez</td>";
			for (var d = 0; d < days.length; d++) {
				var rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_fez"), save.gameID, offset + days[d] + save.dayAdjust));
				if (rngSynced.NextDouble() < 0.1) {
					name = wikify('Red Fez');
					price = 8000;
					qty = 1;
				} else {
					name = '(None)';
					price = '--';
					qty = '--';
				}
				output += '<td class="item">' + name + "</td><td>" + qty + "</td><td>" + addCommas(price) + (price == '--' ? '' : 'g') +  "</td>";
			}
			output += "</tr>";
			
			
			output += "<tr><td>Catalogue 1</td>";
			if (save.ccComplete) {
				for (var d = 0; d < days.length; d++) {
					var rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_jojaCatalogue"), save.gameID, offset + days[d] + save.dayAdjust));
					if (rngSynced.NextDouble() < 0.1) {
						name = wikify('Joja Catalogue');
						price = 30000;
						qty = 1;
					} else {
						name = '(None)';
						price = '--';
						qty = '--';
					}
					output += '<td class="item">' + name + "</td><td>" + qty + "</td><td>" + addCommas(price) + (price == '--' ? '' : 'g') +  "</td>";
				}
			} else {
				var span = days.length * 3;
				output += '<td class="item note" colspan="' + span + '">Only possible after Community Center Restoration</td>';
			}
			output += "</tr>";
			output += "<tr><td>Catalogue 2</td>";
			if (save.ccComplete || save.jojaComplete) {
				for (var d = 0; d < days.length; d++) {
					var rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_junimoCatalogue"), save.gameID, offset + days[d] + save.dayAdjust));
					if (rngSynced.NextDouble() < 0.1) {
						name = wikify('Junimo Catalogue');
						price = 70000;
						qty = 1;
					} else {
						name = '(None)';
						price = '--';
						qty = '--';
					}
					output += '<td class="item">' + name + "</td><td>" + qty + "</td><td>" + addCommas(price) + (price == '--' ? '' : 'g') +  "</td>";
				}
			} else {
				var span = days.length * 3;
				output += '<td class="item note" colspan="' + span + '">Only possible after Community Center Restoration</td>';
			}
			output += "</tr>";
			output += "<tr><td>Catalogue 3</td>";
			for (var d = 0; d < days.length; d++) {
				var rngSynced = new CSRandom(getRandomSeed(getHashFromString("cart_retroCatalogue"), save.gameID, offset + days[d] + save.dayAdjust));
				if (rngSynced.NextDouble() < 0.1) {
					name = wikify('Retro Catalogue');
					price = 110000;
					qty = 1;
				} else {
					name = '(None)';
					price = '--';
					qty = '--';
				}
				output += '<td class="item">' + name + "</td><td>" + qty + "</td><td>" + addCommas(price) + (price == '--' ? '' : 'g') +  "</td>";
			}
			output += "</tr>";
			output += "<tr><td>Y25 Tea Set</td>";
			if (offset + save.dayAdjust >= 2688) {
				for (var d = 0; d < days.length; d++) {
					var rngSynced = new CSRandom(getRandomSeed(getHashFromString("teaset"), save.gameID, offset + days[d] + save.dayAdjust));
					if (rngSynced.NextDouble() < 0.05)  {
						name = wikify('Tea Set');
						price = 1000000;
						qty = '∞';
					} else {
						name = '(None)';
						price = '--';
						qty = '--';
					}
					output += '<td class="item">' + name + "</td><td>" + qty + "</td><td>" + addCommas(price) + (price == '--' ? '' : 'g') +  "</td>";
				}
			} else {
				var span = days.length * 3;
				output += '<td class="item note" colspan="' + span + '">Only possible in Year 25 or later</td>';
			}
			output += "</tr>";
			output += "<tr><td>Skill Book</td>";
			for (var d = 0; d < days.length; d++) {
				var rngSynced = new CSRandom(getRandomSeed(getHashFromString("travelerSkillBook"), save.gameID, offset + days[d] + save.dayAdjust));
				if (rngSynced.NextDouble() < 0.05) {
					name = wikify(skillBookList[cart[d].rng.Next(skillBookList.length)]);
					price = 6000;
					qty = 1;
				} else {
					name = '(None)';
					price = '--';
					qty = '--';
				}
				output += '<td class="book item">' + name + "</td><td>" + qty + "</td><td>" + addCommas(price) + (price == '--' ? '' : 'g') +  "</td>";
			}
			output += "</tr>";
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
			rng,
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
					if (compareSemVer(save.version, "1.6") >= 0) {
						rng = new CSRandom(getRandomSeed(offset + days[i] + save.dayAdjust, save.gameID / 2));
						if (days[i] === 3) {
							var result = getRandomItems(rng, "objects", 698, 708, true, true);
							item = save.objects[result[0]].name;
							price = 200;
						} else if (days[i] === 6) {
							var rngSynced = new CSRandom(getRandomSeed(getHashFromString("krobus_bread"), offset + days[i] + save.dayAdjust));
							if (rngSynced.NextDouble() < 0.0196078431) {
								item = save.objects["_216"].name;
								price = 10 * rng.Next(5,51);
							} else {
								result = getRandomItems(rng, "objects", 194, 244, true, true);
								item = save.objects[result[0]].name;
								price = 10 * rng.Next(5,51);
							}
						}
					} else {
						rng = new CSRandom((save.gameID / 2) + offset + days[i] + save.dayAdjust);
						// Note that we are using getCartItem which is a special filtered version of the object list.
						// Since getCartItem has a built-in increment, we counter that with the -1 after rolling the
						// random number. Luckily for us, neither of the ranges we care about has any disallowed items
						// so we can get away with using the cart list for this situation.
						if (days[i] === 3) {
							// Wednesday Fish
							item = save.cartItems[rng.Next(698,709) - 1];
							price = 200;
						} else if (days[i] === 6) {
							// Saturday Cooking
							thisRoll = rng.Next(194,245) - 1;
							if (thisRoll === 216) { thisRoll = 215; }
							item = save.cartItems[thisRoll];
							price = rng.Next(5,51) * 10;
						}
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
			item = ['None', 'None'];
			price = [200, 0];
			qty = [5, 5];
			if (compareSemVer(save.version, "1.6") >= 0) {
				rng = new CSRandom(getRandomSeed(offset + 3 + save.dayAdjust, save.gameID / 2));
				var result = getRandomItems(rng, "objects", 698, 708, true, true);
				item[0] = save.objects[result[0]].name;
				rng = new CSRandom(getRandomSeed(offset + 6 + save.dayAdjust, save.gameID / 2));
				var rngSynced = new CSRandom(getRandomSeed(getHashFromString("krobus_bread"), offset + 6 + save.dayAdjust));
				if (rngSynced.NextDouble() < 0.0196078431) {
					item[1] = save.objects["_216"].name;
					price[1] = 10 * rng.Next(5,51);
				} else {
					result = getRandomItems(rng, "objects", 194, 244, true, true);
					item[1] = save.objects[result[0]].name;
					price[1] = 10 * rng.Next(5,51);
				}				
			} else {
				// Note that we adjust the ID ranges down by 1 to fit our cartItems list
				rng = new CSRandom((save.gameID / 2) + offset + 3 + save.dayAdjust);
				item[0] = save.cartItems[rng.Next(698,709) - 1];
				rng = new CSRandom((save.gameID / 2) + offset + 6 + save.dayAdjust);
				thisRoll = rng.Next(194,245) - 1;
				if (thisRoll === 216) { thisRoll = 215; }
				item[1] = save.cartItems[thisRoll];
				price[1] = rng.Next(5,51) * 10;
			}
			for (var i = 0; i < item.length; i++) {
				output += '<td class="item">' + wikify(item[i]) + "</td><td>" + qty[i] + "</td><td>" + addCommas(price[i]) + "g</td>";
			}
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
			shirtID,
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
			searchStart = ($('#sandy-search-all').prop('checked')) ? 1 : 7 * Math.floor((save.daysPlayed - 1) / 7);
			searchEnd = 112 * $('#sandy-search-range').val();
			output += '<table class="output"><thead><tr><th colspan="3">Search results for &quot;' + offset + '&quot; over the ' +
				(($('#sandy-search-all').prop('checked')) ? 'first ' : 'next ') + $('#sandy-search-range').val() + ' year(s)</th></tr>\n';
			output += '<tr><th class="day">Day</th><th class="shirt-item">Image</th><th class="item">Name</th></tr>\n<tbody>';
			count = 0;
			// Much of the logic here is duplicated from the browsing section, but comments related to it have been removed.
			console.log("Searching from " + searchStart + " to " + (searchStart + searchEnd));
			for (offset = searchStart; offset < searchStart + searchEnd; offset += 7) {
				for (var i = 0; i < 7; i++) {
					day = offset + i;
					if (compareSemVer(save.version, "1.6") >= 0) {
						rng = new CSRandom(getRandomSeed(day + save.dayAdjust, save.gameID / 2));
						var result = getRandomItems(rng, "shirts", 1000, 1126, true, true);
						shirtID = save.shirts[result[0]].id - 999;
						item = save.shirts[result[0]].name + " (ID '(S)" + save.shirts[result[0]].id + "')" ;
					} else {
						rng = new CSRandom((save.gameID / 2) + day + save.dayAdjust);
						thisRoll = 1000 + rng.Next(127);
						shirtID = thisRoll - 999;
						item = save.shirts["_" + thisRoll].name + " (ID " + thisRoll +")" ;
					}
					if (searchTerm.test(item)) {
						count++;
						month = Math.floor(day / 28);
						year = 1 + Math.floor(day / 112);
						dayOfMonth = day % 28;
						dayOfWeek = day % 7 - 1; // This is an int now, will be a string later
						// Our date calculations have trouble with last day of week/month/year, so here we compensate for that.
						if (day % 112 === 0) { year -= 1; }
						if (day % 28 === 0) { month -= 1; dayOfMonth = 28;}
						if (dayOfWeek < 0) { dayOfWeek += 7; }
						monthName = save.seasonNames[month % 4];
						dayOfWeek = save.dayNames[dayOfWeek];
						output += '<tr><td>' + dayOfWeek + ' ' + monthName + ' ' + dayOfMonth + ', Year ' + year + '</td><td>' +
							'<img src="blank.png" class="shirt" id="shirt_' + shirtID + '"></td>' +
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
				if (compareSemVer(save.version, "1.6") >= 0) {
					rng = new CSRandom(getRandomSeed(day + save.dayAdjust, save.gameID / 2));
					var result = getRandomItems(rng, "shirts", 1000, 1126, true, true);
					shirtID = save.shirts[result[0]].id - 999;
					item = save.shirts[result[0]].name + "<br/>ID: (S)" + save.shirts[result[0]].id;
				} else {
					rng = new CSRandom((save.gameID / 2) + day + save.dayAdjust);
					thisRoll = 1000 + rng.Next(127);
					shirtID = thisRoll - 999;
					item = save.shirts["_" + thisRoll].name + "<br/>ID: " + thisRoll;
				}

				if (day < save.daysPlayed) {
					tclass = "past";
				} else if (day === save.daysPlayed) {
					tclass = "current";
				} else {
					tclass = "future";
				}
				output += '<tr><td class="' + tclass + '">' + save.dayNames[(day - 1) % 7] + '<br/>' +
					monthName + ' ' + ((day - 1) % 28 + 1) +', Year ' + year + '</td>' +
					'<td class="' + tclass + '"><img src="blank.png" class="shirt" id="shirt_' + (shirtID) + '"></td>' +
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
			itemID,
			itemQty,
			itemIcon,
			qty,
			g,
			c,
			couldBeHat,
			couldBeBeans,
			couldBeBeansTrove,
			roll,
			next,
			tclass,
			searchTerm,
			searchStart,
			searchEnd,
			searchResults,
			count,
			pageSize = 20,
			numColumns = 4,
			rng,
			rngTrove;

		if (compareSemVer(save.version, "1.4") >= 0) {
			numColumns++;
		}
		if (compareSemVer(save.version, "1.5") >= 0) {
			numColumns++;
		}
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
			if (compareSemVer(save.version, "1.4") >= 0) {
				output += '<th class="geode-result">Artifact Trove <a href="https://stardewvalleywiki.com/Artifact_Trove">' +
				'<img src="blank.png" class="icon" id="geode_t"></a></th>';
			}
			if (compareSemVer(save.version, "1.5") >= 0) {
				output += '<th class="geode-result">Golden Coconut <a href="https://stardewvalleywiki.com/Golden_Coconut">' +
				'<img src="blank.png" class="icon" id="geode_c"></a></th>';
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
				// Golden Coconuts & Artifact Troves need their own RNG because the way the conditionals are set up means
				// their content roll happens at the same time as the rng.NextDouble() < 0.5 check. Unfortunately, that also
				// means we have to do all the warmups on both RNGs.
				if (compareSemVer(save.version, "1.6") >= 0) {
					rng = new CSRandom(getRandomSeed(numCracked, save.gameID/2));
					rngTrove = new CSRandom(getRandomSeed(numCracked, save.gameID/2));
				} else {
					rng = new CSRandom(numCracked + save.gameID / 2);
					rngTrove = new CSRandom(numCracked + save.gameID / 2);
				}
				if (compareSemVer(save.version, "1.4") >= 0) {
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
					// The Qi Bean check.
					couldBeBeans = false;
					couldBeBeansTrove = false;
					if (compareSemVer(save.version, "1.5") >= 0) {
						couldBeBeans = (rng.NextDouble() < 0.1);
						couldBeBeansTrove = (rngTrove.NextDouble() < 0.1);
					}
					// Rolling troves and coconuts now
					c = rngTrove.NextDouble();
					item.push(save.objects[save.geodeContents[275][Math.floor(c*save.geodeContents[275].length)]].name);
					itemQty.push(1);

					if (compareSemVer(save.version, "1.5") >= 0) {
						// note that we don't actually use couldBeHat when searching but it still needs to roll
						couldBeHat = (c < 0.05);
						roll = Math.floor(c*save.geodeContents[791].length);
						qty = (roll === 2 || roll == 3 || roll == 6) ? 5 : 1;
						item.push(save.objects[save.geodeContents[791][roll]].name);
						itemQty.push(qty);
					}
				}
				// 1.6 reversed the check for ores vs minerals and also when prismatic shard is rolled
				var getGoodStuff = false;
				roll = rng.NextDouble();
				if (compareSemVer(save.version, "1.6") >= 0) {
					getGoodStuff = (roll < 0.5);
				} else {
					getGoodStuff = !(roll < 0.5);
				}
				if (getGoodStuff) {
					next = rng.NextDouble();
					item[0] = save.objects[save.geodeContents[535][Math.floor(next*save.geodeContents[535].length)]].name;
					item[1] = save.objects[save.geodeContents[536][Math.floor(next*save.geodeContents[536].length)]].name;
					item[2] = save.objects[save.geodeContents[537][Math.floor(next*save.geodeContents[537].length)]].name;
					if (compareSemVer(save.version, "1.6") >= 0) {
						if (next < 0.008 && numCracked > 15) {
							item[3] = save.objects["_74"].name;
						} else {
							item[3] = save.objects[save.geodeContents[749][Math.floor(rng.Next(save.geodeContents[749].length))]].name;
						}
					} else {
						if (rng.NextDouble() < 0.008 && numCracked > 15) {
							item[3] = save.objects["_74"].name;
						} else {
							item[3] = save.objects[save.geodeContents[749][Math.floor(next*save.geodeContents[749].length)]].name;
						}
					}
				} else {
					qty = rng.Next(3)*2 + 1;
					if (rng.NextDouble() < 0.1) { qty = 10; }
					if (rng.NextDouble() < 0.01) { qty = 20; }
					if (rng.NextDouble() < 0.5) {
						c = rng.Next(4);
						if (c < 2) {
							item[0] = save.objects["_390"].name;
							itemQty[0] = qty;
							item[1] = item[0];
							itemQty[1] = qty;
							item[2] = item[0];
							itemQty[2] = qty;
							item[3] = item[0];
							itemQty[3] = qty;
						} else if (c === 2) {
							item[0] = save.objects["_330"].name;
							itemQty[0] = 1;
							item[1] = item[0];
							item[2] = item[0];
							item[3] = item[0];
						} else {
							item[0] = save.objects["_86"].name;
							itemQty[0] = 1;
							item[1] = save.objects["_84"].name;
							item[2] = save.objects["_82"].name;
							item[3] = save.objects["_" +  ((compareSemVer(save.version, "1.3") >= 0) ? (82 + rng.Next(3) * 2): 82)].name;
						}
					} else {
						next = rng.NextDouble();
						// plain geode (535)
						c = Math.floor(next*3);
						if (c === 0) {
							item[0] = save.objects["_378"].name;
							itemQty[0] = qty;
						} else if (c === 1) {
							item[0] = save.objects[(save.deepestMineLevel > 25) ? "_380" : "_378"].name;
							itemQty[0] = qty;
						} else {
							item[0] = save.objects["_382"].name;
							itemQty[0] = qty;
						}
						// frozen geode (536)
						c = Math.floor(next*4);
						if (c === 0) {
							item[1] = save.objects["_378"].name;
							itemQty[1] = qty;
						} else if (c === 1) {
							item[1] = save.objects["_380"].name;
							itemQty[1] = qty;
						} else if (c === 2) {
							item[1] = save.objects["_382"].name;
							itemQty[1] = qty;
						} else {
							item[1] = save.objects[(save.deepestMineLevel > 75) ? "_384" : "_380"].name;
							itemQty[1] = qty;
						}
						// magma & omni geodes
						c = Math.floor(next*5);
						if (c === 0) {
							item[2] = save.objects["_378"].name;
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 1) {
							item[2] = save.objects["_380"].name;
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 2) {
							item[2] = save.objects["_382"].name;
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 3) {
							item[2] = save.objects["_384"].name;
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else {
							item[2] = save.objects["_386"].name;
							item[3] = item[2];
							itemQty[2] = Math.floor(qty/2 + 1);
							itemQty[3] = itemQty[2];
						}
					}
				}
				for (c = 0; c < numColumns; c++) {
					if (searchTerm.test(item[c])) {
						if (!searchResults.hasOwnProperty(item[c])) {
							searchResults[item[c]] = [ [], [], [], [] ];
							if (compareSemVer(save.version, "1.4") >= 0) {
								searchResults[item[c]].push([]);
							}
							if (compareSemVer(save.version, "1.5") >= 0) {
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
					itemIcon = ' <span data-tooltip="Need to Donate"><img src="blank.png" class="icon" id="gunther" alt="Need to Donate"></span>';
				}
				output += '<tr><td class="item">' + wikify(key) + itemIcon + '</td>';
				for (c = 0; c < numColumns; c++) {
					if (searchResults[key][c].length > 0) {
						// Limit to first 5 results actually shown in table with ellipsis & tooltip for others
						output += '<td>' + searchResults[key][c].slice(0,5);
						if (searchResults[key][c].length > 5) {
							output += '<span data-tooltip="All results: ' + searchResults[key][c] + '">,...</span>';
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
			if (compareSemVer(save.version, "1.4") >= 0) {
				output += '<th colspan="2" class="multi"">Artifact Trove <a href="https://stardewvalleywiki.com/Artifact_Trove">' +
				'<img src="blank.png" class="icon" id="geode_t"></a></th>';
			}
			if (compareSemVer(save.version, "1.5") >= 0) {
				output += '<th colspan="2" class="multi"">Golden Coconut <a href="https://stardewvalleywiki.com/Golden_Coconut">' +
				'<img src="blank.png" class="icon" id="geode_c"></a></th>';
			}
			output += '</tr>\n<tr>';
			for (c = 0; c < numColumns; c++) {
				output += '<th class="item">Item</th><th class="qty">Qty</th>';
			}
			output += '</tr>\n<tbody>';
			// We are going to predict all 4 types of geodes at once, so we have multiple variables and in several cases will
			// use rng.Double() & scale things ourselves where the source does rng.Next() with various different integers.
			// Artifact Troves & Golden Coconuts sill require special handling
			for (g = 1; g <= pageSize; g++) {
				numCracked = offset + g;
				couldBeHat = false;
				item = ['Stone', 'Stone', 'Stone', 'Stone'];
				itemQty = [1, 1, 1, 1];
				if (compareSemVer(save.version, "1.6") >= 0) {
					rng = new CSRandom(getRandomSeed(numCracked, save.gameID/2));
					rngTrove = new CSRandom(getRandomSeed(numCracked, save.gameID/2));
				} else {
					rng = new CSRandom(numCracked + save.gameID / 2);
					rngTrove = new CSRandom(numCracked + save.gameID / 2);
				}
				if (compareSemVer(save.version, "1.4") >= 0) {
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
					// The Qi Bean check.
					couldBeBeans = false;
					couldBeBeansTrove = false;
					if (compareSemVer(save.version, "1.5") >= 0) {
						couldBeBeans = (rng.NextDouble() < 0.1);
						couldBeBeansTrove = (rngTrove.NextDouble() < 0.1);
					}
					// Rolling troves and coconuts now
					c = rngTrove.NextDouble();
					item.push(save.objects[save.geodeContents[275][Math.floor(c*save.geodeContents[275].length)]].name);
					itemQty.push(1);

					if (compareSemVer(save.version, "1.5") >= 0) {
						couldBeHat = (c < 0.05);
						roll = Math.floor(rngTrove.NextDouble()*save.geodeContents[791].length);
						qty = (roll === 2 || roll == 3 || roll == 6) ? 5 : 1;
						item.push(save.objects[save.geodeContents[791][roll]].name);
						itemQty.push(qty);
					}
				}
				// 1.6 reversed the check for ores vs minerals and also when prismatic shard is rolled
				var getGoodStuff = false;
				roll = rng.NextDouble();
				if (compareSemVer(save.version, "1.6") >= 0) {
					getGoodStuff = (roll < 0.5);
				} else {
					getGoodStuff = !(roll < 0.5);
				}
				if (getGoodStuff) {
					next = rng.NextDouble();
					item[0] = save.objects[save.geodeContents[535][Math.floor(next*save.geodeContents[535].length)]].name;
					item[1] = save.objects[save.geodeContents[536][Math.floor(next*save.geodeContents[536].length)]].name;
					item[2] = save.objects[save.geodeContents[537][Math.floor(next*save.geodeContents[537].length)]].name;
					if (compareSemVer(save.version, "1.6") >= 0) {
						if (next < 0.008 && numCracked > 15) {
							item[3] = save.objects["_74"].name;
						} else {
							item[3] = save.objects[save.geodeContents[749][Math.floor(rng.Next(save.geodeContents[749].length))]].name;
						}
					} else {
						if (rng.NextDouble() < 0.008 && numCracked > 15) {
							item[3] = save.objects["_74"].name;
						} else {
							item[3] = save.objects[save.geodeContents[749][Math.floor(next*save.geodeContents[749].length)]].name;
						}
					}
				} else {
					qty = rng.Next(3)*2 + 1;
					if (rng.NextDouble() < 0.1) { qty = 10; }
					if (rng.NextDouble() < 0.01) { qty = 20; }
					if (rng.NextDouble() < 0.5) {
						c = rng.Next(4);
						if (c < 2) {
							item[0] = save.objects["_390"].name;
							itemQty[0] = qty;
							item[1] = item[0];
							itemQty[1] = qty;
							item[2] = item[0];
							itemQty[2] = qty;
							item[3] = item[0];
							itemQty[3] = qty;
						} else if (c === 2) {
							item[0] = save.objects["_330"].name;
							itemQty[0] = 1;
							item[1] = item[0];
							item[2] = item[0];
							item[3] = item[0];
						} else {
							item[0] = save.objects["_86"].name;
							itemQty[0] = 1;
							item[1] = save.objects["_84"].name;
							item[2] = save.objects["_82"].name;
							item[3] = save.objects["_" +  ((compareSemVer(save.version, "1.3") >= 0) ? (82 + rng.Next(3) * 2): 82)].name;
						}
					} else {
						next = rng.NextDouble();
						// plain geode (535)
						c = Math.floor(next*3);
						if (c === 0) {
							item[0] = save.objects["_378"].name;
							itemQty[0] = qty;
						} else if (c === 1) {
							item[0] = save.objects[(save.deepestMineLevel > 25) ? "_380" : "_378"].name;
							itemQty[0] = qty;
						} else {
							item[0] = save.objects["_382"].name;
							itemQty[0] = qty;
						}
						// frozen geode (536)
						c = Math.floor(next*4);
						if (c === 0) {
							item[1] = save.objects["_378"].name;
							itemQty[1] = qty;
						} else if (c === 1) {
							item[1] = save.objects["_380"].name;
							itemQty[1] = qty;
						} else if (c === 2) {
							item[1] = save.objects["_382"].name;
							itemQty[1] = qty;
						} else {
							item[1] = save.objects[(save.deepestMineLevel > 75) ? "_384" : "_380"].name;
							itemQty[1] = qty;
						}
						// magma & omni geodes
						c = Math.floor(next*5);
						if (c === 0) {
							item[2] = save.objects["_378"].name;
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 1) {
							item[2] = save.objects["_380"].name;
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 2) {
							item[2] = save.objects["_382"].name;
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else if (c === 3) {
							item[2] = save.objects["_384"].name;
							item[3] = item[2];
							itemQty[2] = qty;
							itemQty[3] = itemQty[2];
						} else {
							item[2] = save.objects["_386"].name;
							item[3] = item[2];
							itemQty[2] = Math.floor(qty/2 + 1);
							itemQty[3] = itemQty[2];
						}
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
					// Golden Coconut items never contain items eligible for museum donation (although the Fossilized Skull
					//  could be donatable to the field office and we may support that later) and they have the hat possibility
					//  instead.
					if (c === 5) {
						if (couldBeHat) {
							itemIcon = ' <span data-tooltip="Could be Golden Helmet"><img src="blank.png" class="icon" id="icon_h" alt="Could be Golden Helmet"></span>';
						}
						if (couldBeBeansTrove) {
							itemIcon += ' <span data-tooltip="Could be Qi Beans"><img src="blank.png" class="icon" id="icon_b" alt="Could be Qi Beans"></span>';
						}
					} else {
						if (!save.donatedItems.hasOwnProperty(item[c])) {
							itemIcon = ' <span data-tooltip="Need to Donate"><img src="blank.png" class="icon" id="gunther" alt="Need to Donate"></span>';
						}
						if (c === 4) {
							if (couldBeBeansTrove) {
								itemIcon += ' <span data-tooltip="Could be Qi Beans"><img src="blank.png" class="icon" id="icon_b" alt="Could be Qi Beans"></span>';
							}
						} else {
							if (couldBeBeans) {
								itemIcon += ' <span data-tooltip="Could be Qi Beans"><img src="blank.png" class="icon" id="icon_b" alt="Could be Qi Beans"></span>';
							}
						}
					}
					output += '<td class="item">' + wikify(item[c]) + itemIcon + '</td><td>' + itemQty[c] + '</td>';
				}
				output += '</tr>';
			}
		}
		output += '<tr><td colspan="' + (1 + 2*numColumns) + '" class="legend">Note: <img src="blank.png" class="icon" id="gunther" alt="Need to Donate"> denotes items ' + 'which need to be donated to the ' + wikify('Museum') + '<br/> <img src="blank.png" class="icon" id="icon_b" alt="Could be Qi Beans"> denotes items which will be replaced by ' + wikify('Qi Beans') + ' and <img src="blank.png" class="icon" id="icon_h" alt="Could be Golden Coconut Hat"> denotes items which will be replaced by the ' + wikify('Golden Helmet') + ' if applicable.</td></tr>';
		output += '</tbody></table>';
		return output;
	}

	function predictMysteryBoxes(isSearch, offset) {
		// logic from StardewValley.Utility.getTreasureFromGeode()
		var output = '',
			numOpened,
			item,
			itemQty,
			itemIcon,
			qty,
			g,
			c,
			roll,
			next,
			tclass,
			searchTerm,
			searchStart,
			searchEnd,
			searchResults,
			count,
			pageSize = 20,
			numColumns = 3,
			noLink,
			basedOnSkill,
			rng;

		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			$('#mystery-prev-100').prop("disabled", true);
			$('#mystery-prev').prop("disabled", true);
			$('#mystery-next').prop("disabled", true);
			$('#mystery-next-100').prop("disabled", true);
			$('#mystery-reset').html("Clear Search Results &amp; Reset Browsing");
			// Note we are using the regexp matcher due to wanting to ignore case. The table header references offset still
			// so that it appears exactly as was typed in by the user.
			searchTerm = new RegExp(offset, "i");
			searchStart = Math.max(1, ($('#mystery-search-all').prop('checked')) ? 1 : save.mysteryBoxesOpened[0]);
			searchEnd = parseInt($('#mystery-search-range').val()) + searchStart;
			output += '<table class="output"><thead><tr><th colspan="' + (numColumns + 2) +
				'">Search results for &quot;' + offset + '&quot; over the ' +
				(($('#mystery-search-all').prop('checked')) ? 'first ' : 'next ') + $('#mystery-search-range').val() + ' mystery boxes</th></tr>\n';
			output += '<tr><th class="item">Item</th>' +
				'<th class="mystery-result">Mystery Box <a href="https://stardewvalleywiki.com/Mystery_Box">' +
				'<img src="blank.png" class="icon" id="mbox_b"></a></th>' +
				'<th class="mystery-result">Golden Mystery Box <a href="https://stardewvalleywiki.com/Golden_Mystery_Box">' +
				'<img src="blank.png" class="icon" id="mbox_g"></a><br/>Without Farming Mastery Perk</th>' +
				'<th class="mystery-result">Golden Mystery Box <a href="https://stardewvalleywiki.com/Golden_Mystery_Box">' +
				'<img src="blank.png" class="icon" id="mbox_g"></a><br/>With Farming Mastery Perk</th>';
			output += '</tr>\n<tbody>';
			count = 0;
			searchResults = {};
			//console.log('searching from ' + searchStart + ' to ' + searchEnd);
			for (numOpened = searchStart; numOpened < searchEnd; numOpened++) {
				// Nearly an exact copy of the browsing code within the for loop. We don't use the qty stuff right now,
				// but I'd rather leave it in place in case that gets added to the search results later.
				item = ['None', 'None', 'None'];
				itemQty = [1, 1, 1];
				noLink = [false, false, false];
				basedOnSkill = [false, false, false];
				// In theory, we could just keep 1 rng instance and use it for everything since all
				// 3 situations are seeded the same. But for practicality we run a separate instance
				// for each since the number of rolls and the pass thresholds vary.
				for (c = 0; c < numColumns; c++) {
					var rareMod = (c === 0 ? 1 : 2);
					var extraBookChance = save.gotMysteryBook ? 0 : 0.0004 * numOpened;
					rng = new CSRandom(getRandomSeed(numOpened, save.gameID/2));
					var i, j, prewarm_amount2 = rng.Next(1,10);
					for (j = 0; j < prewarm_amount2; j++) {
						rng.NextDouble();
					}
					prewarm_amount2 = rng.Next(1,10);
					for (i = 0; i < prewarm_amount2; i++) {
						rng.NextDouble();
					}
					if (numOpened > 10 || c > 0) {
						if (c == 2 && rng.NextDouble() < 0.005) {
							item[c] = "Golden Animal Cracker";
						} else if (rng.NextDouble() < (0.002 * rareMod)) {
							item[c] = save.objects["_279"].name;
						} else if (rng.NextDouble() < (0.004 * rareMod)) {
							item[c] = save.objects["_74"].name;
						} else if (rng.NextDouble() < (0.008 * rareMod)) {
							item[c] = save.objects["_166"].name;
						} else if (rng.NextDouble() < (0.01 * rareMod + extraBookChance)) {
							if (!save.gotMysteryBook) {
								item[c] = save.objects["_Book_Mystery"].name;
							} else {
								var choices = ["_PurpleBook", "_Book_Mystery"];
								item[c] = save.objects[choices[rng.Next(choices.length)]].name;
							}
						} else if (rng.NextDouble() < (0.01 * rareMod)) {
							var choices = ["_797", "_373"];
							item[c] = save.objects[choices[rng.Next(choices.length)]].name;
						} else if (rng.NextDouble() < (0.01 * rareMod)) {
							item[c] = "Mystery Hat";
						} else if (rng.NextDouble() < (0.01 * rareMod)) {
							item[c] = "Mystery Shirt";
						} else if (rng.NextDouble() < (0.01 * rareMod)) {
							item[c] = "Mystery Wallpaper";
						} else if (rng.NextDouble() < 0.1 || c > 0) {
							switch(rng.Next(15)) {
								case 0:
									item[c] = save.objects["_288"].name;
									itemQty[c] = 5;
									break;
								case 1:
									item[c] = save.objects["_253"].name;
									itemQty[c] = 3;
									break;
								case 2:
									// This only rolls at fishing skill >= 6
									if (rng.NextDouble() < .5) {
										var choices = ["_687", "_695"];
										item[c] = save.objects[choices[rng.Next(choices.length)]].name;
										basedOnSkill[c] = true;
									} else {
										item[c] = save.objects["_242"].name;
										itemQty[c] = 2;
									}
									break;
								case 3:
									item[c] = save.objects["_204"].name;
									itemQty[c] = 2;
									break;
								case 4:
									item[c] = save.objects["_369"].name;
									itemQty[c] = 20;
									break;
								case 5:
									item[c] = save.objects["_466"].name;
									itemQty[c] = 20;
									break;
								case 6:
									item[c] = save.objects["_773"].name;
									itemQty[c] = 2;
									break;
								case 7:
									item[c] = save.objects["_688"].name;
									itemQty[c] = 3;
									break;
								case 8:
									item[c] = save.objects["_" + rng.Next(628,634)].name;
									break;
								case 9:
									item[c] = "Seasonal Seeds";
									itemQty[c] = 20;
									noLink[c] = true;
									break;
								case 10:
									if (rng.NextDouble() < 0.5) {
										item[c] = "Ossified Blade";
									} else {
										var choices = ["_533", "_534"];
										item[c] = save.objects[choices[rng.Next(choices.length)]].name;
									}
									break;
								case 11:
									item[c] = save.objects["_621"].name;
									break;
								case 12:
									item[c] = "Mystery Box";
									itemQty[c] = rng.Next(3,5);
									break;
								case 13:
									item[c] = save.objects["_SkillBook_" + rng.Next(5)].name;
									break;
								case 14:
									item[c] = "Raccoon Seeds";
									itemQty[c] = 8;
									noLink[c] = true;
									break;
							}
						}
					}
					// Fall-through for first 10 boxes or no RNG success yet
					if (item[c] == 'None') {
						switch(rng.Next(14)) {
							case 0:
								item[c] = save.objects["_395"].name;
								itemQty[c] = 3;
								break;
							case 1:
								item[c] = save.objects["_287"].name;
								itemQty[c] = 5;
								break;
							case 2:
								item[c] = "Seasonal Seeds";
								itemQty[c] = 8;
								noLink[c] = true;
								break;
							case 3:
								item[c] = save.objects["_" + rng.Next(727,734)].name;
								break;
							case 4:
								roll = 217;
								while (roll == 217) {
									roll = rng.Next(194, 240);
								}
								item[c] = save.objects["_" + roll].name;
								break;
							case 5:
								item[c] = save.objects["_709"].name;
								itemQty[c] = 10;
								break;
							case 6:
								item[c] = save.objects["_369"].name;
								itemQty[c] = 10;
								break;
							case 7:
								item[c] = save.objects["_466"].name;
								itemQty[c] = 10;
								break;
							case 8:
								item[c] = save.objects["_688"].name;
								break;
							case 9:
								item[c] = save.objects["_689"].name;
								break;
							case 10:
								item[c] = save.objects["_770"].name;
								itemQty[c] = 10;
								break;
							case 11:
								item[c] = "Mixed Flower Seeds";
								itemQty[c] = 10;
								break;
							case 12:
								if (rng.NextDouble() < 0.4) {
									switch(rng.Next(4)) {
										case 0: item[c] = save.objects["_525"].name; break;
										case 1: item[c] = save.objects["_529"].name; break;
										case 2: item[c] = save.objects["_888"].name; break;
										default: item[c] = save.objects["_" + rng.Next(531,533)].name;
									}
								} else {
									item[c] = "Mystery Box";
									itemQty[c] = 2;
								}
								break;
							case 13:
								item[c] = save.objects["_690"].name;
								break;
							default:
								// This should be unreachable, but the game code does it so we do too
								item[c] = save.objects["_382"].name;
								break;
						}
					}
					if (searchTerm.test(item[c])) {
						if (!searchResults.hasOwnProperty(item[c])) {
							searchResults[item[c]] = [ [], [], [] ];
						}
						searchResults[item[c]][c].push(numOpened);
						count++;
					}
				}
			}
			Object.keys(searchResults).sort().forEach( function(key, index) {
				itemIcon = (key == "Cork Bobber" || key == "Dressed Spinner") ? ' <span data-tooltip="Based on Fishing Skill"><img src="blank.png" class="icon" id="enchant_f" alt="Based on Fishing Skill"></span>' : "";
				output += '<tr><td class="item">' + wikify(key) + itemIcon + '</td>';
				for (c = 0; c < numColumns; c++) {
					if (searchResults[key][c].length > 0) {
						// Limit to first 5 results actually shown in table with ellipsis & tooltip for others
						output += '<td>' + searchResults[key][c].slice(0,5);
						if (searchResults[key][c].length > 5) {
							output += '<span data-tooltip="All results: ' + searchResults[key][c] + '">,...</span>';
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
				offset = pageSize * Math.floor(save.mysteryBoxesOpened[0] / pageSize);
			}
			if (offset < pageSize) {
				$('#mystery-prev').prop("disabled", true);
			} else {
				$('#mystery-prev').val(offset - pageSize);
				$('#mystery-prev').prop("disabled", false);
			}
			if (offset < 100) {
				$('#mystery-prev-100').prop("disabled", true);
			} else {
				$('#mystery-prev-100').val(offset - 100);
				$('#mystery-prev-100').prop("disabled", false);
			}
			$('#mystery-reset').val('reset');
			$('#mystery-reset').html("Reset Browsing");
			$('#mystery-next').val(offset + pageSize);
			$('#mystery-next').prop("disabled", false);
			$('#mystery-next-100').val(offset + 100);
			$('#mystery-next-100').prop("disabled", false);
			// Reset search fields too
			$('#mystery-search-text').val('');
			$('#mystery-search-range').val(200);
			$('#mystery-search-all').prop('checked', false);
			output += '<table class="output"><thead><tr><th rowspan="2" class="index">Num Open</th>' +
				'<th colspan="2" class="mystery-result">Mystery Box <a href="https://stardewvalleywiki.com/Mystery_Box">' +
				'<img src="blank.png" class="icon" id="mbox_b"></a></th>' +
				'<th colspan="2" class="mystery-result">Golden Mystery Box <a href="https://stardewvalleywiki.com/Golden_Mystery_Box">' +
				'<img src="blank.png" class="icon" id="mbox_g"></a><br/>Without Farming Mastery Perk</th>' +
				'<th colspan="2" class="mystery-result">Golden Mystery Box <a href="https://stardewvalleywiki.com/Golden_Mystery_Box">' +
				'<img src="blank.png" class="icon" id="mbox_g"></a><br/>With Farming Mastery Perk</th>';
			output += '</tr>\n<tr>';
			for (c = 0; c < numColumns; c++) {
				output += '<th class="item">Item</th><th class="qty">Qty</th>';
			}
			output += '</tr>\n<tbody>';
			for (g = 1; g <= pageSize; g++) {
				numOpened = offset + g;
				item = ['None', 'None', 'None'];
				itemQty = [1, 1, 1];
				noLink = [false, false, false];
				basedOnSkill = [false, false, false];
				// In theory, we could just keep 1 rng instance and use it for everything since all
				// 3 situations are seeded the same. But for practicality we run a separate instance
				// for each since the number of rolls and the pass thresholds vary.
				for (c = 0; c < numColumns; c++) {
					var rareMod = (c === 0 ? 1 : 2);
					var extraBookChance = save.gotMysteryBook ? 0 : 0.0004 * numOpened;
					rng = new CSRandom(getRandomSeed(numOpened, save.gameID/2));
					var i, j, prewarm_amount2 = rng.Next(1,10);
					for (j = 0; j < prewarm_amount2; j++) {
						rng.NextDouble();
					}
					prewarm_amount2 = rng.Next(1,10);
					for (i = 0; i < prewarm_amount2; i++) {
						rng.NextDouble();
					}
					if (numOpened > 10 || c > 0) {
						if (c == 2 && rng.NextDouble() < 0.005) {
							item[c] = "Golden Animal Cracker";
						} else if (rng.NextDouble() < (0.002 * rareMod)) {
							item[c] = save.objects["_279"].name;
						} else if (rng.NextDouble() < (0.004 * rareMod)) {
							item[c] = save.objects["_74"].name;
						} else if (rng.NextDouble() < (0.008 * rareMod)) {
							item[c] = save.objects["_166"].name;
						} else if (rng.NextDouble() < (0.01 * rareMod + extraBookChance)) {
							if (!save.gotMysteryBook) {
								item[c] = save.objects["_Book_Mystery"].name;
							} else {
								var choices = ["_PurpleBook", "_Book_Mystery"];
								item[c] = save.objects[choices[rng.Next(choices.length)]].name;
							}
						} else if (rng.NextDouble() < (0.01 * rareMod)) {
							var choices = ["_797", "_373"];
							item[c] = save.objects[choices[rng.Next(choices.length)]].name;
						} else if (rng.NextDouble() < (0.01 * rareMod)) {
							item[c] = "Mystery Hat";
						} else if (rng.NextDouble() < (0.01 * rareMod)) {
							item[c] = "Mystery Shirt";
						} else if (rng.NextDouble() < (0.01 * rareMod)) {
							item[c] = "Mystery Wallpaper";
						} else if (rng.NextDouble() < 0.1 || c > 0) {
							switch(rng.Next(15)) {
								case 0:
									item[c] = save.objects["_288"].name;
									itemQty[c] = 5;
									break;
								case 1:
									item[c] = save.objects["_253"].name;
									itemQty[c] = 3;
									break;
								case 2:
									// This only rolls at fishing skill >= 6
									if (rng.NextDouble() < .5) {
										var choices = ["_687", "_695"];
										item[c] = save.objects[choices[rng.Next(choices.length)]].name;
										basedOnSkill[c] = true;
									} else {
										item[c] = save.objects["_242"].name;
										itemQty[c] = 2;
									}
									break;
								case 3:
									item[c] = save.objects["_204"].name;
									itemQty[c] = 2;
									break;
								case 4:
									item[c] = save.objects["_369"].name;
									itemQty[c] = 20;
									break;
								case 5:
									item[c] = save.objects["_466"].name;
									itemQty[c] = 20;
									break;
								case 6:
									item[c] = save.objects["_773"].name;
									itemQty[c] = 2;
									break;
								case 7:
									item[c] = save.objects["_688"].name;
									itemQty[c] = 3;
									break;
								case 8:
									item[c] = save.objects["_" + rng.Next(628,634)].name;
									break;
								case 9:
									item[c] = "Seasonal Seeds";
									itemQty[c] = 20;
									noLink[c] = true;
									break;
								case 10:
									if (rng.NextDouble() < 0.5) {
										item[c] = "Ossified Blade";
									} else {
										var choices = ["_533", "_534"];
										item[c] = save.objects[choices[rng.Next(choices.length)]].name;
									}
									break;
								case 11:
									item[c] = save.objects["_621"].name;
									break;
								case 12:
									item[c] = "Mystery Box";
									itemQty[c] = rng.Next(3,5);
									break;
								case 13:
									item[c] = save.objects["_SkillBook_" + rng.Next(5)].name;
									break;
								case 14:
									item[c] = "Raccoon Seeds";
									itemQty[c] = 8;
									noLink[c] = true;
									break;
							}
						}
					}
					// Fall-through for first 10 boxes or no RNG success yet
					if (item[c] == 'None') {
						switch(rng.Next(14)) {
							case 0:
								item[c] = save.objects["_395"].name;
								itemQty[c] = 3;
								break;
							case 1:
								item[c] = save.objects["_287"].name;
								itemQty[c] = 5;
								break;
							case 2:
								item[c] = "Seasonal Seeds";
								itemQty[c] = 8;
								noLink[c] = true;
								break;
							case 3:
								item[c] = save.objects["_" + rng.Next(727,734)].name;
								break;
							case 4:
								roll = 217;
								while (roll == 217) {
									roll = rng.Next(194, 240);
								}
								item[c] = save.objects["_" + roll].name;
								break;
							case 5:
								item[c] = save.objects["_709"].name;
								itemQty[c] = 10;
								break;
							case 6:
								item[c] = save.objects["_369"].name;
								itemQty[c] = 10;
								break;
							case 7:
								item[c] = save.objects["_466"].name;
								itemQty[c] = 10;
								break;
							case 8:
								item[c] = save.objects["_688"].name;
								break;
							case 9:
								item[c] = save.objects["_689"].name;
								break;
							case 10:
								item[c] = save.objects["_770"].name;
								itemQty[c] = 10;
								break;
							case 11:
								item[c] = "Mixed Flower Seeds";
								itemQty[c] = 10;
								break;
							case 12:
								if (rng.NextDouble() < 0.4) {
									switch(rng.Next(4)) {
										case 0: item[c] = save.objects["_525"].name; break;
										case 1: item[c] = save.objects["_529"].name; break;
										case 2: item[c] = save.objects["_888"].name; break;
										default: item[c] = save.objects["_" + rng.Next(531,533)].name;
									}
								} else {
									item[c] = "Mystery Box";
									itemQty[c] = 2;
								}
								break;
							case 13:
								item[c] = save.objects["_690"].name;
								break;
							default:
								// This should be unreachable, but the game code does it so we do too
								item[c] = save.objects["_382"].name;
								break;
						}
					}
				}

				if (numOpened === save.mysteryBoxesOpened[0] + 1) {
					tclass = "current";
				} else if (numOpened <= save.mysteryBoxesOpened[0]) {
					tclass = "past";
				} else {
					tclass = "future";
				}
				output += '<tr class="' + tclass + '"><td>' + addCommas(numOpened) + '</td>';
				for (c = 0; c < numColumns; c++) {
					itemIcon = '';
					if (basedOnSkill[c]) {
						itemIcon = ' <span data-tooltip="Based on Fishing Skill"><img src="blank.png" class="icon" id="enchant_f" alt="Based on Fishing Skill"></span>';
					}
					output += '<td class="item">' + (noLink[c] ? item[c] : wikify(item[c])) + itemIcon + '</td><td>' + itemQty[c] + '</td>';
				}
				output += '</tr>';
			}
		}
		output += '<tr><td colspan="' + (1 + 2*numColumns) + '" class="legend">Note: <img src="blank.png" class="icon" id="enchant_f" alt="Based on Fishing Skill"> denotes items which will only roll if fishing skill is >= 6. If fishing skill is less, this result will instead be ' + wikify( save.objects["_242"].name) + ' x2</td></tr>';
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
					if (compareSemVer(save.version, "1.6") >= 0) {
						rng = new CSRandom(getRandomSeed(day + save.dayAdjust, save.gameID / 2));
					} else {
						rng = new CSRandom(save.gameID / 2 + day + save.dayAdjust);
					}
					if (day < 31) {
						thisTrain = '<span class="none">Railroad<br/>not yet<br/>accessible</span>';
					} else {
						thisTrain = '<span class="none">&nbsp;<br/>(No train)<br/>&nbsp</span>';
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
								thisTrain = '<img src="blank.png" class="event" id="train"><br/>Train at ' + hour + ':' + min + ampm;
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
					output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br/>' +
						'<span class="train cell">' + thisTrain + '</span></td>';
				}
				output += "</tr>\n";
			}
			output += "</tbody></table>\n";
		}

		return output;
	};

	function predictNight(isSearch, offset) {
		// logic from StardewValley.Utility.pickFarmEvent()
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
var test = {};
			for (week = 0; week < 4; week++) {
				output += "<tr>";
				for (weekDay = 1; weekDay < 8; weekDay++) {
					day = 7 * week + weekDay + offset;
					var couldBeWindstorm = false;
					// The event is actually rolled in the morning at 6am, but from a user standpoint it makes more sense
					// to think of it occuring during the previous night. We will offset the day by 1 because of this.
					if (day + save.dayAdjust === 30) {
						thisEvent = '<img src="blank.png" class="event" id="train"><br/>Earthquake';
					} else if (compareSemVer(save.version, "1.6") >= 0) {
						rng = new CSRandom(getRandomSeed(day + 1 + save.dayAdjust, save.gameID / 2));
						for (var i = 0; i < 10; i++) {
							rng.NextDouble();
						}
						// If the greenhouse has been repaired, an extra roll for the windstorm needs to happen; because of the
						// order of conditionals, this roll continues to happen even after the tree has fallen.
						if (save.greenhouseUnlocked) {
							couldBeWindstorm = rng.NextDouble() < 0.1;
						}
						// We still would like to check for possible windstorm in saves that don't yet have a greenhouse and in that
						// case we need to reuse the next event roll as the windstorm check.
						var nextRoll = rng.NextDouble();
						if (!save.greenhouseUnlocked) {
							couldBeWindstorm = nextRoll < 0.1;
						}
						// Fairy event chance +.007 if there is a full-grown fairy rose on the farm, but that is too volatile for us.
						if (nextRoll < 0.01 && (month%4) < 3) {
							thisEvent = '<img src="blank.png" class="event" id="event_f"><br/>Fairy';
						} else if (rng.NextDouble() < 0.01 && (day + 1 + save.dayAdjust) > 20) {
							thisEvent = '<img src="blank.png" class="event" id="event_w"><br/>Witch';
						} else if (rng.NextDouble() < 0.01 && (day + 1 + save.dayAdjust) > 5) {
							thisEvent = '<img src="blank.png" class="event" id="event_m"><br/>Meteor';
						} else if (rng.NextDouble() < 0.005) {
							thisEvent = '<img src="blank.png" class="event" id="event_o"><br/>Stone Owl';
						} else if (rng.NextDouble() < 0.008 && year > 1) {
							thisEvent = '<img src="blank.png" class="event" id="event_c"><br/>Strange Capsule';
						} else {
							thisEvent = '<span class="none">&nbsp;<br/>(No event)<br/>&nbsp</span>';
						}
					} else {
						rng = new CSRandom(save.gameID / 2 + day + 1 + save.dayAdjust);
						if (compareSemVer(save.version, "1.3") < 0 && save.canHaveChildren && rng.NextDouble() < 0.05) {
							thisEvent = '<img src="blank.png" class="event" id="event_b"><br/>"Want a Baby?"';
						} else if (rng.NextDouble() < 0.01 && (month%4) < 3) {
							thisEvent = '<img src="blank.png" class="event" id="event_f"><br/>Fairy';
						} else if (rng.NextDouble() < 0.01) {
							thisEvent = '<img src="blank.png" class="event" id="event_w"><br/>Witch';
						} else if (rng.NextDouble() < 0.01) {
							thisEvent = '<img src="blank.png" class="event" id="event_m"><br/>Meteor';
						} else {
							if (compareSemVer(save.version, "1.5") < 0) {
								if (rng.NextDouble() < 0.01 && year > 1) {
									thisEvent = '<img src="blank.png" class="event" id="event_c"><br/>Strange Capsule';
								} else if (rng.NextDouble() < 0.01) {
									thisEvent = '<img src="blank.png" class="event" id="event_o"><br/>Stone Owl';
								} else {
									thisEvent = '<span class="none">&nbsp;<br/>(No event)<br/>&nbsp</span>';
								}
							} else if (compareSemVer(save.version, "1.5.3") < 0) {
								if (rng.NextDouble() < 0.008 && year > 1) {
									thisEvent = '<img src="blank.png" class="event" id="event_c"><br/>Strange Capsule';
								} else if (rng.NextDouble() < 0.008) {
									thisEvent = '<img src="blank.png" class="event" id="event_o"><br/>Stone Owl';
								} else {
									thisEvent = '<span class="none">&nbsp;<br/>(No event)<br/>&nbsp</span>';
								}
							} else {
								if (rng.NextDouble() < 0.005) {
									thisEvent = '<img src="blank.png" class="event" id="event_o"><br/>Stone Owl';
								} else if (rng.NextDouble() < 0.008 && year > 1) {
									thisEvent = '<img src="blank.png" class="event" id="event_c"><br/>Strange Capsule';
								} else {
									thisEvent = '<span class="none">&nbsp;<br/>(No event)<br/>&nbsp</span>';
								}
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
					var extra = couldBeWindstorm ? ' <span class="wind"><img alt="Tree Stump" src="blank.png" class="mid" id="stump"></span>' : "";
					output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span>' + extra + '<br/>' +
						'<span class="night cell">' + thisEvent + '</span></td>';
				}
				output += "</tr>\n";
			}
			output += '<tr><td colspan="7" class="middle legend"><img src="blank.png" class="mid" alt="Tree Stump" id="stump"> <span>Indicates a day which could be the windstorm that knocks down the big tree in Cindersap Forest (only shows on 1.6 saves)</span></td></tr>';
			output += "</tbody></table>\n";
Object.keys(test).forEach(function(key, index) { if (test[key].s > 0 && test[key].q > 0) { console.log("** Save id " + key + " has a giant seasonal on " + test[key].s + " and a giant qi on " + monthName + " " + test[key].q + ", Y" + year); } }); 
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
					if (compareSemVer(save.version, "1.6") >= 0) {
						rng = new CSRandom(getRandomSeed(save.gameID, day + save.dayAdjust - 1));
					} else {
						rng = new CSRandom(save.gameID + day + save.dayAdjust - 1);
					}
					if (compareSemVer(save.version, "1.4") >= 0 && rng.NextDouble() < 0.25) {
						thisEvent = '<span class="none"><img src="blank.png" class="tall" id="movie_gs"><br/>(Game In Use)</span>';
					} else {
						thisEvent = 'Game Can<br/>Be Played<br>&nbsp;';
					}

					if (day < save.daysPlayed) {
						tclass = "past";
					} else if (day === save.daysPlayed) {
						tclass = "current";
					} else {
						tclass = "future";
					}
					output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br/>' +
						'<span class="crane cell">' + thisEvent+ '</span></td>';
				}
				output += "</tr>\n";
			}
			output += "</tbody></table>\n";
		}
		return output;
	};

	function predictResortVisitors(isSearch, offset) {
		// StardewValley.Locations.IslandSouth.SetupIslandSchedules() and some helper functions
		// Currently disabled because the NPC list seems too volatile to predict
		var output = "",
			rng,
			validVisitors,
			visitors,
			children = { 'Jas': 1, 'Vincent': 1, 'Leo': 1 },
			groups = [["Sebastian","Sam","Abigail"],["Jodi","Kent","Vincent","Sam"],["Jodi","Vincent","Sam"],["Pierre","Caroline","Abigail"],["Robin","Demetrius","Maru","Sebastian"],["Lewis","Marnie"],["Marnie","Shane","Jas"],["Penny","Jas","Vincent"],["Pam","Penny"],["Caroline","Marnie","Robin","Jodi"],["Haley","Penny","Leah","Emily","Maru","Abigail"],["Alex","Sam","Sebastian","Elliott","Shane","Harvey"]],
			i,
			day,
			weekDay,
			week,
			monthName,
			month,
			year,
			festival,
			thisEvent,
			tclass;
		if (typeof(offset) === 'undefined') {
			offset = 28 * Math.floor(save.daysPlayed/28);
		}
		if (offset < 112) {
			$('#resort-prev-year').prop("disabled", true);
		} else {
			$('#resort-prev-year').val(offset - 112);
			$('#resort-prev-year').prop("disabled", false);
		}
		if (offset < 28) {
			$('#resort-prev-month').prop("disabled", true);
		} else {
			$('#resort-prev-month').val(offset - 28);
			$('#resort-prev-month').prop("disabled", false);
		}
		$('#resort-reset').val('reset');
		$('#resort-next-month').val(offset + 28);
		$('#resort-next-year').val(offset + 112);
		month = Math.floor(offset / 28);
		monthName = save.seasonNames[month % 4];
		year = 1 + Math.floor(offset / 112);
		output += '<table class="calendar"><thead><tr><th colspan="7">' + monthName + ' Year ' + year + '</th></tr>\n';
		output += '<tr><th>M</th><th>T</th><th>W</th><th>Th</th><th>F</th><th>Sa</th><th>Su</th></tr></thead>\n<tbody>';
		for (week = 0; week < 4; week++) {
			output += "<tr>";
			for (weekDay = 1; weekDay < 8; weekDay++) {
				visitors = [];
				day = 7 * week + weekDay + offset;
				// Immediately exclude festival days. We are approaching them weirdly via day counter
				festival = '';
				switch (day % 112) {
					case 13: festival = "Egg Festival"; break;
					case 24: festival = "Flower Dance"; break;
					case 39: festival = "Luau"; break;
					case 56: festival = "Moonlight Jellies"; break;
					case 72: festival = "Valley Fair"; break;
					case 83: festival = "Spirit's Eve"; break;
					case 92: festival = "Ice Festival"; break;
					case 109: festival = "Winter Star"; break;
				}

				if (festival !== '') {
					thisEvent = '<span class="none">Closed for<br/>' + festival + '</span>';
				} else {
					// Next are checks we either can't or don't want to do -- resort not built, raining, resort closed
					rng = new CSRandom(1.21*save.gameID + 2.5*(day + save.dayAdjust));
					// Game populates this dynamically; we did our best to mimic that from reading the save earlier and we
					// will now further process the list.
					validVisitors = { };
					visitors = [];
					for (var i = 0; i < save.characters.length; i++) {
						// Trying to emulate StardewValley.Locations.IslandSouth.CanVisitIslandToday()
						// Note that we can't check for invisibility since that is a temporary condition.
						var who = save.characters[i];
						var valid = true;
						if ((who === "Penny" || who === "Jas" || who === "Vincent") &&
							(weekDay === 2 || weekDay === 3 || weekDay === 5)) {
							valid = false;
						} else if ((who === "Harvey" || who === "Maru") && (weekDay === 2 || weekDay === 4)) {
							valid = false;
						} else if (who === "Clint" && weekDay !== 5) {
							valid = false;
						} else if (who === "Robin" && weekDay !== 2) {
							valid = false;
						} else if (who === "Marnie" && (weekDay !== 1 || weekDay !== 2)) {
							valid = false;
						} else if (who === "Sandy" || who === "Dwarf" || who === "Krobus" || who === "Wizard" || who === "Linus" || who === "Willy" || who === "Evelyn" || who === "George") {
							valid = false;
						} else {
							// Mimicing Utility.IsHospitalVisitDay but ignoring those already excluded
							var dayOfYear = day % 112;
							if (who === "Abigail" && dayOfYear === 4) {
								valid = false;
							} else if (who === "Alex" && dayOfYear === 44) {
								valid = false;
							} else if (who === "Caroline" && dayOfYear === 81) {
								valid = false;
							} else if (who === "Clint" && dayOfYear === 100) {
								valid = false;
							} else if (who === "Demetrius" && dayOfYear === 53) {
								valid = false;
							} else if (who === "Elliott" && dayOfYear === 37) {
								valid = false;
							} else if (who === "Emily" && dayOfYear === 95) {
								valid = false;
							} else if (who === "Gus" && dayOfYear === 60) {
								valid = false;
							} else if (who === "Haley" && dayOfYear === 93) {
								valid = false;
							} else if (who === "Harvey" && dayOfYear === 99) {
								valid = false;
							} else if (who === "Jas" && dayOfYear === 102) {
								valid = false;
							} else if (who === "Jodi" && (dayOfYear === 11 || dayOfYear === 18)) {
								valid = false;
							} else if (who === "Leah" && dayOfYear === 16) {
								valid = false;
							} else if (who === "Lewis" && dayOfYear === 65) {
								valid = false;
							} else if (who === "Marnie" && (dayOfYear === 102 || dayOfYear === 74)) {
								valid = false;
							} else if (who === "Pam" && dayOfYear === 25) {
								valid = false;
							} else if (who === "Penny" && dayOfYear === 88) {
								valid = false;
							} else if (who === "Robin" && dayOfYear === 44) {
								valid = false;
							} else if (who === "Sam" && dayOfYear === 67) {
								valid = false;
							} else if (who === "Sebastian" && dayOfYear === 32) {
								valid = false;
							} else if (who === "Vincent" && dayOfYear === 11) {
								valid = false;
							}
						}
						if (valid) {
							validVisitors[who] = 1;
						}
					}
					if (rng.NextDouble() < 0.4) {
						for (i = 0; i < 5 - visitors.length; i++) {
							var keys = Object.keys(validVisitors);
							var who = keys[rng.Next(keys.length)];
							if (!children.hasOwnProperty(who)) {
								delete validVisitors[who];
								visitors.push(who);
							}
						}
					} else {
						var group = groups[rng.Next(groups.length)];
						var failed = false;
						for (i = 0; i < group.length; i++) {
							if (!validVisitors.hasOwnProperty(group[i])) {
								failed = true;
								break;
							}
						}
						if (!failed) {
							for (i = 0; i < group.length; i++) {
								delete validVisitors[group[i]];
								visitors.push(group[i]);
							}
						}
						for (i = 0; i < 5 - visitors.length; i++) {
							var keys = Object.keys(validVisitors);
							var who = keys[rng.Next(keys.length)];
							if (!children.hasOwnProperty(who)) {
								delete validVisitors[who];
								visitors.push(who);
							}
						}
					}

					thisEvent = visitors.join(',<br/>');
				}

				if (day < save.daysPlayed) {
					tclass = "past";
				} else if (day === save.daysPlayed) {
					tclass = "current";
				} else {
					tclass = "future";
				}

				output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br/>' +
					'<span class="resort cell">' + thisEvent+ '</span></td>';

			}
			output += "</tr>\n";
		}
		output += "</tbody></table>\n";
		return output;
	}

	function predictEnchantments(isSearch, offset) {
		// logic from StardewValley.BaseEnchantment.GetEnchantmentFromItem()
		var output = '',
			timesEnchanted,
			item,
			g,
			c,
			e,
			next,
			tclass,
			searchTerm,
			searchStart,
			searchEnd,
			searchResults,
			count,
			pageSize = 20,
			bigPageSize = 100,
			labels = ['Weapon', 'Pickaxe', 'Axe', 'Hoe', 'Watering Can', 'Fishing Rod', 'Pan'],
			numColumns = labels.length,
			validEnchants = [
				['Artful', 'Bug Killer', 'Vampiric', 'Crusader', 'Haymaker'],
				['Powerful', 'Efficient', 'Swift'],
				['Powerful', 'Shaving', 'Efficient', 'Swift'],
				['Reaching', 'Generous', 'Archaeologist', 'Efficient', 'Swift'],
				['Reaching', 'Bottomless', 'Efficient'],
				['Master', 'Auto Hook', 'Preserving', 'Efficient'],
				['Reaching', 'Generous', 'Archaeologist', 'Fisher'],
			],
			roll,
			roll2,
			roll3,
			randRoll,
			tooltip,
			result,
			result2,
			result3,
			rng;

		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			// This has become too complicated for searching.
		} else {
			// We need to know what player to use for setting up the initial offset this early.
			var whichPlayer = 0;
			// Player selection menu will only show if there are multiple players.
			if (typeof(save.mp_ids) !== 'undefined' && save.mp_ids.length > 1) {
				$('#enchant-player').show();
				if ($('#enchant-player-select option').length == 0) {
					// populate menu and default to main farmer.
					for (var player = 0; player < save.mp_ids.length; player++) {
						var prefix = (player == 0) ? 'Main Farmer ' : 'Farmhand ';
						var o = new Option( prefix + save.names[player], player);
						if (player == 0) { o.selected = true; }
						$('#enchant-player-select').append(o);
					}
				} else {
					whichPlayer = $('#enchant-player-select').val();
				}
			} else {
				$('#enchant-player').hide();
			}	
			if (typeof(offset) === 'undefined') {
				offset = pageSize * Math.floor(save.timesEnchanted[whichPlayer] / pageSize);
			}
			if (offset < pageSize) {
				$('#enchant-prev').prop("disabled", true);
			} else {
				$('#enchant-prev').val(offset - pageSize);
				$('#enchant-prev').prop("disabled", false);
			}
			if (offset < bigPageSize) {
				$('#enchant-prev-big').prop("disabled", true);
			} else {
				$('#enchant-prev-big').val(offset - bigPageSize);
				$('#enchant-prev-big').prop("disabled", false);
			}
			$('#enchant-reset').val('reset');
			$('#enchant-reset').html("Reset Browsing");
			$('#enchant-next').val(offset + pageSize);
			$('#enchant-next').prop("disabled", false);
			$('#enchant-next-big').val(offset + bigPageSize);
			$('#enchant-next-big').prop("disabled", false);
			output += '<table class="output"><thead><tr><th class="index">Num Ench.</th>' +
				'<th class="enchant-result item">Weapon <a href="https://stardewvalleywiki.com/Weapons">' +
				'<img src="blank.png" class="dark icon" id="enchant_w"></a></th>' +
				'<th class="enchant-result item">Pickaxe <a href="https://stardewvalleywiki.com/Pickaxes">' +
				'<img src="blank.png" class="dark icon" id="enchant_p"></a></th>' +
				'<th class="enchant-result item">Axe <a href="https://stardewvalleywiki.com/Axes">' +
				'<img src="blank.png" class="dark icon" id="enchant_a"></a></th>' +
				'<th class="enchant-result item">Hoe <a href="https://stardewvalleywiki.com/Hoes">' +
				'<img src="blank.png" class="dark icon" id="enchant_h"></a></th>' +
				'<th class="enchant-result item">Watering Can <a href="https://stardewvalleywiki.com/Watering_Cans">' +
				'<img src="blank.png" class="dark icon" id="enchant_c"></a></th>' +
				'<th class="enchant-result">Fishing Rod <a href="https://stardewvalleywiki.com/Fishing_Rods">' +
				'<img src="blank.png" class="dark icon" id="enchant_f"></a></th>' +
				'<th class="enchant-result">Pan <a href="https://stardewvalleywiki.com/Pans">' +
				'<img src="blank.png" class="dark icon" id="enchant_n"></a></th>';
			output += '</tr>\n<tbody>';
			for (g = 1; g <= pageSize; g++) {
				timesEnchanted = offset + g;
				item = [];
				tooltip = [];
				// I don't recall why this needs to be offset by 1, but it does
				if (compareSemVer(save.version, "1.6") >= 0) {
					if (typeof(save.mp_ids) !== 'undefined') {
						rng = new CSRandom(getRandomSeedFromBigInts(bigInt(timesEnchanted - 1), bigInt(save.gameID), save.mp_ids[whichPlayer]));
					} else {
						rng = new CSRandom(getRandomSeed(timesEnchanted - 1, save.gameID, 0));
						$('#enchant-note').html('Note: No players found; predictions will not be reliable for game version >= 1.6');
					}
				} else {
					rng = new CSRandom(timesEnchanted + save.gameID - 1);
				}

				randRoll = rng.NextDouble();
				for (c = 0; c < numColumns; c++) {
					roll = Math.floor(randRoll*validEnchants[c].length);
					result = validEnchants[c][roll];
					item[c] = [wikify(result)];
					tooltip[c] = labels[c] + " enchant (" + g + ")\n\nNone &#x2192; " + result + "\n\n";
					roll2 = Math.floor(randRoll*(validEnchants[c].length-1));
					if (roll2 < roll) {
						item[c].push(wikify(validEnchants[c][roll2]));
					} else {
						item[c].push(wikify(validEnchants[c][roll2 + 1]));
					}
					roll3 = Math.floor(randRoll*(validEnchants[c].length-2));
					if (roll3 < roll2) {
						item[c].push(wikify(validEnchants[c][roll3]));
					} else {
						// this means they are equal and the previous stored values are this number + 1 more
						item[c].push(wikify(validEnchants[c][roll3 + 2]));
					}
					for (e = 0; e < validEnchants[c].length; e++) {
						var i = roll2 + (e <= roll2 ? 1 : 0);
						result2 = validEnchants[c][i];
						var j = roll3 + (e <= roll3 ? 1 : 0);
						if (i === j) {
							j++;
							if (e === j) {
								j++;
							}
						}
						result3 = validEnchants[c][j];
						tooltip[c] += validEnchants[c][e] + " &#x2192; " + result2 + " or " + result3 + "\n";
					}
				}
				if (timesEnchanted === save.timesEnchanted[whichPlayer] + 1) {
					tclass = "current";
				} else if (timesEnchanted <= save.timesEnchanted[whichPlayer]) {
					tclass = "past";
				} else {
					tclass = "future";
				}
				output += '<tr class="' + tclass + '"><td>' + addCommas(timesEnchanted) + '</td>';
				for (c = 0; c < numColumns; c++) {
					output += '<td class="item">' + item[c][0] + ', ' + item[c][1] + '<br/>or ' + item[c][2] +
						'<br/><span class="note" data-tooltip="' + tooltip[c] + '">(...)</span></td>';
				}
				output += '</tr>';
			}
		}
		output += '</tbody></table>';
		return output;
	}

	function predictMineChests(isSearch, offset) {
		var output = "",
			floor,
			rng,
			item,
			choices = {
				10: [save.boots[506], save.boots[507], save.weapons[12], save.weapons[17], save.weapons[22], save.weapons[31]],
				20: [save.weapons[11], save.weapons[24], save.weapons[20], save.objects["_517"].name, save.objects["_519"].name],
				30: ["(No chest)"],
				40: [save.weapons[32]],
				50: [save.boots[509], save.boots[510], save.boots[508], save.weapons[1], save.weapons[43]],
				60: [save.weapons[21], save.weapons[44], save.weapons[6], save.weapons[18], save.weapons[27]],
				70: [save.weapons[33]],
				80: [save.boots[512], save.boots[511], save.weapons[10], save.weapons[7], save.weapons[46], save.weapons[19]],
				90: [save.weapons[8], save.weapons[52], save.weapons[45], save.weapons[5], save.weapons[60]],
				100: ["Stardrop"],
				110: [save.boots[514], save.boots[878], save.weapons[50], save.weapons[28]],
				120: ["Skull Key"]
			};

		output += '<table class="output"><thead><tr><th>Floor</th><th>Item in Chest</th></tr>';

		for (floor = 10; floor < 121; floor += 10) {
			// From StardewValley.Locations.MineShaft.GetReplacementChestItem()
			if (compareSemVer(save.version, "1.6") >= 0) {
				rng = new CSRandom(getRandomSeedFromBigInts(bigInt(save.gameID).times(512), bigInt(floor)));
			} else {
				rng = new CSRandom(bigIntToSigned32(bigInt(save.gameID).times(512).plus(floor)));
			}
			item = choices[floor][rng.Next(choices[floor].length)];
			if (floor !== 30) {
				item = wikify(item);
			}

			output += '<tr><td>' + floor + '</td><td>' + item + '</tr></tr>';
		}
		output += "</tbody></table>\n";
		return output;
	}

	function predictGemBirds(isSearch, offset) {
		var output = "",
			// StardewValley.IslandGemBird.GemBirdType
			birds = ["Green", "Blue", "Red", "Purple", "Brown"],
			gems = { "Green": "Emerald", "Blue": "Aquamarine", "Red": "Ruby", "Purple": "Amethyst", "Brown": "Topaz" },
			locs = ["North (Dig Site / Volcano)", "South (Docks / Resort)", "East (Jungle)", "West (Farm)"],
			i,
			j,
			temp,
			rng;

		if (compareSemVer(save.version, "1.5") < 0) {
			$('#gembirds-note').html("This is meaningless in pre-1.5 games since the Island and birds don't exist.");
		} else {
			$('#gembirds-note').html('');
		}

		output += '<table class="output"><thead><tr><th colspan>Direction (Location)</th><th>Bird Type</th></tr>';
		// StardewValley.IslandGemBird.GetBirdTypeForLocation() and StardewValley.Utility.Shuffle()
		if (compareSemVer(save.version, "1.6") >= 0) {
			rng = new CSRandom(getRandomSeed(save.gameID));
		} else {
			rng = new CSRandom(save.gameID);
		}
		i = birds.length;
		while (i > 1) {
			j = rng.Next(i--);
			temp = birds[i];
			birds[i] = birds[j];
			birds[j] = temp;
		}

		for (i = 0; i < locs.length; i++) {
			output += '<tr><td>' + locs[i] + "</td><td>" + birds[i] + " (" + wikify(gems[birds[i]])+ ")</td></tr>";
		}
		output += "</tbody></table>\n";
		return output;
	}

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
							'Leo': ['Clay', 'Ancient Doll', 'Rainbow Shell', 'Geode', 'Frozen Geode', 'Magma Geode'],
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
		if (compareSemVer(save.version, "1.5") >= 0) {
			npcs.push("Leo");
			if (!save.leoMoved) {
				excluded['Leo'] = 1;
			}
		}
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

		if (typeof save.names !== "undefined" && typeof save.mp_ids !== "undefined") {
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
			if (forceOldLogic || compareSemVer(save.version, "1.3") < 0) {
				rng = new CSRandom(save.gameID / 2 - year);
			} else {
				//(int)(Game1.uniqueIDForThisGame / 2uL) ^ Game1.year ^ (int)Game1.player.UniqueMultiplayerID);
				var UMP_ID = bigIntToSigned32(save.mp_ids[player]);
				var base = bigIntToSigned32(bigInt(save.gameID).divide(2));
				var seed = base ^ year ^ UMP_ID;
				rng = new CSRandom( seed );
				playerName = save.names[player];
			}
			if (!forceOldLogic && compareSemVer(save.version, "1.6") >= 0) {
				// In Stardew 1.6, code ref is now StardewValley.Utility.GetRandomWinterStarParticipant()
				// The logic is a little different and we will start by simply building a new NPC list
				// which we copy before using since we may remove characters from it.
				var orig = ['Abigail', 'Caroline', 'Clint', 'Demetrius', 'Willy', 'Elliott', 'Emily',
						'Evelyn', 'George', 'Gus', 'Haley', 'Harvey', 'Jas', 'Jodi', 'Alex', 'Kent',
						'Leah', 'Lewis', 'Linus', 'Marlon', 'Marnie', 'Maru', 'Pam',
						'Penny', 'Pierre', 'Robin', 'Sam', 'Sebastian', 'Shane', 'Vincent'];
				if (save.leoMoved) { orig.push('Leo'); }
				npcs = orig.slice();
				secretSantaGiveTo = '';
				//rng = new CSRandom(getRandomSeed(save.gameID / 2, year, save.mp_ids[player]));
				rng = new CSRandom(getRandomSeedFromBigInts(bigInt(save.gameID).divide(2), bigInt(year), save.mp_ids[player]));
				while (secretSantaGiveTo === '') {
					var index = rng.Next(npcs.length);
					var pick = npcs[index];
					// Marlon must be removed here if picked because of "CanSocialize": "FALSE"
					if (pick === 'Marlon' || (year === 1 && pick === 'Kent')) {
						npcs.splice(index,1);
					} else {
						secretSantaGiveTo = pick;
					}
				}
				// New NPC list which should exclude the previous pick and anyone divorced from player
				// The RNG is also re-seeded which is weird.
				npcs = orig.slice();
				secretSantaGetFrom = '';
				npcs.splice(npcs.indexOf(secretSantaGiveTo),1);
				rng = new CSRandom(getRandomSeedFromBigInts(bigInt(save.gameID).divide(2), bigInt(year), save.mp_ids[player]));
				while (secretSantaGetFrom === '') {
					index = rng.Next(npcs.length);
					var pick = npcs[index];
					if (pick === 'Marlon' || (year === 1 && pick === 'Kent')) {
						npcs.splice(index,1);
					} else {
						secretSantaGetFrom = pick;
					}
				}
			} else {
				secretSantaGiveTo = npcs[rng.Next(npcs.length)];
				secretSantaGetFrom = '';
				// In addition to 5 hardcoded exclusions, NPCs are not eligible if they haven't been met yet; technically we should probably be
				// searching the save to make sure the target has been met, but for now we simply exclude year 1 Kent and assume the rest are fine.
				// The exception is Leo who we explicitly check for.
				while (excluded.hasOwnProperty(secretSantaGiveTo) || (year === 1 && secretSantaGiveTo === 'Kent')) {
					secretSantaGiveTo = npcs[rng.Next(npcs.length)];
				}
				while (secretSantaGetFrom === '' || secretSantaGetFrom === secretSantaGiveTo || excluded.hasOwnProperty(secretSantaGetFrom) ||
					(year === 1 && secretSantaGetFrom === 'Kent') ) {
					secretSantaGetFrom = npcs[rng.Next(npcs.length)];
				}
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

	function getNicerOutfitDescription(str) {
		// Parses Makeover outfit IDs and formats them more nicely
		// Lots of formatting assumptions and very little error checking
		const regexCap = /[A-Z]/g;
		var newstr = str.replace(regexCap, " $&");
		//const regexColor = /\[(\#[^\]]+)\]/g;
		//var newstr = newstr.replace(regexColor, (match, p1) => ntc.name(p1)[1]);
		var pieces = newstr.trim().split('_');
		if (pieces[0] === "None") { pieces[0] = "(No Hat)"; } 
		return pieces.join('<br/>');
	}

	function predictMakeover(isSearch, offset) {
		// Originally this was just the makeover outfits but it's now been expanded to general desert festival stuff
		// makeover logic from StardewValley.Locations.DesertFestival.ReceiveMakeOver()
		// vendor logic from StardewValley.Locations.DesertFestival.SetupFestivalDay() and Data/Shops
		var output = "",
			day,
			year,
			rng,
			roll,
			makeoverChoices = {
				'Male': ['Dark Ballcap<br/>Skeleton Shirt<br/>Tight Pants <span class="swatch" style="color:#dfd5b7">██</span>','Dinosaur Hat<br/>Red Striped Shirt<br/>Dinosaur Pants','Hair Bone<br/>Caveman Shirt<br/>Grass Skirt','Santa Hat<br/>Fancy Red Blouse<br/>Shorts <span class="swatch" style="color:#8bff63">██</span>','Cat Ears<br/>Short Jacket <span class="swatch" style="color:Red">██</span><br/>Genie Pants <span class="swatch" style="color:#e8d888">██</span>','Goggles<br/>Circuitboard Shirt<br/>Baggy Pants <span class="swatch" style="color:#3c633e">██</span>','(No Hat)<br/>Shirt – ID (S)1089<br/>Farmer Pants <span class="swatch" style="color:#9658d3">██</span>','Joja Cap<br/>Shirt – ID (S)1105<br/>Farmer Pants <span class="swatch" style="color:#2e55b7">██</span>','Beanie<br/>Skull Shirt<br/>Farmer Pants <span class="swatch" style="color:#282828">██</span>','(No Hat)<br/>Gray Suit<br/>Farmer Pants <span class="swatch" style="color:#989b92">██</span>','Laurel Wreath Crown<br/>Toga Shirt<br/>Skirt <span class="swatch" style="color:#f7f5cd">██</span>','Straw Hat<br/>Yellow Suit<br/>Farmer Pants <span class="swatch" style="color:#f2bd 2">██</span>','Gnome\'s Cap<br/>Green Tunic<br/>Skirt <span class="swatch" style="color:#297216">██</span>','Cowboy Hat<br/>Excavator Shirt<br/>Farmer Pants <span class="swatch" style="color:#a86f 1">██</span>','Good Ol\' Cap<br/>Brown Overalls<br/>Farmer Pants <span class="swatch" style="color:#824e 1">██</span>','(No Hat)<br/>Black Leather Jacket<br/>Baggy Pants <span class="swatch" style="color:#303030">██</span>','(No Hat)<br/>Shirt – ID (S)1099<br/>Farmer Pants <span class="swatch" style="color:#353535">██</span>','(No Hat)<br/>Store Owner\'s Jacket<br/>Farmer Pants <span class="swatch" style="color:#25562a">██</span>','Delicate Bow<br/>Shirt – ID (S)1092<br/>Skirt <span class="swatch" style="color:#f25769">██</span>','(No Hat)<br/>Shirt – ID (S)1088<br/>Shorts <span class="swatch" style="color:#63dd8d">██</span>','(No Hat)<br/>Sailor Shirt<br/>Shorts <span class="swatch" style="color:#465aa3">██</span>','(No Hat)<br/>Dark Shirt<br/>Tight Pants <span class="swatch" style="color:#515151">██</span>','Totem Mask<br/>Fake Muscles Shirt <span class="swatch" style="color:#f9ae89">██</span><br/>Shorts <span class="swatch" style="color:#128c17">██</span>','(No Hat)<br/>Crop Tank Top (M) <span class="swatch" style="color:#ffebcb">██</span><br/>Farmer Pants <span class="swatch" style="color:#683535">██</span>','(No Hat)<br/>Basic Pullover (M) <span class="swatch" style="color:#ffc6 0">██</span><br/>Relaxed Fit Shorts <span class="swatch" style="color:#5997d1">██</span>','Mouse Ears<br/>Shirt – ID (S)1066<br/>Shorts <span class="swatch" style="color:#b7a3a3">██</span>','Propeller Hat<br/>Jester Shirt<br/>Farmer Pants <span class="swatch" style="color:# 2b8e0">██</span>','(No Hat)<br/>Crab Cake Shirt<br/>Farmer Pants <span class="swatch" style="color:#bf2116">██</span>','Sou\'wester<br/>Rain Coat<br/>Relaxed Fit Pants <span class="swatch" style="color:#ffa9 2">██</span>','(No Hat)<br/>Camo Shirt<br/>Relaxed Fit Pants <span class="swatch" style="color:#6b3f17">██</span>','(No Hat)<br/>Collared Shirt <span class="swatch" style="color:#63ccb9">██</span><br/>Farmer Pants <span class="swatch" style="color:#e2ac5a">██</span>','Hard Hat<br/>Oil Stained Shirt<br/>Relaxed Fit Pants <span class="swatch" style="color:#638460">██</span>','Party Hat<br/>Happy Shirt<br/>Farmer Pants <span class="swatch" style="color:#e21b1b">██</span>','(No Hat)<br/>White Gi<br/>Simple Dress <span class="swatch" style="color:#fcd7ab">██</span>','(No Hat)<br/>Trash Can Shirt<br/>Shorts <span class="swatch" style="color:#757575">██</span>','(No Hat)<br/>Turtleneck Sweater <span class="swatch" style="color:#38c3ff">██</span><br/>Farmer Pants <span class="swatch" style="color:#632f18">██</span>','Pageboy Cap<br/>Mayoral Suspenders<br/>Farmer Pants <span class="swatch" style="color:#702616">██</span>','(No Hat)<br/>Retro Rainbow Shirt<br/>Farmer Pants <span class="swatch" style="color:#ad2b69">██</span>','(No Hat)<br/>Shirt – ID (S)1031<br/>Skirt <span class="swatch" style="color:#a5836a">██</span>','(No Hat)<br/>Green Overalls<br/>Farmer Pants <span class="swatch" style="color:#3043e8">██</span>','(No Hat)<br/>Shirt – ID (S)1074<br/>Relaxed Fit Pants <span class="swatch" style="color:#ba 5 5">██</span>','(No Hat)<br/>Shirt – ID (S)1116<br/>Farmer Pants <span class="swatch" style="color:#ffb547">██</span>','(No Hat)<br/>Shirt – ID (S)1126<br/>Baggy Pants <span class="swatch" style="color:#6a36d8">██</span>','(No Hat)<br/>Tunnelers Jersey<br/>Relaxed Fit Shorts <span class="swatch" style="color:#514b41">██</span>','Official Cap<br/>Officer Uniform<br/>Farmer Pants <span class="swatch" style="color:#35345b">██</span>','(No Hat)<br/>Dark Striped Shirt <span class="swatch" style="color:#ffffff">██</span><br/>Baggy Pants <span class="swatch" style="color:#333333">██</span>','(No Hat)<br/>Basic Pullover (M) <span class="swatch" style="color:#9fff72">██</span><br/>Tight Pants <span class="swatch" style="color:#97ff72">██</span>'],
				'Female': ['Dark Ballcap<br/>Skeleton Shirt<br/>Tight Pants <span class="swatch" style="color:#dfd5b7">██</span>','Dinosaur Hat<br/>Red Striped Shirt<br/>Dinosaur Pants','Spotted Headscarf<br/>Classy Top (F)<br/>Dress <span class="swatch" style="color:#8e 1 1">██</span>','Hair Bone<br/>Caveman Shirt<br/>Grass Skirt','Santa Hat<br/>Fancy Red Blouse<br/>Shorts <span class="swatch" style="color:#8bff63">██</span>','Cat Ears<br/>Short Jacket <span class="swatch" style="color:Red">██</span><br/>Genie Pants <span class="swatch" style="color:#e8d888">██</span>','Goggles<br/>Circuitboard Shirt<br/>Baggy Pants <span class="swatch" style="color:#3c633e">██</span>','(No Hat)<br/>Shirt – ID (S)1089<br/>Farmer Pants <span class="swatch" style="color:#9658d3">██</span>','Joja Cap<br/>Shirt – ID (S)1105<br/>Farmer Pants <span class="swatch" style="color:#2e55b7">██</span>','Logo Cap<br/>Sugar Shirt<br/>Skirt <span class="swatch" style="color:#f9acba">██</span>','Laurel Wreath Crown<br/>Toga Shirt<br/>Skirt <span class="swatch" style="color:#f7f5cd">██</span>','(No Hat)<br/>Shirt – ID (S)1072<br/>Simple Dress <span class="swatch" style="color:#698ec6">██</span>','Daisy<br/>Shirt – ID (S)1118<br/>Skirt <span class="swatch" style="color:#5da4f7">██</span>','Straw Hat<br/>Green Buttoned Vest <span class="swatch" style="color:Red">██</span><br/>Skirt <span class="swatch" style="color:#1e9647">██</span>','Gnome\'s Cap<br/>Green Tunic<br/>Skirt <span class="swatch" style="color:#297216">██</span>','Cowboy Hat<br/>Excavator Shirt<br/>Farmer Pants <span class="swatch" style="color:#a86f 1">██</span>','Good Ol\' Cap<br/>Brown Overalls<br/>Farmer Pants <span class="swatch" style="color:#824e 1">██</span>','(No Hat)<br/>Shirt – ID (S)1099<br/>Farmer Pants <span class="swatch" style="color:#353535">██</span>','(No Hat)<br/>Store Owner\'s Jacket<br/>Farmer Pants <span class="swatch" style="color:#25562a">██</span>','Watermelon Band<br/>Shirt – ID (S)1106<br/>Skirt <span class="swatch" style="color:#53d1ab">██</span>','Delicate Bow<br/>Shirt – ID (S)1092<br/>Skirt <span class="swatch" style="color:#f25769">██</span>','(No Hat)<br/>Shirt – ID (S)1088<br/>Shorts <span class="swatch" style="color:#63dd8d">██</span>','(No Hat)<br/>Shirt – ID (S)1103<br/>Skirt <span class="swatch" style="color:#35373a">██</span>','(No Hat)<br/>Sailor Shirt<br/>Shorts <span class="swatch" style="color:#465aa3">██</span>','(No Hat)<br/>Shirt – ID (S)1050<br/>Pleated Skirt <span class="swatch" style="color:#fc9298">██</span>','(No Hat)<br/>Crop Tank Top (M) <span class="swatch" style="color:#ffebcb">██</span><br/>Farmer Pants <span class="swatch" style="color:#683535">██</span>','(No Hat)<br/>Basic Pullover (M) <span class="swatch" style="color:#ffc6 0">██</span><br/>Relaxed Fit Shorts <span class="swatch" style="color:#5997d1">██</span>','(No Hat)<br/>High-Waisted Shirt <span class="swatch" style="color:#1da362">██</span><br/>Pleated Skirt <span class="swatch" style="color:#1da362">██</span>','(No Hat)<br/>Tube Top <span class="swatch" style="color:#97ff72">██</span><br/>Tight Pants <span class="swatch" style="color:#97ff72">██</span>','Mouse Ears<br/>Shirt – ID (S)1066<br/>Shorts <span class="swatch" style="color:#b7a3a3">██</span>','(No Hat)<br/>Slime Shirt<br/>Simple Dress <span class="swatch" style="color:#39cc2c">██</span>','Propeller Hat<br/>Jester Shirt<br/>Farmer Pants <span class="swatch" style="color:# 2b8e0">██</span>','(No Hat)<br/>Crab Cake Shirt<br/>Farmer Pants <span class="swatch" style="color:#bf2116">██</span>','Sou\'wester<br/>Rain Coat<br/>Relaxed Fit Pants <span class="swatch" style="color:#ffa9 2">██</span>','(No Hat)<br/>Camo Shirt<br/>Relaxed Fit Pants <span class="swatch" style="color:#6b3f17">██</span>','(No Hat)<br/>Sailor Shirt <span class="swatch" style="color:#d13e3e">██</span><br/>Pleated Skirt <span class="swatch" style="color:#d13e3e">██</span>','(No Hat)<br/>White Gi<br/>Simple Dress <span class="swatch" style="color:#fcd7ab">██</span>','(No Hat)<br/>Trash Can Shirt<br/>Shorts <span class="swatch" style="color:#757575">██</span>','(No Hat)<br/>Turtleneck Sweater <span class="swatch" style="color:#38c3ff">██</span><br/>Farmer Pants <span class="swatch" style="color:#632f18">██</span>','Pageboy Cap<br/>Mayoral Suspenders<br/>Farmer Pants <span class="swatch" style="color:#702616">██</span>','(No Hat)<br/>Shirt – ID (S)1086<br/>Dress <span class="swatch" style="color:#964361">██</span>','(No Hat)<br/>Shirt – ID (S)1031<br/>Skirt <span class="swatch" style="color:#a5836a">██</span>','(No Hat)<br/>Green Overalls<br/>Farmer Pants <span class="swatch" style="color:#3043e8">██</span>','(No Hat)<br/>Shirt – ID (S)1074<br/>Relaxed Fit Pants <span class="swatch" style="color:#ba 5 5">██</span>','(No Hat)<br/>Shirt – ID (S)1051<br/>Relaxed Fit Shorts <span class="swatch" style="color:#dd4457">██</span>','(No Hat)<br/>Tunnelers Jersey<br/>Relaxed Fit Shorts <span class="swatch" style="color:#514b41">██</span>','Official Cap<br/>Officer Uniform<br/>Farmer Pants <span class="swatch" style="color:#35345b">██</span>','(No Hat)<br/>Dark Striped Shirt <span class="swatch" style="color:#ffffff">██</span><br/>Baggy Pants <span class="swatch" style="color:#333333">██</span>'],
			},
			possibleVendors = { 'Abigail': true, 'Caroline': true, 'Clint': true, 'Demetrius': true, 'Elliott': true, 'Emily': true, 'Evelyn': true, 'George': true, 'Gus': true, 'Haley': true, 'Harvey': true, 'Jas': true, 'Jodi': true, 'Alex': true, 'Kent': true, 'Leah': true, 'Marnie': true, 'Maru': true, 'Pam': true, 'Penny': true, 'Pierre': true, 'Robin': true, 'Sam': true, 'Sebastian': true, 'Shane': true, 'Vincent': true, 'Leo': true },
			scheduleExclusion = {
				0: { 'Abigail': true, 'Caroline': true, 'Elliott': true, 'Gus': true, 'Alex': true, 'Leah': true, 'Pierre': true, 'Sam': true, 'Sebastian': true, 'Haley': true },
				1: { 'Haley': true, 'Clint': true, 'Demetrius': true, 'Maru': true, 'Pam': true, 'Penny': true, 'Robin': true, 'Leo': true },
				2: { 'Evelyn': true, 'George': true, 'Jas': true, 'Jodi': true, 'Kent': true, 'Marnie': true, 'Shane': true, 'Vincent': true }
			},
			racerNames = ["Speed Rooster", "King Sting", "Shoebiscuit", "Escar-go", "Cactus Crawler"],
			player,
			tclass;
		if (typeof(offset) === 'undefined') {
			offset = save.year - 1;
		}
		if (offset < 1) {
			$('#makeover-prev').prop("disabled", true);
		} else {
			$('#makeover-prev').val(offset - 1);
			$('#makeover-prev').prop("disabled", false);
		}
		$('#makeover-reset').val('reset');
		$('#makeover-next').val(offset + 1);
		year = offset + 1;
		if (year < save.year) {
			tclass = "past";
		} else if (year === save.year) {
			tclass = "current";
		} else {
			tclass = "future";
		}
		output += '<table class="output"><thead><tr><th colspan = "4">Year ' + year + '</th></tr>';
		output += '<tr><th> </th><th>Monday Spring 15</th><th>Tuesday Spring 16</th><th>Wednesday Spring 17</th></tr></thead>\n<tbody>';
		
		// Vendors and racers
		var vendor = { 1: [], 2: [] };
		var racers = { 0: [], 1: [], 2: [] };
		for (var d = 0; d < 3; d++) {
			day = 112 * offset + 15 + d;
			var vendorPool = [];
			for (var c = 0; c < save.characters.length; c++) {
				if (!possibleVendors.hasOwnProperty(save.characters[c])) { continue; }
				if (save.characters[c] === 'Kent' && year < 2) { continue; }
				if (save.characters[c] === 'Leo' && !save.leoMoved) { continue; }
				if (scheduleExclusion[d].hasOwnProperty(save.characters[c])) { continue; }
				vendorPool.push(save.characters[c]);
			}
//console.log("Day " + day);
//console.log(vendorPool.slice());
			rng = new CSRandom(getRandomSeed(day, save.gameID / 2));
			for (var k = 0; k < d; k++) {
				for (var m = 0; m < 2; m++) {
					var index = rng.Next(vendorPool.length);
//console.log("Removing " + index + " - " + vendorPool[index]);
					vendorPool.splice(index, 1);
				}
			}
			for (var i = 1; i <= 2; i++) {
				var index = rng.Next(vendorPool.length);
//console.log("Rolled " + index + " picking " + vendorPool[index]);
				vendor[i].push(vendorPool[index]);
				vendorPool.splice(index, 1);
			}
			var racerPool = [0, 1, 2, 3, 4];
			for (var i = 0; i < 3; i++) {
				var index = rng.Next(racerPool.length);
				racers[d].push(racerNames[racerPool[index]]);
				racerPool.splice(index, 1);
			}
		}
		Object.keys(vendor).sort().forEach( function(key, index) {
			output += '<tr class="' + tclass + '"><td>Shop Vendor ' + key + "</td>";
			for (var d = 0; d < 3; d++) {
				output += "<td>" + wikify(vendor[key][d]) + "</td>";
			}
			output += '</tr>';
		});
		output += '<tr class="' + tclass + '"><td>Racers</td>';
		for (var d = 0; d < 3; d++) {
			output += "<td>" + racers[d].join('<br/>') + "</td>";
		}
		output += '</tr>';
		
		// Cactis and Makeover
		if (typeof(save.mp_ids) !== 'undefined' && save.mp_ids.length > 0) {
			// Failsafe that should not happen in released game
			if (save.gender[0] === '') {
				for (player = 0; player < save.mp_ids.length; player++) {
					save.gender[player] = 'Female';
				}
				$('#makeover-note').html('Warning: Predictor could not determing player gender. All players will be assumed to be female. To get better makeover predictions, use a game saved under current version.');
			}
			
			for (player = 0; player < save.mp_ids.length; player++) {
				var seed = bigIntToSigned32(save.mp_ids[player].add(year));
				rng =  new CSRandom(getRandomSeed(seed));
				output += '<tr class="' + tclass + '"><td>Free "Cactis" for<br/>' + save.names[player] + "</td>";
				var parts = [rng.Next(24), rng.Next(24), rng.Next(16)];
				output += '<td colspan="3"><img src="blank.png" class="cactis" id="c_top_' + parts[0] + '" alt="Cactis Top"><br/>';
				output += '<img src="blank.png" class="cactis" id="c_mid_' + parts[1] + '" alt="Cactis Top"><br/>';
				output += '<img src="blank.png" class="cactis" id="c_bot_' + parts[2] + '" alt="Cactis Top"></td></tr>';
			}
			for (player = 0; player < save.mp_ids.length; player++) {
				var outfit = {};
				for (var d = 0; d < 3; d++) {
					day = 112 * offset + 15 + d;
					rng = new CSRandom(getRandomSeed(day, save.gameID / 2, year));
					if (rng.NextDouble() < 0.75) {
						var umid = bigIntToSigned32(save.mp_ids[player]);
						rng = new CSRandom(getRandomSeed(day, save.gameID / 2, year, umid));
					}
					roll = rng.NextDouble();
					outfit[d] = makeoverChoices[save.gender[player]][Math.floor(roll * makeoverChoices[save.gender[player]].length)];
					if (d === 1) {
						rng = new CSRandom(getRandomSeed(day, save.gameID / 2));
						if (rng.NextDouble() < 0.03) {
							outfit[d] = 'Laurel Wreath Crown<br/>Toga Shirt<br/>Skirt <span class="swatch" style="color:#f7f5cd">██</span>';
						}
					}
				}
				output += '<tr class="' + tclass + '"><td>Makeover Outfit for<br/>' + save.names[player] + "<br/>(" + save.gender[player] + ")</td>";
				for (var d = 0; d < 3; d++) {
					output += "<td>" + outfit[d] + "</td>";
				}
				output += '</tr>';
			}
		} else {
			$('#makeover-note').html('Note: No players found; vendor predictions will probably not be reliable, cactis predictions cannot be made, and makeover predictions can only show generic results');
			output += '<tr class="' + tclass + '"><td>Free "Cactis"</td><td colspan="3">Cannot predict; no players found</td></tr>';
			var outfit = [ [], [] ];
			for (var d = 0; d < 3; d++) {
				day = 112 * offset + 15 + d;
				rng = new CSRandom(getRandomSeed(day, save.gameID / 2, year));
				// pretend this 75% roll fails
				rng.NextDouble();
				roll = rng.NextDouble();
				outfit[0][d] = makeoverChoices.Female[Math.floor(roll * makeoverChoices.Female.length)];
				outfit[1][d] = makeoverChoices.Male[Math.floor(roll * makeoverChoices.Male.length)];
				if (d === 1) {
					rng = new CSRandom(getRandomSeed(day, save.gameID / 2));
					if (rng.NextDouble() < 0.03) {
						outfit[0][d] = 'Laurel Wreath Crown<br/>Toga Shirt<br/>Skirt <span class="swatch" style="color:#f7f5cd">██</span>';
						outfit[1][d] = 'Laurel Wreath Crown<br/>Toga Shirt<br/>Skirt <span class="swatch" style="color:#f7f5cd">██</span>';
					}
				}
			}
			output += '<tr class="' + tclass + '"><td>Makeover Outfit for<br/>Generic Female Player</td>';
			for (var d = 0; d < 3; d++) { output += "<td>" + outfit[0][d] + "</td>";	}
			output += '</tr>';
			output += '<tr class="' + tclass + '"><td>Makeover Outfit for<br/>Generic Male Player</td>';
			for (var d = 0; d < 3; d++) { output += "<td>" + outfit[1][d] + "</td>";	}
			output += '</tr>';			
		}
		output += "</tbody></table>\n";
		return output;
	}

	function predictGreenRain(isSearch, offset) {
		// Green Rain Day determined by StardewValley.Utility.getDayOfGreenRainThisSummer()
		// Some weather effects determined by Data/LocationContexts
		// Overrides in StardewValley.GameData.getWeatherModificationsForDate()
		var output = "",
			grDays = [ 5, 6, 7, 14, 15, 16, 18, 23 ],
			festivalDays = {
				13: "Egg Festival",
				24: "Flower Dance",
				39: "Luau",
				48: "Trout Derby",
				49: "Trout Derby",
				56: "Moonlight Jellies",
				72: "Stardew Valley Fair",
				83: "Sprit's Eve",
				92: "Festival of Ice",
				96: "Squid Fest",
				97: "Squid Fest",
				99: "Night Market",
				100: "Night Market",
				101: "Night Market",
				109: "Winter Star"
			},
			year,
			rng,
			tclass;

		if (typeof(offset) === 'undefined') {
			offset = 28 * Math.floor(save.daysPlayed/28);
		}
		if (offset < 112) {
			$('#greenrain-prev-year').prop("disabled", true);
		} else {
			$('#greenrain-prev-year').val(offset - 112);
			$('#greenrain-prev-year').prop("disabled", false);
		}
		if (offset < 28) {
			$('#greenrain-prev-month').prop("disabled", true);
		} else {
			$('#greenrain-prev-month').val(offset - 28);
			$('#greenrain-prev-month').prop("disabled", false);
		}
		$('#greenrain-reset').val('reset');
		$('#greenrain-next-month').val(offset + 28);
		$('#greenrain-next-year').val(offset + 112);
		var month = Math.floor(offset / 28);
		var season = month % 4;
		var monthName = save.seasonNames[season];
		var year = 1 + Math.floor(offset / 112);
		var rng = new CSRandom(getRandomSeed(year * 777, save.gameID));
		var greenRainDay = grDays[rng.Next(grDays.length)];
		output += '<table class="calendar"><thead><tr><th colspan="7">' + monthName + ' Year ' + year + '</th></tr>\n';
		output += '<tr><th>M</th><th>T</th><th>W</th><th>Th</th><th>F</th><th>Sa</th><th>Su</th></tr></thead>\n<tbody>';
		for (var week = 0; week < 4; week++) {
			output += "<tr>";
			for (var weekDay = 1; weekDay < 8; weekDay++) {
				var day = 7 * week + weekDay + offset;
				var weatherTown = 'Sun';
				if (day == 1 || day == 2 || day == 4 || (day % 28) == 1) {
					weatherTown = 'Sun';
				} else if (day == 3) {
					weatherTown = 'Rain';
				} else if (festivalDays.hasOwnProperty(day % 112)) {
					weatherTown = festivalDays[day % 112];
				} else {
					switch(season) {
						case 0:
						case 2:
							rng = new CSRandom(getRandomSeed(getHashFromString("location_weather"), save.gameID, day-1));
							if (rng.NextDouble() < 0.183) {
								weatherTown = 'Rain';
							}
							break;
						case 1:
							// The -28 is because we are only using this for summer 
							var dayOfMonth = (day % 112) - 28;
							rng = new CSRandom(getRandomSeed(day-1, save.gameID/2, getHashFromString("summer_rain_chance")));
							if (dayOfMonth == greenRainDay) {
								weatherTown = 'Green Rain';
							} else if (dayOfMonth % 13 == 0) {
								weatherTown = 'Storm';
							} else {
								var rainChance = 0.12 + 0.003*(dayOfMonth-1);
								if (rng.NextDouble() < rainChance) {
									weatherTown = 'Rain';
								}
							}
							break;
					}
				}
				if (day < save.daysPlayed) {
					tclass = "past";
				} else if (day === save.daysPlayed) {
					tclass = "current";
				} else {
					tclass = "future";
				}
				var icon = (weatherTown == 'Rain' || weatherTown == 'Green Rain' || weatherTown == 'Storm') ?
					'<img src="blank.png" class="icon" alt="Clear" id="w_rain">' :
					'<img src="blank.png" class="icon" alt="Umbrella in rain" id="w_sun">';
				output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br/>' + 
					'<span class="cell">' + icon + weatherTown + '</span></td>';
			}
			output += "</tr>\n";
		}
		output += '<tr><td colspan="7" class="legend"><img src="blank.png" class="icon" alt="Umbrella in rain" id="w_rain"> Rainy weather. "Rain" could become Storm.<br/><img src="blank.png" class="icon" alt="Shining Sun" id="w_sun"> Clear weather. "Sun" could become Wind or Snow.</td></tr>';
		output += "</tbody></table>\n";

		return output;
	}

	function predictCalicoJack(isSearch, offset, gameOffset = 0) {
		// logic from StardewValley.Minigames.CalicoJack.tick() and StardewValley.Minigames.CalicoJack.receiveLeftClick()
		// rng is seeded in StardewValley.Minigames.CalicoJack.CalicoJack()
		var output = '',
			numPlayed,
			advice,
			g,
			c,
			month,
			monthName,
			year,
			dayOfMonth,
			dayOfWeek,
			roll,
			next,
			tclass,
			count,
			pageSize = 20,
			rng;

		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			// No search
		} else {
			if (typeof(offset) === 'undefined') {
				offset = save.daysPlayed + save.dayAdjust;
			}
			// Day buttons
			$('#cj-d-next-week').val(offset + 7);
			$('#cj-d-prev-week').val(offset - 7);
			$('#cj-d-next-day').val(offset + 1);
			$('#cj-d-prev-day').val(offset - 1);
			if (offset < 7) {
				$('#cj-d-prev-week').prop("disabled", true);
			} else {
				$('#cj-d-prev-week').prop("disabled", false);
			}
			if (offset < 2) {
				$('#cj-d-prev-day').prop("disabled", true);
			} else {
				$('#cj-d-prev-day').prop("disabled", false);
			}
			$('#cj-d-reset').val('reset');
			//$('#cj-d-reset').html("Reset Browsing");
			$('#cj-d-next-week').prop("disabled", false);
			$('#cj-d-next-day').prop("disabled", false);
			
			// Game buttons which are a bit of a hack
			if (gameOffset < pageSize) {
				$('#cj-g-prev').prop("disabled", true);
			} else {
				$('#cj-g-prev').val(gameOffset - pageSize);
				$('#cj-g-prev').prop("disabled", false);
			}
			if (gameOffset < 100) {
				$('#cj-g-prev-100').prop("disabled", true);
			} else {
				$('#cj-g-prev-100').val(gameOffset - 100);
				$('#cj-g-prev-100').prop("disabled", false);
			}
			$('#cj-g-reset').val('reset');
			//$('#cj-g-reset').html("Reset Browsing");
			$('#cj-g-next').val(gameOffset + pageSize);
			$('#cj-g-next').prop("disabled", false);
			$('#cj-g-next-100').val(gameOffset + 100);
			$('#cj-g-next-100').prop("disabled", false);

			dayOfMonth = offset % 28;
			dayOfWeek = (offset - 1) % 7
			if (dayOfMonth !== 0) {
				month = Math.floor(offset / 28);
				year = 1 + Math.floor(offset / 112);
			} else {
				dayOfMonth = 28;
				month = Math.floor(offset / 28) - 1;
				monthName = save.seasonNames[month % 4];
				year = 1 + Math.floor((offset-1) / 112);
			}
			monthName = save.seasonNames[month % 4];
			
			output += '<table class="output"><thead><tr><th class="index" rowspan="2">Game<br/>Count</th>' +
				'<th class="cj-result" colspan="2">' +  save.dayNames[dayOfWeek] + ' ' +
					monthName + ' ' + dayOfMonth + ', Year ' + year + '</th></tr>';
			output += '<tr><th>Starting Hand</th><th>Best Strategy</th></tr></thead><tbody>';
			for (g = 1; g <= pageSize; g++) {
				numPlayed = gameOffset + g;
				advice = "LOSS (Unavoidable)";
				
				if (compareSemVer(save.version, "1.6") >= 0) {
					rng = new CSRandom(getRandomSeed(numPlayed, offset, save.gameID));
				} else {
					rng = new CSRandom(numPlayed + offset + save.gameID);
				}
				var dealerStart = rng.Next(1,12) + rng.Next(1,10);
				var c1 = rng.Next(1,12);
				var c2 = rng.Next(1,10);
				var startHand = "" + c1 + " and " + c2;
				var playerTotal = c1 + c2;
				// We are potentially going to play the game multiple times making different decisions
				// and so we will pre-roll the RNG 60 times which should be more than enough for even
				// the craziest string of drawing 1s and failing auto-win checks.
				roll = [];
				for (var i = 0; i < 60; i++) {
					roll[i] = rng.NextDouble();
				}
				// First we just draw cards until we hit 21 or bust. Before each draw we preserve
				// the current status (total, rng index, and number of hits taken) to simulate the
				// player standing at that step instead of hitting.
				var r = 0;
				var hit = 0;
				var choice = [ ];
				while (playerTotal < 21) {
					choice.push({ "t": playerTotal, "r": r, "h": hit++ });
					next = Math.floor(9 * roll[r++] + 1);
					var distance = 21 - playerTotal;
					if (distance > 1 && distance < 6 && roll[r++] < (1/distance)) {
						next = (roll[r++] < .5) ? distance : distance - 1;
					}
					playerTotal += next;
				}
				if (playerTotal === 21) {
					advice = "WIN: Hit " + hit + " time" + (hit == 1 ? '' : 's') + " to reach 21";
				} else {
					// last hit was a bust so we play out the staying options instead
					var havePush = false;
					for (var i = 0; i < choice.length; i++) {
						playerTotal = choice[i].t;
						r = choice[i].r;
						var dealerTotal = dealerStart;
						var superBust = '';
						// playerTotal is guaranteed to be <= 21 here so the conditional is
						// simplified from what the game does
						while (dealerTotal < 18 || dealerTotal < playerTotal) {
							next =  Math.floor(9 * roll[r++] + 1);
							var distance = 21 - dealerTotal;
							var autoBust = false;
							switch(playerTotal) {
								case 20: autoBust = roll[r++] < .5; break;
								case 19: autoBust = roll[r++] < .25; break;
								case 18: autoBust = roll[r++] < .1; break;
								default: // always keep original draw
							}
							// We need to calculate the autoBust now even though it might get superseded later
							if (autoBust) {
								next = Math.floor(distance + 3 * roll[r++] + 1);
							}
							// The superBust (my term) is luck-based
							var minRoll = 0.0005;
							var chance = Math.max(0.0005, 0.001 + save.dailyLuck/20 + save.luckLevel*.002);
							var sbRoll = roll[r++];
							if (sbRoll < minRoll) {
								next = 999;
								superBust = "<br/>Guaranteed super bust with 3x winnings";
							} else if (sbRoll < chance) {
								next = 999;
								superBust = "<br/>Probable super bust with 3x winnings";
							} 
							dealerTotal += next;
						}
						if (dealerTotal > 21) {
							if (choice[i].h === 0) {
								advice = "WIN: Stand at initial " + playerTotal;
							} else {
								advice = "WIN: Hit " + choice[i].h + " time" + (choice[i].h == 1 ? '' : 's') + " and stand at " + playerTotal;
							}
							break;
						} else if (dealerTotal == playerTotal && !havePush) {
							// This could be a push. Set advice for it, but don't break in case we find a better result later
							havePush = true;
							advice = "TIE: Hit " + choice[i].h + " time" + (choice[i].h == 1 ? '' : 's') + " and stand at " + playerTotal;
						}
						advice += superBust;
					}
				}

				if (offset === save.daysPlayed + save.dayAdjust) {
					tclass = "current";
				} else if (offset <= save.daysPlayed + save.dayAdjust) {
					tclass = "past";
				} else {
					tclass = "future";
				}
				output += '<tr class="' + tclass + '"><td>' + addCommas(numPlayed) + '</td>';
				output += '<td>' + startHand + '</td>';
				output += '<td class="long_list">' + advice + '</td></tr>';
			}
		}
		output += '</tbody></table>';
		return output;
	}

	function predictBookseller(isSearch, offset) {
		// days chosen by StardewValley.Utility.getDaysOfBooksellerThisSeason() vendor info from Data/Shops
		var output = '',
			skillBookList = ["Stardew Valley Almanac", "Bait And Bobber", "Woodcutter's Weekly", "Mining Monthly", "Combat Quarterly"],
			randBookList = ["The Alleyway Buffet", "The Art O' Crabbing", "Dwarvish Safety Manual", "Jewels Of The Sea", "Raccoon Journal", "Woody's Secret", "Jack Be Nimble, Jack Be Thick", "Friendship 101", "Monster Compendium", "Mapping Cave Systems", "Ancient Treasures: Appraisal Guide"];

		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			$('#book-prev-year').prop("disabled", true);
			$('#book-prev-month').prop("disabled", true);
			$('#book-next-month').prop("disabled", true);
			$('#book-prev-year').prop("disabled", true);
			$('#book-reset').html("Clear Search Results &amp; Reset Browsing");
			var searchTerm = new RegExp(offset, "i");
			var searchStart = ($('#book-search-all').prop('checked')) ? 0 : 7 * Math.floor((save.daysPlayed - 1) / 7);
			var searchEnd = 112 * $('#book-search-range').val();
			output += '<table class="output"><thead><tr><th colspan="3">Search results for &quot;' + offset + '&quot; over the ' +
				(($('#book-search-all').prop('checked')) ? 'first ' : 'next ') + $('#book-search-range').val() + ' year(s)</th></tr>\n';
			output += '<tr><th class="day">Day</th><th class="item">Item</th><th class="price">Price</th></tr>\n<tbody>';
			var count = 0;
			for (offset = searchStart; offset < searchStart + searchEnd; offset += 28) {
				var month = Math.floor(offset / 28);
				var seasonIndex = month % 4;
				var monthName = save.seasonNames[seasonIndex];
				var year = 1 + Math.floor(offset / 112);
				var rng = new CSRandom(getRandomSeed(year * 11, save.gameID, seasonIndex));
				var possibleDays = [];
				switch (seasonIndex) {
					case 0: possibleDays = [11, 12, 21, 22, 25]; break;
					case 1: possibleDays = [9, 12, 18, 25, 27]; break;
					case 2: possibleDays = [4, 7, 8, 9, 12, 19, 22, 25]; break;
					case 3: possibleDays = [5, 11, 12, 19, 22, 24]; break;
				}
				var i = rng.Next(possibleDays.length);
				var days = [ possibleDays[i], possibleDays[Math.floor((i + possibleDays.length/2) % possibleDays.length)] ];
				days.sort(function(a,b) { return a - b;});
				for (var d = 0; d < days.length; d++) {
					var dayOfWeek = save.dayNames[(6 + days[d]) % 7]
					var daysPlayed = offset + days[d] + save.dayAdjust;
					var dateString = dayOfWeek + ' ' + monthName + ' ' + days[d] + ', Year ' + year;
					rng = new CSRandom(getRandomSeed(daysPlayed, save.gameID/2));
					var picked;
					var rngSynced = new CSRandom(getRandomSeed(getHashFromString("purplebookSale"), save.gameID, daysPlayed));
					if (searchTerm.test("Book of the Stars") && rngSynced.NextDouble() < 0.25) {
						count++;
						output += '<tr><td>' + dateString + '</td><td class="book">' + wikify("Book of the Stars") + '</td><td>15,000g</td></tr>';
					}
					var booksLeft = skillBookList.slice();
					rngSynced = new CSRandom(getRandomSeed(getHashFromString("thirdBookSale"), save.gameID, daysPlayed));
					if (rngSynced.NextDouble() < 0.6) {
						picked = booksLeft.splice(rng.Next(booksLeft.length), 1);
						if (searchTerm.test(picked[0])) {
							count++;
							output += '<tr><td>' + dateString + '</td><td class="book">' + wikify(picked[0]) + '</td><td>10,000g</td></tr>';
						}
					}
					rngSynced = new CSRandom(getRandomSeed(getHashFromString("secondBookSale"), save.gameID, daysPlayed));
					if (rngSynced.NextDouble() < 0.8) {
						picked = booksLeft.splice(rng.Next(booksLeft.length), 1);
						if (searchTerm.test(picked[0])) {
							count++;
							output += '<tr><td>' + dateString + '</td><td class="book">' + wikify(picked[0]) + '</td><td>8,000g</td></tr>';
						}
					}
					picked = booksLeft.splice(rng.Next(booksLeft.length), 1);
					if (searchTerm.test(picked[0])) {
						count++;
						output += '<tr><td>' + dateString + '</td><td class="book">' + wikify(picked[0]) + '</td><td>5,000g</td></tr>';
					}
					if (year >= 3) {
						picked = randBookList[rng.Next(randBookList.length)];
						if (searchTerm.test(picked)) {
							count++;
							output += '<tr><td>' + dateString + '</td><td class="book">' + wikify(picked) + '</td><td>20,000g</td></tr>';
						}
					}
					var rngSynced = new CSRandom(getRandomSeed(getHashFromString("bookExtraForaging"), save.gameID, daysPlayed));
					if (searchTerm.test("Woodcutter's Weekly") && rngSynced.NextDouble() < 0.33) {
						count++;
						output += '<tr><td>' + dateString + '</td><td class="book">' + wikify("Woodcutter's Weekly") + '</td><td>8,000g</td></tr>';
					}
				}
			}
			output += '<tr><td colspan="3" class="count">Found ' + count + ' matching item(s)</td></tr></tbody></table>\n';
		} else {
			if (typeof(offset) === 'undefined') {
				offset = 28 * Math.floor(save.daysPlayed/28);
			}
			if (offset < 112) {
				$('#book-prev-year').prop("disabled", true);
			} else {
				$('#book-prev-year').val(offset - 112);
				$('#book-prev-year').prop("disabled", false);
			}
			if (offset < 28) {
				$('#book-prev-month').prop("disabled", true);
			} else {
				$('#book-prev-month').val(offset - 28);
				$('#book-prev-month').prop("disabled", false);
			}
			$('#book-reset').val('reset');
			$('#book-reset').html("Reset Browsing");
			$('#book-next-month').val(offset + 28);
			$('#book-next-year').val(offset + 112);
			$('#book-search-text').val('');
			$('#book-search-range').val(2);
			$('#book-search-all').prop('checked', false);
			var month = Math.floor(offset / 28);
			var seasonIndex = month % 4;
			var monthName = save.seasonNames[seasonIndex];
			var year = 1 + Math.floor(offset / 112);
			var rng = new CSRandom(getRandomSeed(year * 11, save.gameID, seasonIndex));
			var possibleDays = [];
			switch (seasonIndex) {
				case 0: possibleDays = [11, 12, 21, 22, 25]; break;
				case 1: possibleDays = [9, 12, 18, 26, 27]; break;
				case 2: possibleDays = [4, 7, 8, 9, 12, 19, 22, 25]; break;
				case 3: possibleDays = [5, 11, 12, 19, 22, 24]; break;
			}
			var i = rng.Next(possibleDays.length);
			var days = [ possibleDays[i], possibleDays[Math.floor((i + possibleDays.length/2) % possibleDays.length)] ];
			days.sort(function(a,b) { return a - b;});
			output += '<table class="output"><thead><tr><th rowspan="2">Bookseller<br/>Items</th>';
			for (var d = 0; d < days.length; d++) {
				output += '<th colspan="2" class="multi">' + save.dayNames[(6 + days[d]) % 7] + ' ' +
					monthName + ' ' + days[d] + ', Year ' + year +	'</th>';
			}
			output += '</tr><tr>';
			for (var d = 0; d < days.length; d++) {
				output += '<th class="item">Item</th><th class="price">Price</th>';
			}
			output += '</tr></thead><tbody>';
			// Want to color these based on current month
			var tclass = "current";
			var monthsPlayed = Math.floor(save.daysPlayed / 28);
			if (month < monthsPlayed) {
				tclass = "past";
			} else if (month > monthsPlayed) {
				tclass = "future";
			}
			// the stock object basically lets us roll all the items in one loop and then output later
			// We know that the bookseller tries to avoid repeats so if the same skill book is rolled for both
			// the 8k and 6k slots a different 6k book will be chosen instead. However, the mechanics of that
			// are not known. The "keep rolling until it is not a dupe" method doesn't seem to work and neither
			// does the "remove dupe and reroll on smaller list" method.
			var stock = {};
			for (var d = 0; d < days.length; d++) {
				var daysPlayed = offset + days[d] + save.dayAdjust;
				var picked;
				stock[d] = { };
				rng = new CSRandom(getRandomSeed(daysPlayed, save.gameID/2));
				
				var rngSynced = new CSRandom(getRandomSeed(getHashFromString("purplebookSale"), save.gameID, daysPlayed));
				if (rngSynced.NextDouble() < 0.25) {
					stock[d].purplebook = '<td class="book">' + wikify("Book of the Stars") + '</td><td>15,000g</td>';
				} else {
					stock[d].purplebook = '<td>--</td><td>--</td>';
				}
				var booksLeft = skillBookList.slice();
				rngSynced = new CSRandom(getRandomSeed(getHashFromString("thirdBookSale"), save.gameID, daysPlayed));
				if (rngSynced.NextDouble() < 0.6) {
					picked = booksLeft.splice(rng.Next(booksLeft.length), 1);
					stock[d].skill60pct = '<td class="book">' + wikify(picked[0]) + '</td><td>10,000g</td>';
				} else {
					stock[d].skill60pct = '<td>--</td><td>--</td>';
				}
				rngSynced = new CSRandom(getRandomSeed(getHashFromString("secondBookSale"), save.gameID, daysPlayed));
				if (rngSynced.NextDouble() < 0.8) {
					picked = booksLeft.splice(rng.Next(booksLeft.length), 1);
					stock[d].skill80pct = '<td class="book">' + wikify(picked[0]) + '</td><td>8,000g</td>';
				} else {
					stock[d].skill80pct = '<td>--</td><td>--</td>';
				}
				picked = booksLeft.splice(rng.Next(booksLeft.length), 1);
				stock[d].skillAlways = '<td class="book">' + wikify(picked[0]) + '</td><td>5,000g</td>';
				if (year >= 3) {
					picked = randBookList[rng.Next(randBookList.length)];
					stock[d].y3 = '<td class="book">' + wikify(picked) + '</td><td>20,000g</td>';
				} else {
					stock[d].y3 = '<td>--</td><td>--</td>';
				}
				//TODO: Check to see if this gets suppressed if Woodcutter's Weekly already rolled
				rngSynced = new CSRandom(getRandomSeed(getHashFromString("bookExtraForaging"), save.gameID, daysPlayed));
				if (rngSynced.NextDouble() < 0.33) {
					stock[d].foragebook = '<td class="book">' + wikify("Woodcutter's Weekly") + '</td><td>8,000g</td>';
				} else {
					stock[d].foragebook = '<td>--</td><td>--</td>';
				}
			}

			output += '<tr class="' + tclass + '"><td>Purple Book</td>';
			for (var d = 0; d < days.length; d++) { output += stock[d].purplebook; }
			output += '</tr>';
			output += '<tr class="' + tclass + '"><td>Skill Book 1</td>';
			for (var d = 0; d < days.length; d++) { output += stock[d].skill60pct; }
			output += '</tr>';
			output += '<tr class="' + tclass + '"><td>Skill Book 2</td>';
			for (var d = 0; d < days.length; d++) { output += stock[d].skill80pct; }
			output += '</tr>';
			output += '<tr class="' + tclass + '"><td>Skill Book 3</td>';
			for (var d = 0; d < days.length; d++) { output += stock[d].skillAlways; }
			output += '</tr>';
			output += '<tr class="' + tclass + '"><td>Random Y3 Book</td>';
			for (var d = 0; d < days.length; d++) { output += stock[d].y3; }
			output += '</tr>';
			output += '<tr class="' + tclass + '"><td>Extra Book</td>';
			for (var d = 0; d < days.length; d++) { output += stock[d].foragebook; }
			output += '</tr>';
			output += "</tbody></table>";

			/*
			var cart = {};
			for (var d = 0; d < days.length; d++) {
				cart[d] = {};
				cart[d].rng = new CSRandom(getRandomSeed(offset + days[d] + save.dayAdjust, save.gameID/2));
				cart[d].selectedItems = {};
				var pick = getRandomItems(cart[d].rng, "objects", 2, 789, true, true, true, 10);
				for (var slot = 1; slot <= 10; slot++) {
					cart[d].selectedItems[slot] = {};
					cart[d].selectedItems[slot].name = save.objects[pick[slot-1]].name;
					cart[d].selectedItems[slot].price = Math.max(cart[d].rng.Next(1,11) * 100, cart[d].rng.Next(3,6) * save.objects[pick[slot-1]].price);
					cart[d].selectedItems[slot].qty = (cart[d].rng.NextDouble() < 0.1) ? 5 : 1;
				}										
			}

			output += '<table class="calendar"><thead><tr><th colspan="7">' + monthName + ' Year ' + year + '</th></tr>\n';
			output += '<tr><th>M</th><th>T</th><th>W</th><th>Th</th><th>F</th><th>Sa</th><th>Su</th></tr></thead>\n<tbody>';
			// These need to be based on month not year and output needs to set this class on the tr
			*/
		}
		return output;
	};

	function predictStatues(isSearch, offset) {
		// StardewValley.Menus.ChooseFromIconsMenu.ChooseFromIconsMenu() for Dwarf Statue
		// StardewValley.Object.CheckForActionOnBlessedStatue() for Statue of Blessings buff
		// StardewValley.GameLocation.tryAddPrismaticButterfly() for the butterfly spawn point
		var output = "",
			blessingNames = [ "Speed", "Luck", "Energy", "Waters", "Friendship", "Fangs", "Butterfly" ],
			dwarfNames = [ "+1 Ore", "Ladders", "Coal", "Bomb Immunity", "Geodes" ],
			pbMaps = [ "Forest", "Town", "Beach", "Mountain", "Secret Woods", "Bus Stop", "Backwoods" ],
			mapDim = [ [120, 120], [130, 110], [104, 50], [135, 41], [60, 32], [65, 30], [50, 40] ];
		if (typeof(offset) === 'undefined') {
			offset = 28 * Math.floor(save.daysPlayed/28);
		}
		if (offset < 112) {
			$('#statue-prev-year').prop("disabled", true);
		} else {
			$('#statue-prev-year').val(offset - 112);
			$('#statue-prev-year').prop("disabled", false);
		}
		if (offset < 28) {
			$('#statue-prev-month').prop("disabled", true);
		} else {
			$('#statue-prev-month').val(offset - 28);
			$('#statue-prev-month').prop("disabled", false);
		}
		$('#statue-reset').val('reset');
		$('#statue-next-month').val(offset + 28);
		$('#statue-next-year').val(offset + 112);
		var month = Math.floor(offset / 28);
		var monthName = save.seasonNames[month % 4];
		var year = 1 + Math.floor(offset / 112);
		output += '<table class="calendar"><thead><tr><th colspan="7">' + monthName + ' Year ' + year + '</th></tr>\n';
		output += '<tr><th>M</th><th>T</th><th>W</th><th>Th</th><th>F</th><th>Sa</th><th>Su</th></tr></thead>\n<tbody>';
		for (var week = 0; week < 4; week++) {
			output += "<tr>";
			for (var weekDay = 1; weekDay < 8; weekDay++) {
				var day = 7 * week + weekDay + offset;
				var rng = new CSRandom(getRandomSeed(day, save.gameID/2, day * 777));
				for (var j = 0; j < 8; j++) {
					rng.Next();
				}
				var roll = rng.NextDouble();
				var blessRain = Math.floor(roll * 6);
				var blessNoRain = Math.floor(roll * 7);
				var pbExtra = '';
				if (blessNoRain === 6) {
					pbExtra = ' <span data-tooltip="Butterfly Spawns:\n';
					if (save.hasOwnProperty("mp_ids")) {
						for (var player = 0; player < save.mp_ids.length; player++) {
							rng = new CSRandom(getRandomSeedFromBigInts(bigInt(day), bigInt(save.gameID).divide(2), save.mp_ids[player].mod(10000)));
							var index = rng.Next(pbMaps.length);
							// The coordinate generation now runs up to 33 times trying to find an open tile.
							pbExtra += '&bull; ' + save.names[player] + " - " + pbMaps[index] + '\n';
							console.log("Butterfly coordinate possibilities for " + save.names[player] + " - " + pbMaps[index] + " on " + monthName + " " + (day - offset) + ", Y" + year);
							var coords = [];
							for (var i = 0; i <= 32; i++) {
								coords.push( { 'x': rng.Next(mapDim[index][0]), 'y': rng.Next(mapDim[index][1]) } );
							}
							console.log(coords);
						}
					} else {
						pbExtra += "(No players found)";
					}
					pbExtra += '">...</span>';
				}
				rng = new CSRandom(getRandomSeed(day * 77, save.gameID));
				var dwarf1 = rng.Next(5);
				var dwarf2 = dwarf1;
				while (dwarf2 == dwarf1) {
					dwarf2 = rng.Next(5);
				}
				var tclass = "future";
				if (day < save.daysPlayed) {
					tclass = "past";
				} else if (day === save.daysPlayed) {
					tclass = "current";
				}
				var rainText = blessingNames[blessRain];
				var noRainText = blessingNames[blessNoRain] + pbExtra;
				var dwarf1Text = dwarfNames[dwarf1];
				var dwarf2Text = dwarfNames[dwarf2];
				output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br/>' +
					'<span class="cell"><img src="blank.png" class="icon" alt="Umbrella in rain" id="bless_r"> ' + rainText +
					'<br/><img src="blank.png" class="icon" alt="Shining Sun" id="bless_nr"> ' + noRainText +
					'<hr /><img src="blank.png" class="icon" alt="Dwarf 1" id="bless_d1"> ' + dwarf1Text +
					'<br/><img src="blank.png" class="icon" alt="Dwarf 2" id="bless_d2"> ' + dwarf2Text + '</span></td>';
			}
			output += "</tr>\n";
		}
		output += '<tr><td colspan="7" class="legend">Statue of Blessings: <img src="blank.png" class="icon" alt="Umbrella in rain" id="bless_r"> Blessing When Raining | <img src="blank.png" class="icon" alt="Shining Sun" id="bless_nr"> Blessing When Not Raining<br/>Statue of the Dwarf King: <img src="blank.png" class="icon" alt="Dwarf 1" id="bless_d1"> Choice 1 | <img src="blank.png" class="icon" alt="Dwarf 2" id="bless_d2"> Choice 2</td></tr>';
		output += "</tbody></table>\n";
		return output;
	}

	function predictPrizeTicket(isSearch, offset) {
		// logic from StardewValley.Menus.PrizeTicketMenu.getPrizeItem()
		var output = '',
			pageSize = 20;

		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			$('#prize-prev-100').prop("disabled", true);
			$('#prize-prev').prop("disabled", true);
			$('#prize-next').prop("disabled", true);
			$('#prize-next-100').prop("disabled", true);
			$('#prize-reset').html("Clear Search Results &amp; Reset Browsing");
			var searchTerm = new RegExp(offset, "i");
			var searchStart = Math.max(1, ($('#prize-search-all').prop('checked')) ? 1 : save.mysteryBoxesOpened[0]);
			var searchEnd = parseInt($('#prize-search-range').val()) + searchStart;
			output += '<table class="output"><thead><tr><th colspan="' + (numColumns + 2) +
				'">Search results for &quot;' + offset + '&quot; over the ' +
				(($('#prize-search-all').prop('checked')) ? 'first ' : 'next ') + $('#prize-search-range').val() + ' prize claims</th></tr>\n';
			output += '<tr><th class="item">Item</th><th class="mystery-result">Prize Received</th></tr><tbody>';
			var count = 0;
			var searchResults = {};
			// no searching yet.
			/*
			for (var numOpened = searchStart; numOpened < searchEnd; numOpened++) {

			}
			Object.keys(searchResults).sort().forEach( function(key, index) {
				output += '<tr><td class="item">' + wikify(key) + '</td>';
				if (searchResults[key].length > 0) {
					// Limit to first 5 results actually shown in table with ellipsis & tooltip for others
					output += '<td>' + searchResults[key].slice(0,5);
					if (searchResults[key].length > 5) {
						output += '<span data-tooltip="All results: ' + searchResults[key] + '">,...</span>';
					}
					output += '</td>';
				} else {
					output += '<td>None</td>';
				}
				output += '</tr>';
			});
			
			output += '<tr><td colspan="2" class="count">Found ' + count + ' matching instance(s) of ' +
				Object.keys(searchResults).length + ' matching item(s)</td></tr>\n';
				*/
			output += '</table>';
		} else {
			// We need to know what player to use for setting up the initial offset this early.
			var whichPlayer = 0;
			// Player selection menu will only show if there are multiple players.
			if (typeof(save.mp_ids) !== 'undefined' && save.mp_ids.length > 1) {
				$('#prize-player').show();
				if ($('#prize-player-select option').length == 0) {
					// populate menu and default to main farmer.
					for (var player = 0; player < save.mp_ids.length; player++) {
						var prefix = (player == 0) ? 'Main Farmer ' : 'Farmhand ';
						var o = new Option( prefix + save.names[player], player);
						if (player == 0) { o.selected = true; }
						$('#prize-player-select').append(o);
					}
				} else {
					whichPlayer = $('#prize-player-select').val();
				}
			} else {
				$('#prize-player').hide();
			}	
			if (typeof(offset) === 'undefined') {
				offset = pageSize * Math.floor(save.ticketPrizesClaimed[whichPlayer] / pageSize);
			}
			if (offset < pageSize) {
				$('#prize-prev').prop("disabled", true);
			} else {
				$('#prize-prev').val(offset - pageSize);
				$('#prize-prev').prop("disabled", false);
			}
			if (offset < 100) {
				$('#prize-prev-100').prop("disabled", true);
			} else {
				$('#prize-prev-100').val(offset - 100);
				$('#prize-prev-100').prop("disabled", false);
			}
			$('#prize-reset').val('reset');
			$('#prize-reset').html("Reset Browsing");
			$('#prize-next').val(offset + pageSize);
			$('#prize-next').prop("disabled", false);
			$('#prize-next-100').val(offset + 100);
			$('#prize-next-100').prop("disabled", false);
			// Reset search fields too
			$('#prize-search-text').val('');
			$('#prize-search-range').val(200);
			$('#prize-search-all').prop('checked', false);
			output += '<table class="output"><thead><tr><th rowspan="2" class="index">Num Open</th>' +
				'<th colspan="2" class="prize-result">Prize Received</th>';
			output += '</tr><tr><th class="item">Item</th><th class="qty">Qty</th></tr><tbody>';
			var rng;
			if (typeof(save.mp_ids) !== 'undefined') {
				rng = new CSRandom(getRandomSeedFromBigInts(bigInt(save.gameID), save.mp_ids[whichPlayer]));
			} else {
				rng = new CSRandom(getRandomSeed(save.gameID, 0));
				$('#prize-note').html('Note: No players found; predictions will not be reliable');
			}
			// This RNG call is reseeded every time so there is only 1 roll.
			var randRoll = rng.NextDouble();
			for (var g = 1; g <= pageSize; g++) {
				var numOpened = offset + g;
				// extra var to more closely match game logic
				var prizeLevel = numOpened - 1;
				var item = '';
				var itemQty = 1;
				var noLink = false;
				switch(prizeLevel) {
					case 0: item = "Raccoon Seeds"; itemQty = 12; noLink = true; break;
					case 1: item = (randRoll < .5) ? "Peach Sapling" : "Orange Sapling"; break;
					case 2:
						if (randRoll < .5) {
							item = "Mixed Seeds"; itemQty = 10;
						} else {
							item = "Mixed Flower Seeds"; itemQty = 15;
						}
						break;
					case 3: item = "Mystery Box"; itemQty = 3; break;
					case 15: // also stardrop tea so moved up here
					case 4: item = "Stardrop Tea"; break;
					case 5: item = wikify("Blue Pinstripe Bed", "Furniture"); noLink = true; break;
					case 6: 
						switch(Math.floor(3*randRoll)) {
							case 0: item = "Quality Sprinkler"; break;
							case 1: item = "Preserves Jar"; break;
							case 2: item = "Mushroom Log"; break;
						}
						itemQty = 4;
						break;
					case 7: item = (randRoll < .5) ? "Apple Sapling" : "Pomegranate Sapling"; break;
					case 8: item = '<span class="book">' + wikify('Friendship 101') + '</span>'; noLink = true; break;
					case 9: 
						switch(Math.floor(3*randRoll)) {
							case 0: item = "Cherry Bomb"; itemQty = 20; break;
							case 1: item = "Bomb"; itemQty = 12; break;
							case 2: item = "Mega Bomb"; itemQty = 6; break;
						}
						break;
					case 10: item = wikify("Sports Cap", "Hats"); noLink = true; break;
					case 11: item = (randRoll < .5) ? "Fish Smoker" : "Dehydrator"; break;
					case 12: item = (randRoll < .5) ? "Artifact Trove" : "Mystery Box"; itemQty = 4; break;
					case 13:
						var choice = ['House Plant (1)', 'House Plant (2)', 'House Plant (3)'];
						item = wikify(choice[Math.floor(randRoll*choice.length)], "Furniture");
						noLink = true;
						break;								
					case 14:
						var choice = ["Stardew Valley Almanac", "Bait And Bobber", "Woodcutter's Weekly", "Mining Monthly", "Combat Quarterly"];
						item = '<span class="book">' + wikify(choice[Math.floor(randRoll*choice.length)]) + '</span>';
						noLink = true;
						break;								
					case 16: item = wikify("Cow Decal", "Furniture"); noLink = true; break;
					case 17: item = "Omni Geode"; itemQty = 8; break;
					case 18: item = (randRoll < .5) ? "Bee House" : "Keg"; itemQty = 4; break;
					case 19: item = "Diamond"; itemQty = 5; break;
					case 20: item = "Mystery Box"; itemQty = 5; break;
					case 21: item = "Magic Rock Candy"; break;
					default: {
						var rng2 = new CSRandom(getRandomSeed(save.gameID, prizeLevel - prizeLevel % 9));
						switch (prizeLevel % 9) {
							case 0: item = "Mystery Box"; itemQty = 5; break;
							case 1: item = "Fairy Dust"; itemQty = rng2.Next(1, 3); break;
							case 2:
								var choice = ['Iridium Bar', 'Spicy Eel', 'Triple Shot Espresso', 'Crab Cakes', 'Artifact Trove'];
								item = choice[rng2.Next(choice.length)];
								itemQty = 5;
								break;
							case 3:
								var choice = ['House Plant (1)', 'House Plant (2)', 'House Plant (3)'];
								item = wikify(choice[rng2.Next(choice.length)], "Furniture");
								noLink = true;
								break;								
							case 4: item = "Stardrop Tea"; break;
							case 5: item = "Treasure Chest"; break;
							case 6: item = "Iridium Sprinkler"; break;
							case 7:
								var choice = ['Fancy House Plant (1)', 'Fancy House Plant (2)', 'Fancy House Plant (3)', 'Pig Painting'];
								item = wikify(choice[rng2.Next(choice.length)], "Furniture");
								noLink = true;
								break;
							case 8:
								switch(rng2.Next(2)) {
									case 0: item = "Bomb"; itemQty = 15; break;
									case 1: item = "Mega Bomb"; itemQty = 8; break;
								}
								break;
							default: item = "Mystery Box"; itemQty = 5;
						}
					}
				}

				var tclass = "future";
				if (numOpened === save.ticketPrizesClaimed[whichPlayer] + 1) {
					tclass = "current";
				} else if (numOpened <= save.ticketPrizesClaimed[whichPlayer]) {
					tclass = "past";
				}
				output += '<tr class="' + tclass + '"><td>' + addCommas(numOpened) + '</td>';
				output += '<td class="item">' + (noLink ? item : wikify(item)) + '</td><td>' + itemQty + '</td>';
				output += '</tr>';
			}
		}
		output += '</tbody></table>';
		return output;
	}

	function predictRaccoon(isSearch, offset) {
		// requests from StardewValley.Characters.Raccoon._activateMrRaccoon() and StardewValley.Characters.Raccoon.addNextIngredient()
		// rewards from StardewValley.Characters.Raccoon.getBundleReward()
		var output = '',
			pageSize = 10;

		if (isSearch && typeof(offset) !== 'undefined' && offset !== '') {
			$('#raccoon-prev-50').prop("disabled", true);
			$('#raccoon-prev').prop("disabled", true);
			$('#raccoon-next').prop("disabled", true);
			$('#raccoon-next-50').prop("disabled", true);
			$('#raccoon-reset').html("Clear Search Results &amp; Reset Browsing");
			var searchTerm = new RegExp(offset, "i");
			var searchStart = Math.max(1, ($('#raccoon-search-all').prop('checked')) ? 1 : save.mysteryBoxesOpened[0]);
			var searchEnd = parseInt($('#raccoon-search-range').val()) + searchStart;
			output += '<table class="output"><thead><tr><th colspan="' + (numColumns + 2) +
				'">Search results for &quot;' + offset + '&quot; over the ' +
				(($('#raccoon-search-all').prop('checked')) ? 'first ' : 'next ') + $('#raccoon-search-range').val() + ' raccoon requests</th></tr>';
			output += '<tbody>';
			var count = 0;
			var searchResults = {};
			output += '<tr><td colspan="2" class="count">Found ' + count + ' matching instance(s) of ' +
				Object.keys(searchResults).length + ' matching item(s)</td></tr></tbody></table>';
		} else {
			if (typeof(offset) === 'undefined') {
				offset = pageSize * Math.floor(save.timesFedRaccoons / pageSize);
			}
			if (offset < pageSize) {
				$('#raccoon-prev').prop("disabled", true);
			} else {
				$('#raccoon-prev').val(offset - pageSize);
				$('#raccoon-prev').prop("disabled", false);
			}
			if (offset < 50) {
				$('#raccoon-prev-50').prop("disabled", true);
			} else {
				$('#raccoon-prev-50').val(offset - 50);
				$('#raccoon-prev-50').prop("disabled", false);
			}
			$('#raccoon-reset').val('reset');
			$('#raccoon-reset').html("Reset Browsing");
			$('#raccoon-next').val(offset + pageSize);
			$('#raccoon-next').prop("disabled", false);
			$('#raccoon-next-50').val(offset + 50);
			$('#raccoon-next-50').prop("disabled", false);
			// Reset search fields too
			$('#raccoon-search-text').val('');
			$('#raccoon-search-range').val(200);
			$('#raccoon-search-all').prop('checked', false);

			output += '<table class="output"><thead><tr><th rowspan="2" class="index">Times Fed</th>' +
				'<th colspan="2" class="raccoon-result">First Requested Item</th>' +
				'<th colspan="2" class="raccoon-result">Second Requested Item</th>' +
				'<th colspan="2" class="raccoon-result">Reward Received</th>';
			output += '</tr><tr><th class="item">Item</th><th class="qty">Qty</th><th class="item">Item</th><th class="qty">Qty</th><th class="item">Item</th><th class="qty">Qty</th></tr><tbody>';
			// Some options are seasonal and sometimes multiple rolls must be made for duplicate avoidance.
			// As a result, we run 4 copies of the rng.
			for (var g = 1; g <= pageSize; g++) {
				var tableRow = offset + g;
				var timesFed = tableRow - 1;
				var prevRoll = [];
				var rng = [];
				for (var s = 0; s < 4; s++) {
					rng[s] = new CSRandom(getRandomSeed(save.gameID, timesFed * 377));
					for (var i = 0; i < 10; i++) {
						rng[s].Next();
					}
				}
				var bundleItem = [];
				var bundleQty = [1, 1, 1];
				// We set isLong true when we have the 4 seasonal options in order to left-justify everything. It will also
				// be a signal to treat that bundleItem element as an array rather than a string.
				var isLong = [false, false, false];
				var choice, index;
				// If the whichBundle check rolls RNG, it needs to roll all 4.
				var whichBundle;
				if (timesFed < 5) {
					whichBundle = timesFed % 5;
				} else {
					whichBundle = rng[0].Next(5);
					for (var s = 1; s < 4; s++) { rng[s].Next(); }
				}
				switch (whichBundle) {
					case 0:
						choice = [ "_722", "_721", "_716", "_719", "_723", "_718", "_372" ];
						// Like above, roll the other 3 to stay in sync even though this is same result for all seasons
						bundleItem[0] = wikify(save.objects[choice[rng[0].Next(choice.length)]].name);
						for (var s = 1; s < 4; s++) { rng[s].Next(); }
						bundleQty[0] = 5;
						choice = [
							["_136", "_132", "_700", "_702", "_156", "_267", "_706"],
							["_136", "_132", "_700", "_702", "_156", "_267", "_706", "_138", "_701", "_146", "_130"],
							["_136", "_132", "_700", "_702", "_156", "_701", "_269", "_139", "_139"],
							["_136", "_132", "_700", "_702", "_156", "_146", "_130", "_141", "_269"],
							];
						bundleItem[1] = "";
						bundleQty[1] = 1;
						isLong[1] = true;
						bundleItem[1] = [];
						for (var s = 0; s < 4; s++) {
							index = rng[s].Next(choice[s].length);
							bundleItem[1][s] = wikify("Smoked " + save.objects[choice[s][index]].name);
						}
						break;
					case 1:
						choice = [
							["_90", "_634", "_638", "_400", "_88"],
							["_90", "_258", "_260", "_635", "_636", "_88", "_396"],
							["_90", "_613", "_282", "_637", "_410", "_88", "_406"],
							["_90", "_414", "_414", "_88", "_Powdermelon", "_Powdermelon"],
							];
						isLong[0] = true;
						bundleItem[0] = [];
						for (var s = 0; s < 4; s++) {
							index = rng[s].Next(choice[s].length);
							bundleItem[0][s] = wikify("Dried " + save.objects[choice[s][index]].name);
							prevRoll[s] = index;
						}
						isLong[1] = true;
						bundleItem[1] = [];
						for (var s = 0; s < 4; s++) {
							index = prevRoll[s];
							while (index === prevRoll[s]) {
								index = rng[s].Next(choice[s].length);
							}
							bundleItem[1][s] = wikify(save.objects[choice[s][index]].name + " Jelly");
						}
						break;
					case 2:
						choice = [
							["_422", "_404", "_257"],
							["_422", "_404"],
							["_422", "_404", "_281"],
							["_422", "_404"],
							];
						isLong[0] = true;
						bundleItem[0] = [];
						for (var s = 0; s < 4; s++) {
							index = rng[s].Next(choice[s].length);
							bundleItem[0][s] = wikify("Dried " + save.objects[choice[s][index]].name);
							prevRoll[s] = index;
						}
						// Just hardcoding these because I don't want to deal with trying to interpret -5.
						choice = [ "Egg (Any)", "Cave Carrot", "White Algae" ];
						bundleItem[1] = wikify(choice[rng[0].Next(choice.length)]);
						bundleQty[1] = 5;
						break;
					case 3:
						choice = [
							["_190", "_188", "_250", "_192", "_16", "_22", "_Carrot", "_Carrot"],
							["_270", "_264", "_256", "_78", "_SummerSquash", "_SummerSquash"],
							["_Broccoli", "_Broccoli", "_278", "_272", "_276"],
							["_416", "_412", "_78"],
							];
						isLong[0] = true;
						bundleItem[0] = [];
						for (var s = 0; s < 4; s++) {
							index = rng[s].Next(choice[s].length);
							bundleItem[0][s] = wikify(save.objects[choice[s][index]].name + " Juice");
							prevRoll[s] = index;
						}
						isLong[1] = true;
						bundleItem[1] = [];
						for (var s = 0; s < 4; s++) {
							index = prevRoll[s];
							while (index === prevRoll[s]) {
								index = rng[s].Next(choice[s].length);
							}
							bundleItem[1][s] = wikify("Pickled " + save.objects[choice[s][index]].name);
						}
						break;
					case 4:
						// These have built-in underscore to separate item id from qty. To keep the split nice we won't add our own
						// underscore until after.
						choice = ["Moss_10", "110_1", "168_5", "766_99", "767_20", "535_8", "536_5", "537_3", "393_4", "397_2","684_20", "72_1", "68_3", "156_3"];
						index = rng[0].Next(choice.length);
						var piece = choice[index].split('_');
						bundleItem[0] = wikify(save.objects['_' + piece[0]].name);
						bundleQty[0] = piece[1];
						prevRoll[0] = index;
						while (index === prevRoll[0]) {
							index = rng[0].Next(choice.length);
						}
						var piece = choice[index].split('_');
						bundleItem[1] = wikify(save.objects['_' + piece[0]].name);
						bundleQty[1] = piece[1];
						break;
				}
				// These are rewards rather than bundle items, but we might as well just keep using the same data structure
				// This happens post-feeding so we use tableRow in the seed & switch condition
				switch(tableRow) {
					case 1: bundleItem[2] = "Raccoon Seeds"; bundleQty[2] = 25; break;
					case 2: bundleItem[2] = '<span class="book">' + wikify('Raccoon Journal') + '</span>'; break;
					case 3: bundleItem[2] = wikify("Raccoon Hat", "Hats"); break;
					case 4: bundleItem[2] = wikify("Fairy Dust"); bundleQty[2] = 7; break;
					case 5: bundleItem[2] = wikify("Jungle Tank", "Furniture"); break;
					default: {
						rng = new CSRandom(getRandomSeed(save.gameID, tableRow * 377));
						for (var i = 0; i < 10; i++) {
							rng.Next();
						}
						switch(rng.Next(5)) {
							case 0: bundleItem[2] = wikify("Fairy Dust"); bundleQty[2] = 7; break;
							case 1: bundleItem[2] = '<span class="book">' + wikify('Book of the Stars') + '</span>'; break;
							case 2: bundleItem[2] = 'Next unshipped item<br/>OR<br/>' + wikify('Mystery Box'); bundleQty[2] = '1<br/>OR<br/>4'; break;
							case 3: bundleItem[2] = wikify("Stardrop Tea"); break;
							case 4: bundleItem[2] = "Raccoon Seeds"; bundleQty[2] = 25; break;
							default: bundleItem[2] = wikify('Mystery Box'); bundleQty[2] = 3; break;
						}
					}
				}

				var tclass = "future";
				if (timesFed === save.timesFedRaccoons) {
					tclass = "current";
				} else if (timesFed <= save.timesFedRaccoons) {
					tclass = "past";
				}
				output += '<tr class="' + tclass + '"><td>' + addCommas(tableRow) + '</td>';
				// We only want to put the 4 seasonal options when we absolutely have to so in the loop we check
				// to see if they are all the same (happens often with mushrooms for example) and condense down
				// to a single result when that happens.
				for (var i = 0; i < 3; i++) {
					if (isLong[i]) {
						if (bundleItem[i][0] === bundleItem[i][1] && bundleItem[i][0] === bundleItem[i][2] && bundleItem[i][0] === bundleItem[i][3]) {
							output += '<td class="item">' + bundleItem[i][0] + '</td><td>' + bundleQty[i] + '</td>';
						} else {
							output += '<td class="item long_list">';
							for (var s = 0; s < 4; s++) {
								output += '<img src="blank.png" class="season" id="sea_' + s + '" alt="' + save.seasonNames[s] + '"> ' +
									bundleItem[i][s] + '<br/>';
							}
							output += '</td><td>' + bundleQty[i] + '</td>';
						}
					} else {
						output += '<td class="item">' + bundleItem[i] + '</td><td>' + bundleQty[i] + '</td>';
					}
				}
				output += '</tr>';
			}
		}
		output += '</tbody></table>';
		return output;
	}

	function updateTab(tabID, isSearch, offset, extra) {
		var output = '';
		if (tabID === 'mines') {
			output = predictMines(isSearch, offset);
		} else if (tabID === 'cart') {
			output = predictCart(isSearch, offset);
		} else if (tabID === 'geode') {
			output = predictGeodes(isSearch, offset);
		} else if (tabID === 'mystery') {
			output = predictMysteryBoxes(isSearch, offset);
		} else if (tabID === 'train') {
			output = predictTrains(isSearch, offset);
		} else if (tabID === 'night') {
			output = predictNight(isSearch, offset);
		} else if (tabID === 'crane') {
			output = predictCrane(isSearch, offset);
		} else if (tabID === 'krobus') {
			output = predictKrobus(isSearch, offset);
		} else if (tabID === 'sandy') {
			output = predictSandy(isSearch, offset);
		} else if (tabID === 'wallpaper') {
			output = predictWallpaper(isSearch, offset);
		} else if (tabID === 'trash') {
			output = predictTrash(isSearch, offset);
		//} else if (tabID === 'resort') {
		//	output = predictResortVisitors(isSearch, offset);
		} else if (tabID === 'enchant') {
			output = predictEnchantments(isSearch, offset);
		} else if (tabID === 'minechest') {
			output = predictMineChests(isSearch, offset);
		} else if (tabID === 'gembirds') {
			output = predictGemBirds(isSearch, offset);
		} else if (tabID === 'winterstar') {
			output = predictWinterStar(isSearch, offset);
		} else if (tabID === 'makeover') {
			output = predictMakeover(isSearch, offset);
		} else if (tabID === 'greenrain') {
			output = predictGreenRain(isSearch, offset);
		} else if (tabID === 'cj') {
			output = predictCalicoJack(isSearch, offset, extra);
		} else if (tabID === 'book') {
			output = predictBookseller(isSearch, offset);
		} else if (tabID === 'statue') {
			output = predictStatues(isSearch, offset);
		} else if (tabID === 'prize') {
			output = predictPrizeTicket(isSearch, offset);
		} else if (tabID === 'raccoon') {
			output = predictRaccoon(isSearch, offset);
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
		$("select").change(function () { selectHandler(this); });
		$("button").prop('disabled',false);
	}

	function updateOutput(xmlDoc) {
		try {
			document.getElementById('out-summary').innerHTML = parseSummary(xmlDoc);
			$("input[name='tabset']").each(function() { updateTab(this.id.split('-')[1], false); });
			document.getElementById('progress').value = 100;
			$('#progress-container').hide();
			$('#output-container').show();
		} catch(error) {
			var message = "<h3>Save Parse Error</h3><p>The app was unable to process the save file. This is most likely a bug with the app, so please let the dev know about it. Details below.</p>";
			$('#parse-error').html(message + '<p class="code">' + error + '<br/>' + error.stack + '</p>');
		}
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
		// There is one player-based select menu that needs to be reset if a new file is loaded.
		$('#enchant-player-select').empty();
		$('#enchant-player').hide();
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
			prog.value = 90;
			updateOutput(xmlDoc);
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
	// Set advanced example based upon current location:
	var example_URL = window.location.protocol + '//' + window.location.host + window.location.pathname + $("#advanced_example").text();
	$("#advanced_example").html('<a href="' + example_URL + '">' + example_URL + '</a>');
	// Run output immediately if an ID was given in the URL
	if ($.QueryString.hasOwnProperty("gameid")) {
		updateOutput();
	} else if ($.QueryString.hasOwnProperty("id")) {
		updateOutput();
	}
};