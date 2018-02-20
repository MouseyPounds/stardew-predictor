/* stardew-predictor.js
 * https://mouseypounds.github.io/stardew-predictor/
 */

/*jshint browser: true, jquery: true, esnext: true */

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
	// "Global" var to cache save info.
	var save = {};

	// Check for required File API support.
	if (!(window.File && window.FileReader)) {
		document.getElementById('out-summary').innerHTML = '<span class="error">Fatal Error: Could not load the File & FileReader APIs</span>';
		return;
	}

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
		// removing egg colors & changing spaces to underscores
		var trimmed = item.replace(' (White)', '');
		trimmed = trimmed.replace(' (Brown)', '');
		trimmed = trimmed.replace(/ /g, '_');
		return (page) ? ('<a href="http://stardewvalleywiki.com/' + page + '#' + trimmed + '">' + item + '</a>') :
					('<a href="http://stardewvalleywiki.com/' + trimmed + '">' + item + '</a>');
	}

	function parseSummary(xmlDoc) {
		var output = '',
			farmTypes = ['Standard', 'Riverland', 'Forest', 'Hill-top', 'Wilderness'],
			playTime,
			playHr,
			playMin;
		// This app doesn't actually need a whole lot from the save file, and can be run from just the gameID number.
		// Right now, that functionality is "secret" and accessed by adding "?id=123456789" (or similar) to the URL.
		// As a result, this is the only function that actually reads anything from the save file; it will store the
		// important information (or reasonable defaults) into the save structure and all other functions will use that.
		if (typeof xmlDoc !== 'undefined') {
			save.gameID = Number($(xmlDoc).find('uniqueIDForThisGame').text());
			output += '<span class="result">Game ID: ' + save.gameID + '</span><br />\n';
			// Farmer & farm names are read as html() because they come from user input and might contain characters
			// which must be escaped.
			output += '<span class="result">' + $(xmlDoc).find('player > name').html() + ' of ' +
				$(xmlDoc).find('player > farmName').html() + ' Farm (' +
				farmTypes[$(xmlDoc).find('whichFarm').text()] + ')</span><br />\n';
			// Date originally used XXForSaveGame elements, but those were not always present on saves downloaded from upload.farm
			save.daysPlayed = Number($(xmlDoc).find('stats > daysPlayed').text());
			save.year = Number($(xmlDoc).find('year').text());
			output += '<span class="result">Day ' + $(xmlDoc).find('dayOfMonth').text() + ' of ' +
				capitalize($(xmlDoc).find('currentSeason').text()) + ', Year ' + save.year +
				' (' + save.daysPlayed + ' days played)</span><br />\n';
			// Playtime of < 1 min will be rounded up to 1 min to avoid blank output.
			playTime = Math.max(Number($(xmlDoc).find('player > millisecondsPlayed').text()), 6e4);
			playHr = Math.floor(playTime / 36e5);
			playMin = Math.floor((playTime % 36e5) / 6e4);
			output += '<span class="result">Played for ';
			if (playHr > 0) {
				output += playHr + ' hr ';
			}
			if (playMin > 0) {
				output += playMin + ' min ';
			}
			output += '</span><br />\n';
			save.geodesCracked = Number($(xmlDoc).find('stats > geodesCracked').text());
		} else if ($.QueryString.hasOwnProperty("id")) {
			save.gameID = parseInt($.QueryString.id);
			save.daysPlayed = 1;
			save.year = 1;
			save.geodesCracked = 0;
			output += '<span class="result">App run using supplied gameID ' + save.gameID +
				'. No other save information available.</span><br />\n';
		} else {
			output = '<span class="error">Fatal Error: Problem reading save file and no ID passed via query string.</span>';
		}

		return output;
	}

	/* might need this structure
			recipes = {
				16: "Wild Horseradish",
				18: "Daffodil",
				20: "Leek",
				22: "Dandelion",
				24: "Parsnip",
				78: "Cave Carrot",
				88: "Coconut",
				90: "Cactus Fruit",
				92: "Sap",
				174: "Large Egg (White)",
				176: "Egg (White)",
				180: "Egg (Brown)",
				182: "Large Egg (Brown)",
				184: "Milk",
				186: "Large Milk",
				188: "Green Bean",
				190: "Cauliflower",
				192: "Potato",
				248: "Garlic",
				250: "Kale",
				252: "Rhubarb",
				254: "Melon",
				256: "Tomato",
				257: "Morel",
				258: "Blueberry",
				259: "Fiddlehead Fern",
				260: "Hot Pepper",
				262: "Wheat",
				264: "Radish",
				266: "Red Cabbage",
				268: "Starfruit",
				270: "Corn",
				272: "Eggplant",
				274: "Artichoke",
				276: "Pumpkin",
				278: "Bok Choy",
				280: "Yam",
				281: "Chanterelle",
				282: "Cranberries",
				283: "Holly",
				284: "Beet",
				296: "Salmonberry",
				300: "Amaranth",
				303: "Pale Ale",
				304: "Hops",
				305: "Void Egg",
				306: "Mayonnaise",
				307: "Duck Mayonnaise",
				308: "Void Mayonnaise",
				330: "Clay",
				334: "Copper Bar",
				335: "Iron Bar",
				336: "Gold Bar",
				337: "Iridium Bar",
				338: "Refined Quartz",
				340: "Honey",
				342: "Pickles",
				344: "Jelly",
				346: "Beer",
				348: "Wine",
				350: "Juice",
				372: "Clam",
				376: "Poppy",
				378: "Copper Ore",
				380: "Iron Ore",
				382: "Coal",
				384: "Gold Ore",
				386: "Iridium Ore",
				388: "Wood",
				390: "Stone",
				392: "Nautilus Shell",
				393: "Coral",
				394: "Rainbow Shell",
				396: "Spice Berry",
				397: "Sea Urchin",
				398: "Grape",
				399: "Spring Onion",
				400: "Strawberry",
				402: "Sweet Pea",
				404: "Common Mushroom",
				406: "Wild Plum",
				408: "Hazelnut",
				410: "Blackberry",
				412: "Winter Root",
				414: "Crystal Fruit",
				416: "Snow Yam",
				417: "Sweet Gem Berry",
				418: "Crocus",
				420: "Red Mushroom",
				421: "Sunflower",
				422: "Purple Mushroom",
				424: "Cheese",
				426: "Goat Cheese",
				428: "Cloth",
				430: "Truffle",
				432: "Truffle Oil",
				433: "Coffee Bean",
				436: "Goat Milk",
				438: "Large Goat Milk",
				440: "Wool",
				442: "Duck Egg",
				444: "Duck Feather",
				446: "Rabbit's Foot",
				454: "Ancient Fruit",
				459: "Mead",
				591: "Tulip",
				593: "Summer Spangle",
				595: "Fairy Rose",
				597: "Blue Jazz",
				613: "Apple",
				634: "Apricot",
				635: "Orange",
				636: "Peach",
				637: "Pomegranate",
				638: "Cherry",
				684: "Bug Meat",
				709: "Hardwood",
				724: "Maple Syrup",
				725: "Oak Resin",
				726: "Pine Tar",
				766: "Slime",
				767: "Bat Wing",
				768: "Solar Essence",
				769: "Void Essence",
				771: "Fiber",
				787: "Battery Pack"
			},
	*/

	function buttonHandler(button) {
		var tab = button.id.split('-')[0];
		if (typeof(button.value) === 'undefined' || button.value === 'reset') {
			updateTab(tab);
		} else {
			updateTab(tab, Number(button.value));
		}
	}
	
	function predictMines(offset) {
		// Mushroom level is determined by StardewValley.Locations.MineShaft.chooseLevelType()
		// Infestation is determined by StardewValley.Locations.MineShaft.loadLevel()
		var output = "",
			season = ['Spring', 'Summer', 'Fall', 'Winter'],
			rng,
			rainbowLights,
			infestedMonster,
			infestedSlime,
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
			$(document.getElementById('mines-prev-year')).prop("disabled", true);
		} else {
			$(document.getElementById('mines-prev-year')).val(offset - 112);
			$(document.getElementById('mines-prev-year')).prop("disabled", false);
		}
		if (offset < 28) {
			$(document.getElementById('mines-prev-month')).prop("disabled", true);
		} else {
			$(document.getElementById('mines-prev-month')).val(offset - 28);
			$(document.getElementById('mines-prev-month')).prop("disabled", false);
		}
		$(document.getElementById('mines-reset')).val('reset');
		$(document.getElementById('mines-next-month')).val(offset + 28);
		$(document.getElementById('mines-next-year')).val(offset + 112);
		month = Math.floor(offset / 28);
		monthName = season[month % 4];
		year = 1 + Math.floor(offset / 112);
		output += '<table class="calendar"><thead><tr><th colspan="7">' + monthName + ' Year ' + year + '</th></tr>\n';
		output += '<tr><th>M</th><th>T</th><th>W</th><th>Th</th><th>F</th><th>Sa</th><th>Su</th></tr></thead>\n<tbody>';
		for (week = 0; week < 4; week++) {
			output += "<tr>";
			for (weekDay = 1; weekDay < 8; weekDay++) {
				rainbowLights = [];
				infestedMonster = [];
				infestedSlime = [];
				day = 7 * week + weekDay + offset;
				for (mineLevel = 1; mineLevel < 120; mineLevel++) {
					if (mineLevel % 5 === 0) {
						// skip elevator floors for everything
						continue;
					}
					// Monster infestation seems to override mushroom spawns so that is checked first
					rng = new CSRandom(day + mineLevel + save.gameID / 2);
					if (mineLevel % 40 > 5 && mineLevel % 40 < 30 && mineLevel % 40 !== 19) {			
						if (rng.NextDouble() < 0.05) {
							if (rng.NextDouble() < 0.5) {
								infestedMonster.push(mineLevel);
							} else {
								infestedSlime.push(mineLevel);
							}
							continue; // skips Mushroom check
						}
					}
					// Reset the seed for checking Mushrooms. Note, there are a couple checks related to
					// darker than normal lighting. We don't care about the results but need to mimic them.
					rng = new CSRandom(day + mineLevel + save.gameID / 2);
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
				if (rainbowLights.length === 0) {
					rainbowLights.push("None");
				}
				if (infestedMonster.length === 0) {
					infestedMonster.push("None");
				}
				if (infestedSlime.length === 0) {
					infestedSlime.push("None");
				}
				output += '<td class="' + tclass + '"><span class="date"> ' + (day - offset) + '</span><br />' + 
					'<span class="cell"><img src="IconM.png" alt="Mushroom"> ' + rainbowLights.join(', ') + 
					'<br /><img src="IconI.png" alt="Sword"> ' + infestedMonster.join(', ') +
					'<br /><img src="IconS.png" alt="Slime"> ' + infestedSlime.join(', ') + '</span></td>';			
			}
			output += "</tr>\n";
		}
		output += '<tr><td colspan="7" class="legend">Legend:  <img src="IconM.png" alt="Mushroom"> Mushroom Level | <img src="IconI.png" alt="Sword"> Monster Infestation | <img src="IconS.png" alt="Slime"> Slime Infestation</td></tr>';
		output += "</tbody></table>\n";
		return output;
	}
	
	function predictCart() {
		var output = 'Coming "Soon"';
		return output;
	}
	
	function predictGeodes() {
		var output = 'Coming "Soon"';
		return output;
	}
	
	function predictWinterStar(offset) {
		var output = "",
			// NPC list from Data\NPCDispositions
			npcs = ['Abigail', 'Caroline', 'Clint', 'Demetrius', 'Willy', 'Elliott', 'Emily',
					'Evelyn', 'George', 'Gus', 'Haley', 'Harvey', 'Jas', 'Jodi', 'Alex',
					'Kent', 'Leah', 'Lewis', 'Linus', 'Marlon', 'Marnie', 'Maru', 'Pam',
					'Penny', 'Pierre', 'Robin', 'Sam', 'Sebastian', 'Shane', 'Vincent',
					'Wizard', 'Dwarf', 'Sandy', 'Krobus'],
			secretSantaGiveTo = '',
			secretSantaGetFrom = '',
			year,
			rng,
			tclass;
		if (typeof(offset) === 'undefined') {
			offset = 10 * Math.floor(save.year / 10);
		}
		if (offset < 10) {
			$(document.getElementById('winterstar-prev')).prop("disabled", true);
		} else {
			$(document.getElementById('winterstar-prev')).val(offset - 10);
			$(document.getElementById('winterstar-prev')).prop("disabled", false);
		}
		$(document.getElementById('winterstar-reset')).val('reset');
		$(document.getElementById('winterstar-next')).val(offset + 10);

		output += '<table class="output"><thead><tr><th>Year</th><th>Farmer gives gift to</th><th>Farmer receives gift from</th></tr>\n<tbody>';
		for (year = offset + 1; year <= offset + 10; year++) {
			// Gift giver and receiver logic from StardewValley.Event.setUpPlayerControlSequence() and StardewValley.Utility.getRandomTownNPC()
			// While it looks like the gift itself might be predictable from StardewValley.Utility.getGiftFromNPC(), the RNG there gets seeded
			// by an expression that includes the NPC's X coordinate, and (based on in-game testing) that seems to be from a pre-festival
			// position which is not easily predictable.
			rng = new CSRandom(save.gameID / 2 - year);
			secretSantaGiveTo = npcs[rng.Next(npcs.length)];
			secretSantaGetFrom = '';
			while (secretSantaGiveTo === 'Wizard' || secretSantaGiveTo === 'Krobus' || secretSantaGiveTo === 'Sandy' || secretSantaGiveTo === 'Dwarf' || secretSantaGiveTo === 'Marlon' ) {
				secretSantaGiveTo = npcs[rng.Next(npcs.length)];
			}
			while (secretSantaGetFrom === '' || secretSantaGetFrom === secretSantaGiveTo) {
				secretSantaGetFrom = npcs[rng.Next(npcs.length)];
			}
			if (year < save.year) {
				tclass = "past";
			} else if (year === save.year) {
				tclass = "current";
			} else {
				tclass = "future";
			}
			output += '<tr class="' + tclass + '"><td>' + year + "</td><td>" + wikify(secretSantaGiveTo) +
				"</td><td>" + wikify(secretSantaGetFrom) + "</td></tr>\n";
		}
		output += "</tbody></table>\n";
		return output;
	}
	
	function updateTab(tabID, extra) {
		var output = '';
		
		if (tabID === 'mines') {
			output = predictMines(extra);
		} else if (tabID === 'cart') {
			output = predictCart(extra);
		} else if (tabID === 'geodes') {
			output = predictGeodes(extra);
		} else if (tabID === 'winterstar') {
			output = predictWinterStar(extra);
		} else {
			console.log("Unknown tabID: " + tabID);
		}
		document.getElementById('out-' + tabID).innerHTML = output;
	}

	function updateOutput(xmlDoc) {
		document.getElementById('out-summary').innerHTML = parseSummary(xmlDoc);
		$("button").click(function () { buttonHandler(this); });
		$("input[name='tabset']").each(function() { updateTab(this.id.split('-')[1]); });
		$(document.getElementById('output-container')).show();
		return;
	}
	
	function handleFileSelect(evt) {
		var file = evt.target.files[0],
			reader = new FileReader(),
			prog = document.getElementById('progress');

		prog.value = 0;
		$(document.getElementById('output-container')).hide();
		$(document.getElementById('progress-container')).show();
		// Keep changelong visable to help with tab switches messing up the scroll position.
		//$(document.getElementById('changelog')).hide();
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
			$(document.getElementById('progress-container')).hide();
		};
		reader.readAsText(file);
	}
	document.getElementById('file_select').addEventListener('change', handleFileSelect, false);
	// Run output immediately if an ID was given in the URL
	if ($.QueryString.hasOwnProperty("id")) {
		updateOutput();
	}
};