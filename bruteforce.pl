#!/usr/bin/perl
#
# bruteforce.pl
#
# version 3.0
#
# by MouseyPounds
#
# https://community.playstarbound.com/threads/webapp-stardew-predictor-gaze-into-the-future-of-your-farm.141370/
#
# This script implements most of the C# PRNG in Perl and mimics some of the Stardew Valley
# functions which use it in order to find game "unique IDs" which meet certain criteria.
# It is a brute force search checking each ID for various items to appear on the Traveling
# Cart and also Prismatic Shards to appear in geodes.
#
# The actual search function (and the variables which control it) are way at the bottom of the file.
#
# Updating for 1.4, we're changing the data structures in the same way the main javascript app was changed.
# In addtion to updating the items and prices, we've added in the Artifact Trove info too even though
# we don't actually do anything with them currently.

use strict;
use List::Util;
use Scalar::Util qw(looks_like_number);

# autoflush output
$|++;

# pRNG package
{
	package myPRNG;
	# Basically mimicing C# Random.cs as retrieved from
	# http://referencesource.microsoft.com/#mscorlib/system/random.cs
	
	use Carp;
	
	my $INT_MIN = -2147483648;
	my $INT_MAX = 2147483647;
	my $MBIG = $INT_MAX;
	my $MSEED = 161803398;
	my $MZ = 0;

	my %state = {
		'inext' => 0,
		'inextp' => 0,
		'SeedArray' => (),
		};

	sub Random {
		my $Seed = int(shift);
		if (not defined $Seed) { $Seed = time; }
		
		my $ii;
		my $mj;
		my $mk;
		
		my $subtraction = $INT_MAX;
		if ($Seed > $INT_MIN) { $subtraction = abs($Seed); }
		$mj = $MSEED - $subtraction;
		$state{'SeedArray'}[55] = $mj;
		$mk = 1;
		for (my $i = 1; $i < 55; $i++) {
			$ii = (21*$i)%55;
			$state{'SeedArray'}[$ii] = $mk;
			$mk = $mj - $mk;
			if ($mk < 0) { $mk += $MBIG; }
			$mj = $state{'SeedArray'}[$ii];
		}
		for (my $k = 1; $k < 5; $k++) {
			for (my $i = 1; $i < 56; $i++) {
				$state{'SeedArray'}[$i] -= $state{'SeedArray'}[1+($i+30)%55];
				if ($state{'SeedArray'}[$i] > $INT_MAX) { $state{'SeedArray'}[$i] -= (abs($INT_MIN) + $INT_MAX); }
				if ($state{'SeedArray'}[$i] < 0) { $state{'SeedArray'}[$i] += $MBIG; }
			}
		}
		
		$state{'inext'} = 0;
		$state{'inextp'} = 21;
		$Seed = 1;
		# Debug dump
		# print STDERR "Initial Seed Array:\n";
		# for (my $i = 1; $i < 56; $i++) {
			# print STDERR "  $i" . " => " . $state{'SeedArray'}[$i] . "\n";
		# }
		# end dump
		return bless \%state, 'myPRNG';
	}
	
	sub Sample {
		my $retVal = InternalSample()*(1.0/$MBIG);
		#print STDERR "Sample: " . $retVal . "\n";
		return $retVal;		
	}
	
	sub InternalSample {
		my $retVal;
		my $locINext = $state{'inext'};
		my $locINextp = $state{'inextp'};
		
		if (++$locINext >= 56) { $locINext = 1; }
		if (++$locINextp >= 56) { $locINextp = 1; }
		$retVal = $state{'SeedArray'}[$locINext] - $state{'SeedArray'}[$locINextp];
		if ($retVal == $MBIG) { $retVal--; }
		if ($retVal < 0) { $retVal += $MBIG; }
		$state{'SeedArray'}[$locINext]=$retVal;
		$state{'inext'} = $locINext;
		$state{'inextp'} = $locINextp;
		#print STDERR "InternalSample: " . $retVal . "\n";
		return $retVal;		
	}
	
	sub GetSampleForLargeRange {
		# This might require bignum...
		my $result = InternalSample();
		my $negative = 0;
		if (InternalSample()%2 == 0) { $result = -$result; }
		my $d = $result;
		$d += ($INT_MAX - 1);
		$d /= 2*$INT_MAX - 1;
		#print STDERR "GetSampleForLargeRange: " . $d . "\n";
		return $d;
	}
	
	sub Next {
		# Next() gives range of [0..$INT_MAX)
		# Next($a) gives range of [0..$a)
		# Next($a,$b) gives range of [$a..$b)
		my $min = 0;
		my $max = $INT_MAX;
		my $this = shift;
		
		my $arg = shift;
		if (not defined $arg) {
			return InternalSample();
		}
		$max = $arg;
		$arg = shift;
		if (not defined $arg) {
			if ($max < 0) { carp("Argument out of range - max ($max) must be positive"); }
			return int(Sample()*$max);
		} else {
			$min = $max; # moving first argument
			$max = $arg; # then assigning second argument
			if ($min > $max) { carp("Argument out of range - min ($min) is greater than max ($max)"); }
			my $range = $max - $min;
			if ( $range <= $INT_MAX ) {
				return int(Sample()*$range + $min);
			} else {
				return int(GetSampleForLargeRange()*$range + $min);
			}
		}
	}
	
	sub NextDouble {
		return Sample();
	}
	
	# not implementing NextBytes
}

# necessary data structures
my @seasons = qw(Spring Summer Fall Winter);
my @gTypes = qw(535 536 537 749 275);
my %gContents = (
	535 => [538, 542, 548, 549, 552, 555, 556, 557, 558, 566, 568, 569, 571, 574, 576, 121],
	536 => [541, 544, 545, 546, 550, 551, 559, 560, 561, 564, 567, 572, 573, 577, 123],
	537 => [539, 540, 543, 547, 553, 554, 562, 563, 565, 570, 575, 578, 122],
	749 => [538, 542, 548, 549, 552, 555, 556, 557, 558, 566, 568, 569, 571, 574, 576, 541, 544, 545, 546, 550, 551, 559, 560, 561, 564, 567, 572, 573, 577, 539, 540, 543, 547, 553, 554, 562, 563, 565, 570, 575, 578, 121, 122, 123],
	275 => [100, 101, 103, 104, 105, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 166, 373, 797],
	);
my %objInfo = ( # This isn't full object info but instead is just stuff available in geodes and troves
	74 => q[Prismatic Shard],
	82 => q[Fire Quartz],
	84 => q[Frozen Tear],
	86 => q[Earth Crystal],
	100 => q[Chipped Amphora],
	101 => q[Arrowhead],
	103 => q[Ancient Doll],
	104 => q[Elvish Jewelry],
	105 => q[Chewing Stick],
	106 => q[Ornamental Fan],
	108 => q[Rare Disc],
	109 => q[Ancient Sword],
	110 => q[Rusty Spoon],
	111 => q[Rusty Spur],
	112 => q[Rusty Cog],
	113 => q[Chicken Statue],
	114 => q[Ancient Seed],
	115 => q[Prehistoric Tool],
	116 => q[Dried Starfish],
	117 => q[Anchor],
	118 => q[Glass Shards],
	119 => q[Bone Flute],
	120 => q[Prehistoric Handaxe],
	121 => q[Dwarvish Helm],
	122 => q[Dwarf Gadget],
	123 => q[Ancient Drum],
	124 => q[Golden Mask],
	125 => q[Golden Relic],
	166 => q[Treasure Chest],
	330 => q[Clay],
	373 => q[Golden Pumpkin],
	378 => q[Copper Ore],
	380 => q[Iron Ore],
	382 => q[Coal],
	384 => q[Gold Ore],
	386 => q[Iridium Ore],
	390 => q[Stone],
	538 => q[Alamite],
	539 => q[Bixite],
	540 => q[Baryite],
	541 => q[Aerinite],
	542 => q[Calcite],
	543 => q[Dolomite],
	544 => q[Esperite],
	545 => q[Fluorapatite],
	546 => q[Geminite],
	547 => q[Helvite],
	548 => q[Jamborite],
	549 => q[Jagoite],
	550 => q[Kyanite],
	551 => q[Lunarite],
	552 => q[Malachite],
	553 => q[Neptunite],
	554 => q[Lemon Stone],
	555 => q[Nekoite],
	556 => q[Orpiment],
	557 => q[Petrified Slime],
	558 => q[Thunder Egg],
	559 => q[Pyrite],
	560 => q[Ocean Stone],
	561 => q[Ghost Crystal],
	562 => q[Tigerseye],
	563 => q[Jasper],
	564 => q[Opal],
	565 => q[Fire Opal],
	566 => q[Celestine],
	567 => q[Marble],
	568 => q[Sandstone],
	569 => q[Granite],
	570 => q[Basalt],
	571 => q[Limestone],
	572 => q[Soapstone],
	573 => q[Hematite],
	574 => q[Mudstone],
	575 => q[Obsidian],
	576 => q[Slate],
	577 => q[Fairy Stone],
	578 => q[Star Shards],
	797 => q[Pearl],
	);
	
my %items = ( # Items allowed on the cart. We no longer hardcode every possible ID due to the mechanic change.
	16 => q[Wild Horseradish],
	18 => q[Daffodil],
	20 => q[Leek],
	22 => q[Dandelion],
	24 => q[Parsnip],
	78 => q[Cave Carrot],
	88 => q[Coconut],
	90 => q[Cactus Fruit],
	92 => q[Sap],
	128 => q[Pufferfish],
	129 => q[Anchovy],
	130 => q[Tuna],
	131 => q[Sardine],
	132 => q[Bream],
	136 => q[Largemouth Bass],
	137 => q[Smallmouth Bass],
	138 => q[Rainbow Trout],
	139 => q[Salmon],
	140 => q[Walleye],
	141 => q[Perch],
	142 => q[Carp],
	143 => q[Catfish],
	144 => q[Pike],
	145 => q[Sunfish],
	146 => q[Red Mullet],
	147 => q[Herring],
	148 => q[Eel],
	149 => q[Octopus],
	150 => q[Red Snapper],
	151 => q[Squid],
	154 => q[Sea Cucumber],
	155 => q[Super Cucumber],
	156 => q[Ghostfish],
	164 => q[Sandfish],
	165 => q[Scorpion Carp],
	167 => q[Joja Cola],
	174 => q[Large Egg (White)],
	176 => q[Egg (Brown)],
	180 => q[Egg (Brown)],
	182 => q[Large Egg (Brown)],
	184 => q[Milk],
	186 => q[Large Milk],
	188 => q[Green Bean],
	190 => q[Cauliflower],
	192 => q[Potato],
	194 => q[Fried Egg],
	195 => q[Omelet],
	196 => q[Salad],
	197 => q[Cheese Cauliflower],
	198 => q[Baked Fish],
	199 => q[Parsnip Soup],
	200 => q[Vegetable Medley],
	201 => q[Complete Breakfast],
	202 => q[Fried Calamari],
	203 => q[Strange Bun],
	204 => q[Lucky Lunch],
	205 => q[Fried Mushroom],
	206 => q[Pizza],
	207 => q[Bean Hotpot],
	208 => q[Glazed Yams],
	209 => q[Carp Surprise],
	210 => q[Hashbrowns],
	211 => q[Pancakes],
	212 => q[Salmon Dinner],
	213 => q[Fish Taco],
	214 => q[Crispy Bass],
	215 => q[Pepper Poppers],
	216 => q[Bread],
	218 => q[Tom Kha Soup],
	219 => q[Trout Soup],
	220 => q[Chocolate Cake],
	221 => q[Pink Cake],
	222 => q[Rhubarb Pie],
	223 => q[Cookie],
	224 => q[Spaghetti],
	225 => q[Fried Eel],
	226 => q[Spicy Eel],
	227 => q[Sashimi],
	228 => q[Maki Roll],
	229 => q[Tortilla],
	230 => q[Red Plate],
	231 => q[Eggplant Parmesan],
	232 => q[Rice Pudding],
	233 => q[Ice Cream],
	234 => q[Blueberry Tart],
	235 => q[Autumn's Bounty],
	236 => q[Pumpkin Soup],
	237 => q[Super Meal],
	238 => q[Cranberry Sauce],
	239 => q[Stuffing],
	240 => q[Farmer's Lunch],
	241 => q[Survival Burger],
	242 => q[Dish O' The Sea],
	243 => q[Miner's Treat],
	244 => q[Roots Platter],
	248 => q[Garlic],
	250 => q[Kale],
	251 => q[Tea Sapling],
	252 => q[Rhubarb],
	253 => q[Triple Shot Espresso],
	254 => q[Melon],
	256 => q[Tomato],
	257 => q[Morel],
	258 => q[Blueberry],
	259 => q[Fiddlehead Fern],
	260 => q[Hot Pepper],
	262 => q[Wheat],
	264 => q[Radish],
	265 => q[Seafoam Pudding],
	266 => q[Red Cabbage],
	267 => q[Flounder],
	268 => q[Starfruit],
	269 => q[Midnight Carp],
	270 => q[Corn],
	271 => q[Unmilled Rice],
	272 => q[Eggplant],
	273 => q[Rice Shoot],
	274 => q[Artichoke],
	276 => q[Pumpkin],
	278 => q[Bok Choy],
	280 => q[Yam],
	281 => q[Chanterelle],
	282 => q[Cranberries],
	283 => q[Holly],
	284 => q[Beet],
	286 => q[Cherry Bomb],
	287 => q[Bomb],
	288 => q[Mega Bomb],
	293 => q[Brick Floor],
	296 => q[Salmonberry],
	298 => q[Hardwood Fence],
	299 => q[Amaranth Seeds],
	300 => q[Amaranth],
	301 => q[Grape Starter],
	302 => q[Hops Starter],
	303 => q[Pale Ale],
	304 => q[Hops],
	306 => q[Mayonnaise],
	307 => q[Duck Mayonnaise],
	309 => q[Acorn],
	310 => q[Maple Seed],
	311 => q[Pine Cone],
	322 => q[Wood Fence],
	323 => q[Stone Fence],
	324 => q[Iron Fence],
	325 => q[Gate],
	328 => q[Wood Floor],
	329 => q[Stone Floor],
	330 => q[Clay],
	331 => q[Weathered Floor],
	333 => q[Crystal Floor],
	334 => q[Copper Bar],
	335 => q[Iron Bar],
	336 => q[Gold Bar],
	337 => q[Iridium Bar],
	338 => q[Refined Quartz],
	340 => q[Honey],
	342 => q[Pickles],
	344 => q[Jelly],
	346 => q[Beer],
	347 => q[Rare Seed],
	348 => q[Wine],
	350 => q[Juice],
	368 => q[Basic Fertilizer],
	369 => q[Quality Fertilizer],
	370 => q[Basic Retaining Soil],
	371 => q[Quality Retaining Soil],
	372 => q[Clam],
	376 => q[Poppy],
	378 => q[Copper Ore],
	380 => q[Iron Ore],
	382 => q[Coal],
	384 => q[Gold Ore],
	386 => q[Iridium Ore],
	388 => q[Wood],
	390 => q[Stone],
	392 => q[Nautilus Shell],
	393 => q[Coral],
	394 => q[Rainbow Shell],
	396 => q[Spice Berry],
	397 => q[Sea Urchin],
	398 => q[Grape],
	399 => q[Spring Onion],
	400 => q[Strawberry],
	401 => q[Straw Floor],
	402 => q[Sweet Pea],
	404 => q[Common Mushroom],
	405 => q[Wood Path],
	406 => q[Wild Plum],
	407 => q[Gravel Path],
	408 => q[Hazelnut],
	409 => q[Crystal Path],
	410 => q[Blackberry],
	411 => q[Cobblestone Path],
	412 => q[Winter Root],
	414 => q[Crystal Fruit],
	415 => q[Stepping Stone Path],
	416 => q[Snow Yam],
	418 => q[Crocus],
	420 => q[Red Mushroom],
	421 => q[Sunflower],
	422 => q[Purple Mushroom],
	424 => q[Cheese],
	425 => q[Fairy Seeds],
	426 => q[Goat Cheese],
	427 => q[Tulip Bulb],
	428 => q[Cloth],
	429 => q[Jazz Seeds],
	430 => q[Truffle],
	431 => q[Sunflower Seeds],
	432 => q[Truffle Oil],
	433 => q[Coffee Bean],
	436 => q[Goat Milk],
	438 => q[L. Goat Milk],
	440 => q[Wool],
	442 => q[Duck Egg],
	444 => q[Duck Feather],
	445 => q[Caviar],
	446 => q[Rabbit's Foot],
	453 => q[Poppy Seeds],
	455 => q[Spangle Seeds],
	456 => q[Algae Soup],
	457 => q[Pale Broth],
	459 => q[Mead],
	465 => q[Speed-Gro],
	466 => q[Deluxe Speed-Gro],
	472 => q[Parsnip Seeds],
	473 => q[Bean Starter],
	474 => q[Cauliflower Seeds],
	475 => q[Potato Seeds],
	476 => q[Garlic Seeds],
	477 => q[Kale Seeds],
	478 => q[Rhubarb Seeds],
	479 => q[Melon Seeds],
	480 => q[Tomato Seeds],
	481 => q[Blueberry Seeds],
	482 => q[Pepper Seeds],
	483 => q[Wheat Seeds],
	484 => q[Radish Seeds],
	485 => q[Red Cabbage Seeds],
	486 => q[Starfruit Seeds],
	487 => q[Corn Seeds],
	488 => q[Eggplant Seeds],
	489 => q[Artichoke Seeds],
	490 => q[Pumpkin Seeds],
	491 => q[Bok Choy Seeds],
	492 => q[Yam Seeds],
	493 => q[Cranberry Seeds],
	494 => q[Beet Seeds],
	495 => q[Spring Seeds],
	496 => q[Summer Seeds],
	497 => q[Fall Seeds],
	498 => q[Winter Seeds],
	499 => q[Ancient Seeds],
	591 => q[Tulip],
	593 => q[Summer Spangle],
	595 => q[Fairy Rose],
	597 => q[Blue Jazz],
	599 => q[Sprinkler],
	604 => q[Plum Pudding],
	605 => q[Artichoke Dip],
	606 => q[Stir Fry],
	607 => q[Roasted Hazelnuts],
	608 => q[Pumpkin Pie],
	609 => q[Radish Salad],
	610 => q[Fruit Salad],
	611 => q[Blackberry Cobbler],
	612 => q[Cranberry Candy],
	613 => q[Apple],
	614 => q[Green Tea],
	618 => q[Bruschetta],
	621 => q[Quality Sprinkler],
	628 => q[Cherry Sapling],
	629 => q[Apricot Sapling],
	630 => q[Orange Sapling],
	631 => q[Peach Sapling],
	632 => q[Pomegranate Sapling],
	633 => q[Apple Sapling],
	634 => q[Apricot],
	635 => q[Orange],
	636 => q[Peach],
	637 => q[Pomegranate],
	638 => q[Cherry],
	648 => q[Coleslaw],
	649 => q[Fiddlehead Risotto],
	651 => q[Poppyseed Muffin],
	684 => q[Bug Meat],
	685 => q[Bait],
	686 => q[Spinner],
	687 => q[Dressed Spinner],
	691 => q[Barbed Hook],
	692 => q[Lead Bobber],
	693 => q[Treasure Hunter],
	694 => q[Trap Bobber],
	695 => q[Cork Bobber],
	698 => q[Sturgeon],
	699 => q[Tiger Trout],
	700 => q[Bullhead],
	701 => q[Tilapia],
	702 => q[Chub],
	703 => q[Magnet],
	704 => q[Dorado],
	705 => q[Albacore],
	706 => q[Shad],
	707 => q[Lingcod],
	708 => q[Halibut],
	709 => q[Hardwood],
	715 => q[Lobster],
	716 => q[Crayfish],
	717 => q[Crab],
	718 => q[Cockle],
	719 => q[Mussel],
	720 => q[Shrimp],
	721 => q[Snail],
	722 => q[Periwinkle],
	723 => q[Oyster],
	724 => q[Maple Syrup],
	725 => q[Oak Resin],
	726 => q[Pine Tar],
	727 => q[Chowder],
	728 => q[Fish Stew],
	729 => q[Escargot],
	730 => q[Lobster Bisque],
	731 => q[Maple Bar],
	732 => q[Crab Cakes],
	733 => q[Shrimp Cocktail],
	734 => q[Woodskip],
	766 => q[Slime],
	767 => q[Bat Wing],
	768 => q[Solar Essence],
	769 => q[Void Essence],
	771 => q[Fiber],
	772 => q[Oil of Garlic],
	773 => q[Life Elixir],
	787 => q[Battery Pack],
	);
	
my %prices = ( # Mapping item names to base values for price calculation.
	q[Acorn] => 20,
	q[Albacore] => 75,
	q[Algae Soup] => 100,
	q[Amaranth] => 150,
	q[Amaranth Seeds] => 35,
	q[Anchovy] => 30,
	q[Ancient Seeds] => 30,
	q[Apple] => 100,
	q[Apple Sapling] => 1000,
	q[Apricot] => 50,
	q[Apricot Sapling] => 500,
	q[Artichoke] => 160,
	q[Artichoke Dip] => 210,
	q[Artichoke Seeds] => 15,
	q[Autumn's Bounty] => 350,
	q[Bait] => 1,
	q[Baked Fish] => 100,
	q[Barbed Hook] => 500,
	q[Basic Fertilizer] => 2,
	q[Basic Retaining Soil] => 4,
	q[Bat Wing] => 15,
	q[Battery Pack] => 500,
	q[Bean Hotpot] => 100,
	q[Bean Starter] => 30,
	q[Beer] => 200,
	q[Beet] => 100,
	q[Beet Seeds] => 10,
	q[Blackberry] => 20,
	q[Blackberry Cobbler] => 260,
	q[Blue Jazz] => 50,
	q[Blueberry] => 50,
	q[Blueberry Seeds] => 40,
	q[Blueberry Tart] => 150,
	q[Bok Choy] => 80,
	q[Bok Choy Seeds] => 25,
	q[Bomb] => 50,
	q[Bread] => 60,
	q[Bream] => 45,
	q[Brick Floor] => 1,
	q[Bruschetta] => 210,
	q[Bug Meat] => 8,
	q[Bullhead] => 75,
	q[Cactus Fruit] => 75,
	q[Carp] => 30,
	q[Carp Surprise] => 150,
	q[Catfish] => 200,
	q[Cauliflower] => 175,
	q[Cauliflower Seeds] => 40,
	q[Cave Carrot] => 25,
	q[Caviar] => 500,
	q[Chanterelle] => 160,
	q[Cheese] => 230,
	q[Cheese Cauliflower] => 300,
	q[Cherry] => 80,
	q[Cherry Bomb] => 50,
	q[Cherry Sapling] => 850,
	q[Chocolate Cake] => 200,
	q[Chowder] => 135,
	q[Chub] => 50,
	q[Clam] => 50,
	q[Clay] => 20,
	q[Cloth] => 470,
	q[Coal] => 15,
	q[Cobblestone Path] => 1,
	q[Cockle] => 50,
	q[Coconut] => 100,
	q[Coffee Bean] => 15,
	q[Coleslaw] => 345,
	q[Common Mushroom] => 40,
	q[Complete Breakfast] => 350,
	q[Cookie] => 140,
	q[Copper Bar] => 60,
	q[Copper Ore] => 5,
	q[Coral] => 80,
	q[Cork Bobber] => 250,
	q[Corn] => 50,
	q[Corn Seeds] => 75,
	q[Crab] => 100,
	q[Crab Cakes] => 275,
	q[Cranberries] => 75,
	q[Cranberry Candy] => 175,
	q[Cranberry Sauce] => 120,
	q[Cranberry Seeds] => 120,
	q[Crayfish] => 75,
	q[Crispy Bass] => 150,
	q[Crocus] => 60,
	q[Crystal Floor] => 1,
	q[Crystal Fruit] => 150,
	q[Crystal Path] => 1,
	q[Daffodil] => 30,
	q[Dandelion] => 40,
	q[Deluxe Speed-Gro] => 40,
	q[Dish O' The Sea] => 220,
	q[Dorado] => 100,
	q[Dressed Spinner] => 500,
	q[Duck Egg] => 95,
	q[Duck Feather] => 125,
	q[Duck Mayonnaise] => 375,
	q[Eel] => 85,
	q[Egg (Brown)] => 50,
	q[Eggplant] => 60,
	q[Eggplant Parmesan] => 200,
	q[Eggplant Seeds] => 10,
	q[Escargot] => 125,
	q[Fairy Rose] => 290,
	q[Fairy Seeds] => 100,
	q[Fall Seeds] => 45,
	q[Farmer's Lunch] => 150,
	q[Fiber] => 1,
	q[Fiddlehead Fern] => 90,
	q[Fiddlehead Risotto] => 350,
	q[Fish Stew] => 175,
	q[Fish Taco] => 500,
	q[Flounder] => 100,
	q[Fried Calamari] => 150,
	q[Fried Eel] => 120,
	q[Fried Egg] => 35,
	q[Fried Mushroom] => 200,
	q[Fruit Salad] => 450,
	q[Garlic] => 60,
	q[Garlic Seeds] => 20,
	q[Gate] => 4,
	q[Ghostfish] => 45,
	q[Glazed Yams] => 200,
	q[Goat Cheese] => 400,
	q[Goat Milk] => 225,
	q[Gold Bar] => 250,
	q[Gold Ore] => 25,
	q[Grape] => 80,
	q[Grape Starter] => 30,
	q[Gravel Path] => 1,
	q[Green Bean] => 40,
	q[Green Tea] => 100,
	q[Halibut] => 80,
	q[Hardwood] => 15,
	q[Hardwood Fence] => 10,
	q[Hashbrowns] => 120,
	q[Hazelnut] => 90,
	q[Herring] => 30,
	q[Holly] => 80,
	q[Honey] => 100,
	q[Hops] => 25,
	q[Hops Starter] => 30,
	q[Hot Pepper] => 40,
	q[Ice Cream] => 120,
	q[Iridium Bar] => 1000,
	q[Iridium Ore] => 100,
	q[Iron Bar] => 120,
	q[Iron Fence] => 6,
	q[Iron Ore] => 10,
	q[Jazz Seeds] => 15,
	q[Jelly] => 160,
	q[Joja Cola] => 25,
	q[Juice] => 150,
	q[Kale] => 110,
	q[Kale Seeds] => 35,
	q[L. Goat Milk] => 345,
	q[Large Egg (Brown)] => 95,
	q[Large Egg (White)] => 95,
	q[Large Milk] => 190,
	q[Largemouth Bass] => 100,
	q[Lead Bobber] => 150,
	q[Leek] => 60,
	q[Life Elixir] => 500,
	q[Lingcod] => 120,
	q[Lobster] => 120,
	q[Lobster Bisque] => 205,
	q[Lucky Lunch] => 250,
	q[Magnet] => 15,
	q[Maki Roll] => 220,
	q[Maple Bar] => 300,
	q[Maple Seed] => 5,
	q[Maple Syrup] => 200,
	q[Mayonnaise] => 190,
	q[Mead] => 200,
	q[Mega Bomb] => 50,
	q[Melon] => 250,
	q[Melon Seeds] => 40,
	q[Midnight Carp] => 150,
	q[Milk] => 125,
	q[Miner's Treat] => 200,
	q[Morel] => 150,
	q[Mussel] => 30,
	q[Nautilus Shell] => 120,
	q[Oak Resin] => 150,
	q[Octopus] => 150,
	q[Oil of Garlic] => 1000,
	q[Omelet] => 125,
	q[Orange] => 100,
	q[Orange Sapling] => 1000,
	q[Oyster] => 40,
	q[Pale Ale] => 300,
	q[Pale Broth] => 150,
	q[Pancakes] => 80,
	q[Parsnip] => 35,
	q[Parsnip Seeds] => 10,
	q[Parsnip Soup] => 120,
	q[Peach] => 140,
	q[Peach Sapling] => 1500,
	q[Pepper Poppers] => 200,
	q[Pepper Seeds] => 20,
	q[Perch] => 55,
	q[Periwinkle] => 20,
	q[Pickles] => 100,
	q[Pike] => 100,
	q[Pine Cone] => 5,
	q[Pine Tar] => 100,
	q[Pink Cake] => 480,
	q[Pizza] => 300,
	q[Plum Pudding] => 260,
	q[Pomegranate] => 140,
	q[Pomegranate Sapling] => 1500,
	q[Poppy] => 140,
	q[Poppy Seeds] => 50,
	q[Poppyseed Muffin] => 250,
	q[Potato] => 80,
	q[Potato Seeds] => 25,
	q[Pufferfish] => 200,
	q[Pumpkin] => 320,
	q[Pumpkin Pie] => 385,
	q[Pumpkin Seeds] => 50,
	q[Pumpkin Soup] => 300,
	q[Purple Mushroom] => 250,
	q[Quality Fertilizer] => 10,
	q[Quality Retaining Soil] => 5,
	q[Quality Sprinkler] => 450,
	q[Rabbit's Foot] => 565,
	q[Radish] => 90,
	q[Radish Salad] => 300,
	q[Radish Seeds] => 20,
	q[Rainbow Shell] => 300,
	q[Rainbow Trout] => 65,
	q[Rare Seed] => 200,
	q[Red Cabbage] => 260,
	q[Red Cabbage Seeds] => 50,
	q[Red Mullet] => 75,
	q[Red Mushroom] => 75,
	q[Red Plate] => 400,
	q[Red Snapper] => 50,
	q[Refined Quartz] => 50,
	q[Rhubarb] => 220,
	q[Rhubarb Pie] => 400,
	q[Rhubarb Seeds] => 50,
	q[Rice Pudding] => 260,
	q[Rice Shoot] => 20,
	q[Roasted Hazelnuts] => 270,
	q[Roots Platter] => 100,
	q[Salad] => 110,
	q[Salmon] => 75,
	q[Salmon Dinner] => 300,
	q[Salmonberry] => 5,
	q[Sandfish] => 75,
	q[Sap] => 2,
	q[Sardine] => 40,
	q[Sashimi] => 75,
	q[Scorpion Carp] => 150,
	q[Sea Cucumber] => 75,
	q[Sea Urchin] => 160,
	q[Seafoam Pudding] => 300,
	q[Shad] => 60,
	q[Shrimp] => 60,
	q[Shrimp Cocktail] => 160,
	q[Slime] => 5,
	q[Smallmouth Bass] => 50,
	q[Snail] => 65,
	q[Snow Yam] => 100,
	q[Solar Essence] => 40,
	q[Spaghetti] => 120,
	q[Spangle Seeds] => 25,
	q[Speed-Gro] => 20,
	q[Spice Berry] => 80,
	q[Spicy Eel] => 175,
	q[Spinner] => 250,
	q[Spring Onion] => 8,
	q[Spring Seeds] => 35,
	q[Sprinkler] => 100,
	q[Squid] => 80,
	q[Starfruit] => 750,
	q[Starfruit Seeds] => 200,
	q[Stepping Stone Path] => 1,
	q[Stir Fry] => 335,
	q[Stone] => 2,
	q[Stone Fence] => 2,
	q[Stone Floor] => 1,
	q[Strange Bun] => 225,
	q[Straw Floor] => 1,
	q[Strawberry] => 120,
	q[Stuffing] => 165,
	q[Sturgeon] => 200,
	q[Summer Seeds] => 55,
	q[Summer Spangle] => 90,
	q[Sunfish] => 30,
	q[Sunflower] => 80,
	q[Sunflower Seeds] => 20,
	q[Super Cucumber] => 250,
	q[Super Meal] => 220,
	q[Survival Burger] => 180,
	q[Sweet Pea] => 50,
	q[Tea Sapling] => 500,
	q[Tiger Trout] => 150,
	q[Tilapia] => 75,
	q[Tom Kha Soup] => 250,
	q[Tomato] => 60,
	q[Tomato Seeds] => 25,
	q[Tortilla] => 50,
	q[Trap Bobber] => 200,
	q[Treasure Hunter] => 250,
	q[Triple Shot Espresso] => 450,
	q[Trout Soup] => 100,
	q[Truffle] => 625,
	q[Truffle Oil] => 1065,
	q[Tulip] => 30,
	q[Tulip Bulb] => 10,
	q[Tuna] => 100,
	q[Unmilled Rice] => 30,
	q[Vegetable Medley] => 120,
	q[Void Essence] => 50,
	q[Walleye] => 105,
	q[Weathered Floor] => 1,
	q[Wheat] => 25,
	q[Wheat Seeds] => 5,
	q[Wild Horseradish] => 50,
	q[Wild Plum] => 80,
	q[Wine] => 400,
	q[Winter Root] => 70,
	q[Winter Seeds] => 30,
	q[Wood] => 2,
	q[Wood Fence] => 1,
	q[Wood Floor] => 1,
	q[Wood Path] => 1,
	q[Woodskip] => 75,
	q[Wool] => 340,
	q[Yam] => 160,
	q[Yam Seeds] => 30,
	);

sub printDate {
	my $daysPlayed = shift;
	$daysPlayed--;
	
	my $day = ($daysPlayed % 28) + 1;
	my $month = $seasons[int($daysPlayed / 28) % 4];
	my $year = 1 + int($daysPlayed / 112);
	return "$month $day, Y$year";
}

sub getCartItem {
	# Helper function for cart prediction that rolls the itemID, price, and quantity and
	# makes sure this item does not duplicate something already seen.
	my $rng = shift;
	my $seenItems = shift;
	# The return object
	my $theItem = { 'Name' => '', 'Price' => 0, 'Qty' => 1 };
	# Initial roll and loop to ensure uniqueness
	my $itemID = $rng->Next(2,790);
	my $keepGoing = 1;
	while ($keepGoing) {
		$itemID++;
		$itemID %= 790;
		if (exists $items{$itemID}) {
			# We have an item; must roll prices and quantity before checking for uniqueness to match game code
			$theItem->{'Name'} = $items{$itemID};
			my $base = $prices{$theItem->{'Name'}};
			$theItem->{'Price'} = List::Util::max($rng->Next(1,11)*100,$base*$rng->Next(3,6));
			if ($rng->NextDouble() < 0.1) { $theItem->{'Qty'} = 5 };
			if (not exists($seenItems->{$theItem->{'Name'}})) {
				$seenItems->{$theItem->{'Name'}} = 1;
				$keepGoing = 0;
			}
		}
	}
	return $theItem;
}
	
# This is the actual search function. Starting and Ending IDs should be self-explanatory.
# $max_geodes is the maximum number of geodes to check for Prismatic Shard.
# $shard_required should be non-zero if a shard must be found for the ID to be marked good.
# $cart_weeks is how many weeks from the start of the game to check for cart items.
# The cart search always requires Red Cabbage (or seeds) to be found.
# Any other required cart items should be listed in the %need hash
# Any items which you just want to check if they are on the cart should be listed in the %check hash

sub doSearch {
	no strict 'refs';
	my $ID_Start = 100000000;
	my $ID_End = 110000000;
	my $max_geodes = 99;
	my $shard_required = 1;
	my $cart_weeks = 10;
	
	print "Brute Search for optimum starts:\nUsing ID range of [$ID_Start, $ID_End]\n";

	for (my $gameID = $ID_Start; $gameID < $ID_End; $gameID++) {
		if ($gameID % 10000 == 0) { print "... ID $gameID ...\n"; } # Search progress indicator

		# Cart items to check are defined here. Use the negative of the amount of the item you
		# need to find (e.g. 'q(Apple) => -3' to get at least 3 apples).
		my %need = (
			q(Nautilus Shell) => -1,
			q(Crocus) => -1,
			q(Snow Yam) => -1,
			q(Apple) => -3,
			);
		my %check = (
			q(Truffle) => -1,
			q(Rabbit's Foot) => -1,
			);

		# This is needed to hold results
		my %found = ();
		my $cabbage = -1;
		foreach my $wk (0..$cart_weeks) {
			foreach my $d (5,7) {
				my $daysPlayed = $wk*7+$d;
				my $rng = myPRNG::Random($gameID + $daysPlayed);
				my $seenItems = {};
				foreach my $slot (1..10) {
					my $item = getCartItem($rng, $seenItems);
					if ($cabbage <= -1 and ($item->{'Name'} eq 'Red Cabbage' or $item->{'Name'} eq 'Red Cabbage Seeds')) {
						$found{$item->{'Name'}} = [] if (not exists $found{$item->{'Name'}});
						push @{$found{$item->{'Name'}}}, printDate($daysPlayed) . " ($item->{'Qty'})";
						$cabbage += $item->{'Qty'};
					}
					foreach my $k (keys %need) {
						if ($need{$k} <= -1 and $item->{'Name'} eq $k) {
							$found{$k} = [] if (not exists $found{$k});
							push @{$found{$k}}, printDate($daysPlayed) . " ($item->{'Qty'})";
							$need{$k} += $item->{'Qty'};
						}
					}
					foreach my $k (keys %check) {
						if ($check{$k} <= -1 and $item->{'Name'} eq $k) {
							$found{$k} = [] if (not exists $found{$k});
							push @{$found{$k}}, printDate($daysPlayed) . " ($item->{'Qty'})";
							$check{$k} += $item->{'Qty'};
						}
					}
				} # foreach $slot
			} # foreach $d
		} # foreach $wk
		
		my $isGood = 0;
		if ($cabbage > -1) {
			$isGood = 1;
			foreach my $k (keys %need) {
				if ($need{$k} <= -1) {
					$isGood = 0;
				}
			}
		}
		
		next unless ($isGood);
		
		my $shard_number = -1;
		my $num = -1;
		my $case = -1;
		# Note: if troves are going to be searched for something, a second rng instance will be needed. See the js code.
		foreach my $g (16..$max_geodes) {
			my $rng = myPRNG::Random($g + ($gameID/2));
			# 1.4 "pre-warms" the RNG twice to counter patterns
			for (my $i = 0; $i < 2; $i++) {
				my $preWarm = $rng->Next(1,10);
				for (my $j = 0; $j < $preWarm; $j++) {
					$rng->NextDouble();
				}
			}
			if ($rng->NextDouble() >= 0.5) {
				my $theNext = $rng->NextDouble();
				# Game code also checks that the total number cracked > 15, but we skip that since we only start looking at 16
				if ($rng->NextDouble() < 0.008) {
					$shard_number = $g;
					last;
				}
			}
		} # foreach $g

		next if ($shard_required and $shard_number == -1);
		
		# Should only get here if the cart had good results
		print "Good ID: $gameID\n";
		if (exists $found{"Red Cabbage"}) {
			printf "  %s: %s\n", "Red Cabbage", join("; ",@{$found{"Red Cabbage"}});
		}
		if (exists $found{"Red Cabbage Seeds"}) {
			printf "  %s: %s\n", "Red Cabbage Seeds", join("; ",@{$found{"Red Cabbage Seeds"}});
		}
		foreach my $k (sort keys %need) {
			printf "  %s: %s\n", $k, join("; ",@{$found{$k}});
		}
		foreach my $k (sort keys %check) {
			printf "  %s: %s\n", $k, join("; ",@{$found{$k}});
		}
		print "  Shard: $shard_number\n";
	}
}

doSearch();
exit;
