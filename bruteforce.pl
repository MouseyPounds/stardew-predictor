#!/usr/bin/perl
#
# bruteforce.pl
#
# version 2.1
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
# Note, this was written with the version 1.2 geode handling which means Omni geodes will
# always give fire quartz; in 1.3 that result was changed to a random roll which could be
# quartz, frozen tear, or fire quartz.

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
my @gTypes = qw(535 536 537 749);
my %gContents = (
	535 => [538, 542, 548, 549, 552, 555, 556, 557, 558, 566, 568, 569, 571, 574, 576, 121],
	536 => [541, 544, 545, 546, 550, 551, 559, 560, 561, 564, 567, 572, 573, 577, 123],
	537 => [539, 540, 543, 547, 553, 554, 562, 563, 565, 570, 575, 578, 122],
	749 => [538, 542, 548, 549, 552, 555, 556, 557, 558, 566, 568, 569, 571, 574, 576, 541, 544, 545, 546, 550, 551, 559, 560, 561, 564, 567, 572, 573, 577, 539, 540, 543, 547, 553, 554, 562, 563, 565, 570, 575, 578, 121, 122, 123],
	);
my %objInfo = (
	74 => q[Prismatic Shard],
	82 => q[Fire Quartz],
	84 => q[Frozen Tear],
	86 => q[Earth Crystal],
	121 => q[Dwarvish Helm],
	122 => q[Dwarf Gadget],
	123 => q[Ancient Drum],
	330 => q[Clay],
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
	);
	
my %items = (
	789 => q[Wild Horseradish],
	788 => q[Wild Horseradish],
	787 => q[Wild Horseradish],
	786 => q[Battery Pack],
	785 => q[Battery Pack],
	784 => q[Battery Pack],
	783 => q[Battery Pack],
	782 => q[Battery Pack],
	781 => q[Battery Pack],
	780 => q[Battery Pack],
	779 => q[Battery Pack],
	778 => q[Battery Pack],
	777 => q[Battery Pack],
	776 => q[Battery Pack],
	775 => q[Battery Pack],
	774 => q[Battery Pack],
	773 => q[Battery Pack],
	772 => q[Life Elixir],
	771 => q[Oil of Garlic],
	770 => q[Fiber],
	769 => q[Fiber],
	768 => q[Void Essence],
	767 => q[Solar Essence],
	766 => q[Bat Wing],
	765 => q[Slime],
	764 => q[Slime],
	763 => q[Slime],
	762 => q[Slime],
	761 => q[Slime],
	760 => q[Slime],
	759 => q[Slime],
	758 => q[Slime],
	757 => q[Slime],
	756 => q[Slime],
	755 => q[Slime],
	754 => q[Slime],
	753 => q[Slime],
	752 => q[Slime],
	751 => q[Slime],
	750 => q[Slime],
	749 => q[Slime],
	748 => q[Slime],
	747 => q[Slime],
	746 => q[Slime],
	745 => q[Slime],
	744 => q[Slime],
	743 => q[Slime],
	742 => q[Slime],
	741 => q[Slime],
	740 => q[Slime],
	739 => q[Slime],
	738 => q[Slime],
	737 => q[Slime],
	736 => q[Slime],
	735 => q[Slime],
	734 => q[Slime],
	733 => q[Woodskip],
	732 => q[Woodskip],
	731 => q[Crab Cakes],
	730 => q[Maple Bar],
	729 => q[Lobster Bisque],
	728 => q[Escargot],
	727 => q[Fish Stew],
	726 => q[Chowder],
	725 => q[Pine Tar],
	724 => q[Oak Resin],
	723 => q[Maple Syrup],
	722 => q[Oyster],
	721 => q[Periwinkle],
	720 => q[Snail],
	719 => q[Shrimp],
	718 => q[Mussel],
	717 => q[Cockle],
	716 => q[Crab],
	715 => q[Crayfish],
	714 => q[Lobster],
	713 => q[Lobster],
	712 => q[Lobster],
	711 => q[Lobster],
	710 => q[Lobster],
	709 => q[Lobster],
	708 => q[Hardwood],
	707 => q[Halibut],
	706 => q[Lingcod],
	705 => q[Shad],
	704 => q[Albacore],
	703 => q[Dorado],
	702 => q[Magnet],
	701 => q[Chub],
	700 => q[Tilapia],
	699 => q[Bullhead],
	698 => q[Tiger Trout],
	697 => q[Sturgeon],
	696 => q[Sturgeon],
	695 => q[Sturgeon],
	694 => q[Cork Bobber],
	693 => q[Trap Bobber],
	692 => q[Treasure Hunter],
	691 => q[Lead Bobber],
	690 => q[Barbed Hook],
	689 => q[Barbed Hook],
	688 => q[Barbed Hook],
	687 => q[Barbed Hook],
	686 => q[Dressed Spinner],
	685 => q[Spinner],
	684 => q[Bait],
	683 => q[Bug Meat],
	682 => q[Bug Meat],
	681 => q[Bug Meat],
	680 => q[Bug Meat],
	679 => q[Bug Meat],
	678 => q[Bug Meat],
	677 => q[Bug Meat],
	676 => q[Bug Meat],
	675 => q[Bug Meat],
	674 => q[Bug Meat],
	673 => q[Bug Meat],
	672 => q[Bug Meat],
	671 => q[Bug Meat],
	670 => q[Bug Meat],
	669 => q[Bug Meat],
	668 => q[Bug Meat],
	667 => q[Bug Meat],
	666 => q[Bug Meat],
	665 => q[Bug Meat],
	664 => q[Bug Meat],
	663 => q[Bug Meat],
	662 => q[Bug Meat],
	661 => q[Bug Meat],
	660 => q[Bug Meat],
	659 => q[Bug Meat],
	658 => q[Bug Meat],
	657 => q[Bug Meat],
	656 => q[Bug Meat],
	655 => q[Bug Meat],
	654 => q[Bug Meat],
	653 => q[Bug Meat],
	652 => q[Bug Meat],
	651 => q[Bug Meat],
	650 => q[Poppyseed Muffin],
	649 => q[Poppyseed Muffin],
	648 => q[Fiddlehead Risotto],
	647 => q[Coleslaw],
	646 => q[Coleslaw],
	645 => q[Coleslaw],
	644 => q[Coleslaw],
	643 => q[Coleslaw],
	642 => q[Coleslaw],
	641 => q[Coleslaw],
	640 => q[Coleslaw],
	639 => q[Coleslaw],
	638 => q[Coleslaw],
	637 => q[Cherry],
	636 => q[Pomegranate],
	635 => q[Peach],
	634 => q[Orange],
	633 => q[Apricot],
	632 => q[Apple Sapling],
	631 => q[Pomegranate Sapling],
	630 => q[Peach Sapling],
	629 => q[Orange Sapling],
	628 => q[Apricot Sapling],
	627 => q[Cherry Sapling],
	626 => q[Cherry Sapling],
	625 => q[Cherry Sapling],
	624 => q[Cherry Sapling],
	623 => q[Cherry Sapling],
	622 => q[Cherry Sapling],
	621 => q[Cherry Sapling],
	620 => q[Quality Sprinkler],
	619 => q[Quality Sprinkler],
	618 => q[Quality Sprinkler],
	617 => q[Bruschetta],
	616 => q[Bruschetta],
	615 => q[Bruschetta],
	614 => q[Bruschetta],
	613 => q[Bruschetta],
	612 => q[Apple],
	611 => q[Cranberry Candy],
	610 => q[Blackberry Cobbler],
	609 => q[Fruit Salad],
	608 => q[Radish Salad],
	607 => q[Pumpkin Pie],
	606 => q[Roasted Hazelnuts],
	605 => q[Stir Fry],
	604 => q[Artichoke Dip],
	603 => q[Plum Pudding],
	602 => q[Plum Pudding],
	601 => q[Plum Pudding],
	600 => q[Plum Pudding],
	599 => q[Plum Pudding],
	598 => q[Sprinkler],
	597 => q[Sprinkler],
	596 => q[Blue Jazz],
	595 => q[Blue Jazz],
	594 => q[Fairy Rose],
	593 => q[Fairy Rose],
	592 => q[Summer Spangle],
	591 => q[Summer Spangle],
	590 => q[Tulip],
	589 => q[Tulip],
	588 => q[Tulip],
	587 => q[Tulip],
	586 => q[Tulip],
	585 => q[Tulip],
	584 => q[Tulip],
	583 => q[Tulip],
	582 => q[Tulip],
	581 => q[Tulip],
	580 => q[Tulip],
	579 => q[Tulip],
	578 => q[Tulip],
	577 => q[Tulip],
	576 => q[Tulip],
	575 => q[Tulip],
	574 => q[Tulip],
	573 => q[Tulip],
	572 => q[Tulip],
	571 => q[Tulip],
	570 => q[Tulip],
	569 => q[Tulip],
	568 => q[Tulip],
	567 => q[Tulip],
	566 => q[Tulip],
	565 => q[Tulip],
	564 => q[Tulip],
	563 => q[Tulip],
	562 => q[Tulip],
	561 => q[Tulip],
	560 => q[Tulip],
	559 => q[Tulip],
	558 => q[Tulip],
	557 => q[Tulip],
	556 => q[Tulip],
	555 => q[Tulip],
	554 => q[Tulip],
	553 => q[Tulip],
	552 => q[Tulip],
	551 => q[Tulip],
	550 => q[Tulip],
	549 => q[Tulip],
	548 => q[Tulip],
	547 => q[Tulip],
	546 => q[Tulip],
	545 => q[Tulip],
	544 => q[Tulip],
	543 => q[Tulip],
	542 => q[Tulip],
	541 => q[Tulip],
	540 => q[Tulip],
	539 => q[Tulip],
	538 => q[Tulip],
	537 => q[Tulip],
	536 => q[Tulip],
	535 => q[Tulip],
	534 => q[Tulip],
	533 => q[Tulip],
	532 => q[Tulip],
	531 => q[Tulip],
	530 => q[Tulip],
	529 => q[Tulip],
	528 => q[Tulip],
	527 => q[Tulip],
	526 => q[Tulip],
	525 => q[Tulip],
	524 => q[Tulip],
	523 => q[Tulip],
	522 => q[Tulip],
	521 => q[Tulip],
	520 => q[Tulip],
	519 => q[Tulip],
	518 => q[Tulip],
	517 => q[Tulip],
	516 => q[Tulip],
	515 => q[Tulip],
	514 => q[Tulip],
	513 => q[Tulip],
	512 => q[Tulip],
	511 => q[Tulip],
	510 => q[Tulip],
	509 => q[Tulip],
	508 => q[Tulip],
	507 => q[Tulip],
	506 => q[Tulip],
	505 => q[Tulip],
	504 => q[Tulip],
	503 => q[Tulip],
	502 => q[Tulip],
	501 => q[Tulip],
	500 => q[Tulip],
	499 => q[Tulip],
	498 => q[Ancient Seeds],
	497 => q[Winter Seeds],
	496 => q[Fall Seeds],
	495 => q[Summer Seeds],
	494 => q[Spring Seeds],
	493 => q[Beet Seeds],
	492 => q[Cranberry Seeds],
	491 => q[Yam Seeds],
	490 => q[Bok Choy Seeds],
	489 => q[Pumpkin Seeds],
	488 => q[Artichoke Seeds],
	487 => q[Eggplant Seeds],
	486 => q[Corn Seeds],
	485 => q[Starfruit Seeds],
	484 => q[Red Cabbage Seeds],
	483 => q[Radish Seeds],
	482 => q[Wheat Seeds],
	481 => q[Pepper Seeds],
	480 => q[Blueberry Seeds],
	479 => q[Tomato Seeds],
	478 => q[Melon Seeds],
	477 => q[Rhubarb Seeds],
	476 => q[Kale Seeds],
	475 => q[Garlic Seeds],
	474 => q[Potato Seeds],
	473 => q[Cauliflower Seeds],
	472 => q[Bean Starter],
	471 => q[Parsnip Seeds],
	470 => q[Parsnip Seeds],
	469 => q[Parsnip Seeds],
	468 => q[Parsnip Seeds],
	467 => q[Parsnip Seeds],
	466 => q[Parsnip Seeds],
	465 => q[Deluxe Speed-Gro],
	464 => q[Speed-Gro],
	463 => q[Speed-Gro],
	462 => q[Speed-Gro],
	461 => q[Speed-Gro],
	460 => q[Speed-Gro],
	459 => q[Speed-Gro],
	458 => q[Mead],
	457 => q[Mead],
	456 => q[Pale Broth],
	455 => q[Algae Soup],
	454 => q[Spangle Seeds],
	453 => q[Spangle Seeds],
	452 => q[Poppy Seeds],
	451 => q[Poppy Seeds],
	450 => q[Poppy Seeds],
	449 => q[Poppy Seeds],
	448 => q[Poppy Seeds],
	447 => q[Poppy Seeds],
	446 => q[Poppy Seeds],
	445 => q[Rabbit's Foot],
	444 => q[Rabbit's Foot],
	443 => q[Duck Feather],
	442 => q[Duck Feather],
	441 => q[Duck Egg],
	440 => q[Duck Egg],
	439 => q[Wool],
	438 => q[Wool],
	437 => q[L. Goat Milk],
	436 => q[L. Goat Milk],
	435 => q[Goat Milk],
	434 => q[Goat Milk],
	433 => q[Goat Milk],
	432 => q[Coffee Bean],
	431 => q[Truffle Oil],
	430 => q[Sunflower Seeds],
	429 => q[Truffle],
	428 => q[Jazz Seeds],
	427 => q[Cloth],
	426 => q[Tulip Bulb],
	425 => q[Goat Cheese],
	424 => q[Fairy Seeds],
	423 => q[Cheese],
	422 => q[Cheese],
	421 => q[Purple Mushroom],
	420 => q[Sunflower],
	419 => q[Red Mushroom],
	418 => q[Red Mushroom],
	417 => q[Crocus],
	416 => q[Sweet Gem Berry],
	415 => q[Snow Yam],
	414 => q[Stepping Stone Path],
	413 => q[Crystal Fruit],
	412 => q[Crystal Fruit],
	411 => q[Winter Root],
	410 => q[Cobblestone Path],
	409 => q[Blackberry],
	408 => q[Crystal Path],
	407 => q[Hazelnut],
	406 => q[Gravel Path],
	405 => q[Wild Plum],
	404 => q[Wood Path],
	403 => q[Common Mushroom],
	402 => q[Common Mushroom],
	401 => q[Sweet Pea],
	400 => q[Straw Floor],
	399 => q[Strawberry],
	398 => q[Spring Onion],
	397 => q[Grape],
	396 => q[Sea Urchin],
	395 => q[Spice Berry],
	394 => q[Spice Berry],
	393 => q[Rainbow Shell],
	392 => q[Coral],
	391 => q[Nautilus Shell],
	390 => q[Nautilus Shell],
	389 => q[Stone],
	388 => q[Stone],
	387 => q[Wood],
	386 => q[Wood],
	385 => q[Iridium Ore],
	384 => q[Iridium Ore],
	383 => q[Gold Ore],
	382 => q[Gold Ore],
	381 => q[Coal],
	380 => q[Coal],
	379 => q[Iron Ore],
	378 => q[Iron Ore],
	377 => q[Copper Ore],
	376 => q[Copper Ore],
	375 => q[Poppy],
	374 => q[Poppy],
	373 => q[Poppy],
	372 => q[Poppy],
	371 => q[Clam],
	370 => q[Quality Retaining Soil],
	369 => q[Basic Retaining Soil],
	368 => q[Quality Fertilizer],
	367 => q[Basic Fertilizer],
	366 => q[Basic Fertilizer],
	365 => q[Basic Fertilizer],
	364 => q[Basic Fertilizer],
	363 => q[Basic Fertilizer],
	362 => q[Basic Fertilizer],
	361 => q[Basic Fertilizer],
	360 => q[Basic Fertilizer],
	359 => q[Basic Fertilizer],
	358 => q[Basic Fertilizer],
	357 => q[Basic Fertilizer],
	356 => q[Basic Fertilizer],
	355 => q[Basic Fertilizer],
	354 => q[Basic Fertilizer],
	353 => q[Basic Fertilizer],
	352 => q[Basic Fertilizer],
	351 => q[Basic Fertilizer],
	350 => q[Basic Fertilizer],
	349 => q[Juice],
	348 => q[Juice],
	347 => q[Wine],
	346 => q[Rare Seed],
	345 => q[Beer],
	344 => q[Beer],
	343 => q[Jelly],
	342 => q[Jelly],
	341 => q[Pickles],
	340 => q[Pickles],
	339 => q[Honey],
	338 => q[Honey],
	337 => q[Refined Quartz],
	336 => q[Iridium Bar],
	335 => q[Gold Bar],
	334 => q[Iron Bar],
	333 => q[Copper Bar],
	332 => q[Crystal Floor],
	331 => q[Crystal Floor],
	330 => q[Weathered Floor],
	329 => q[Clay],
	328 => q[Stone Floor],
	327 => q[Wood Floor],
	326 => q[Wood Floor],
	325 => q[Wood Floor],
	324 => q[Gate],
	323 => q[Iron Fence],
	322 => q[Stone Fence],
	321 => q[Wood Fence],
	320 => q[Wood Fence],
	319 => q[Wood Fence],
	318 => q[Wood Fence],
	317 => q[Wood Fence],
	316 => q[Wood Fence],
	315 => q[Wood Fence],
	314 => q[Wood Fence],
	313 => q[Wood Fence],
	312 => q[Wood Fence],
	311 => q[Wood Fence],
	310 => q[Pine Cone],
	309 => q[Maple Seed],
	308 => q[Acorn],
	307 => q[Void Mayonnaise],
	306 => q[Duck Mayonnaise],
	305 => q[Mayonnaise],
	304 => q[Void Egg],
	303 => q[Hops],
	302 => q[Pale Ale],
	301 => q[Hops Starter],
	300 => q[Grape Starter],
	299 => q[Amaranth],
	298 => q[Amaranth Seeds],
	297 => q[Hardwood Fence],
	296 => q[Hardwood Fence],
	295 => q[Salmonberry],
	294 => q[Salmonberry],
	293 => q[Salmonberry],
	292 => q[Salmonberry],
	291 => q[Salmonberry],
	290 => q[Salmonberry],
	289 => q[Salmonberry],
	288 => q[Salmonberry],
	287 => q[Mega Bomb],
	286 => q[Bomb],
	285 => q[Cherry Bomb],
	284 => q[Cherry Bomb],
	283 => q[Beet],
	282 => q[Holly],
	281 => q[Cranberries],
	280 => q[Chanterelle],
	279 => q[Yam],
	278 => q[Yam],
	277 => q[Bok Choy],
	276 => q[Bok Choy],
	275 => q[Pumpkin],
	274 => q[Pumpkin],
	273 => q[Artichoke],
	272 => q[Artichoke],
	271 => q[Eggplant],
	270 => q[Eggplant],
	269 => q[Corn],
	268 => q[Corn],
	267 => q[Starfruit],
	266 => q[Starfruit],
	265 => q[Red Cabbage],
	264 => q[Red Cabbage],
	263 => q[Radish],
	262 => q[Radish],
	261 => q[Wheat],
	260 => q[Wheat],
	259 => q[Hot Pepper],
	258 => q[Fiddlehead Fern],
	257 => q[Blueberry],
	256 => q[Morel],
	255 => q[Tomato],
	254 => q[Tomato],
	253 => q[Melon],
	252 => q[Melon],
	251 => q[Rhubarb],
	250 => q[Rhubarb],
	249 => q[Kale],
	248 => q[Kale],
	247 => q[Garlic],
	246 => q[Garlic],
	245 => q[Garlic],
	244 => q[Garlic],
	243 => q[Roots Platter],
	242 => q[Miner's Treat],
	241 => q[Dish O' The Sea],
	240 => q[Survival Burger],
	239 => q[Farmer's Lunch],
	238 => q[Stuffing],
	237 => q[Cranberry Sauce],
	236 => q[Super Meal],
	235 => q[Pumpkin Soup],
	234 => q[Autumn's Bounty],
	233 => q[Blueberry Tart],
	232 => q[Ice Cream],
	231 => q[Rice Pudding],
	230 => q[Eggplant Parmesan],
	229 => q[Red Plate],
	228 => q[Tortilla],
	227 => q[Maki Roll],
	226 => q[Sashimi],
	225 => q[Spicy Eel],
	224 => q[Fried Eel],
	223 => q[Spaghetti],
	222 => q[Cookie],
	221 => q[Rhubarb Pie],
	220 => q[Pink Cake],
	219 => q[Chocolate Cake],
	218 => q[Trout Soup],
	217 => q[Tom Kha Soup],
	216 => q[Tom Kha Soup],
	215 => q[Bread],
	214 => q[Pepper Poppers],
	213 => q[Crispy Bass],
	212 => q[Fish Taco],
	211 => q[Salmon Dinner],
	210 => q[Pancakes],
	209 => q[Hashbrowns],
	208 => q[Carp Surprise],
	207 => q[Glazed Yams],
	206 => q[Bean Hotpot],
	205 => q[Pizza],
	204 => q[Fried Mushroom],
	203 => q[Lucky Lunch],
	202 => q[Strange Bun],
	201 => q[Fried Calamari],
	200 => q[Complete Breakfast],
	199 => q[Vegetable Medley],
	198 => q[Parsnip Soup],
	197 => q[Baked Fish],
	196 => q[Cheese Cauliflower],
	195 => q[Salad],
	194 => q[Omelet],
	193 => q[Fried Egg],
	192 => q[Fried Egg],
	191 => q[Potato],
	190 => q[Potato],
	189 => q[Cauliflower],
	188 => q[Cauliflower],
	187 => q[Green Bean],
	186 => q[Green Bean],
	185 => q[Large Milk],
	184 => q[Large Milk],
	183 => q[Milk],
	182 => q[Milk],
	181 => q[Large Egg (Brown)],
	180 => q[Large Egg (Brown)],
	179 => q[Egg (Brown)],
	178 => q[Egg (Brown)],
	177 => q[Egg (Brown)],
	176 => q[Egg (Brown)],
	175 => q[Egg (White)],
	174 => q[Egg (White)],
	173 => q[Large Egg (White)],
	172 => q[Large Egg (White)],
	171 => q[Large Egg (White)],
	170 => q[Large Egg (White)],
	169 => q[Large Egg (White)],
	168 => q[Large Egg (White)],
	167 => q[Large Egg (White)],
	166 => q[Joja Cola],
	165 => q[Joja Cola],
	164 => q[Scorpion Carp],
	163 => q[Sandfish],
	162 => q[Sandfish],
	161 => q[Sandfish],
	160 => q[Sandfish],
	159 => q[Sandfish],
	158 => q[Sandfish],
	157 => q[Sandfish],
	156 => q[Sandfish],
	155 => q[Ghostfish],
	154 => q[Super Cucumber],
	153 => q[Sea Cucumber],
	152 => q[Sea Cucumber],
	151 => q[Sea Cucumber],
	150 => q[Squid],
	149 => q[Red Snapper],
	148 => q[Octopus],
	147 => q[Eel],
	146 => q[Herring],
	145 => q[Red Mullet],
	144 => q[Sunfish],
	143 => q[Pike],
	142 => q[Catfish],
	141 => q[Carp],
	140 => q[Perch],
	139 => q[Walleye],
	138 => q[Salmon],
	137 => q[Rainbow Trout],
	136 => q[Smallmouth Bass],
	135 => q[Largemouth Bass],
	134 => q[Largemouth Bass],
	133 => q[Largemouth Bass],
	132 => q[Largemouth Bass],
	131 => q[Bream],
	130 => q[Sardine],
	129 => q[Tuna],
	128 => q[Anchovy],
	127 => q[Pufferfish],
	126 => q[Pufferfish],
	125 => q[Pufferfish],
	124 => q[Pufferfish],
	123 => q[Pufferfish],
	122 => q[Pufferfish],
	121 => q[Pufferfish],
	120 => q[Pufferfish],
	119 => q[Pufferfish],
	118 => q[Pufferfish],
	117 => q[Pufferfish],
	116 => q[Pufferfish],
	115 => q[Pufferfish],
	114 => q[Pufferfish],
	113 => q[Pufferfish],
	112 => q[Pufferfish],
	111 => q[Pufferfish],
	110 => q[Pufferfish],
	109 => q[Pufferfish],
	108 => q[Pufferfish],
	107 => q[Pufferfish],
	106 => q[Pufferfish],
	105 => q[Pufferfish],
	104 => q[Pufferfish],
	103 => q[Pufferfish],
	102 => q[Pufferfish],
	101 => q[Pufferfish],
	100 => q[Pufferfish],
	99 => q[Pufferfish],
	98 => q[Pufferfish],
	97 => q[Pufferfish],
	96 => q[Pufferfish],
	95 => q[Pufferfish],
	94 => q[Pufferfish],
	93 => q[Pufferfish],
	92 => q[Pufferfish],
	91 => q[Sap],
	90 => q[Sap],
	89 => q[Cactus Fruit],
	88 => q[Cactus Fruit],
	87 => q[Coconut],
	86 => q[Coconut],
	85 => q[Coconut],
	84 => q[Coconut],
	83 => q[Coconut],
	82 => q[Coconut],
	81 => q[Coconut],
	80 => q[Coconut],
	79 => q[Coconut],
	78 => q[Coconut],
	77 => q[Cave Carrot],
	76 => q[Cave Carrot],
	75 => q[Cave Carrot],
	74 => q[Cave Carrot],
	73 => q[Cave Carrot],
	72 => q[Cave Carrot],
	71 => q[Cave Carrot],
	70 => q[Cave Carrot],
	69 => q[Cave Carrot],
	68 => q[Cave Carrot],
	67 => q[Cave Carrot],
	66 => q[Cave Carrot],
	65 => q[Cave Carrot],
	64 => q[Cave Carrot],
	63 => q[Cave Carrot],
	62 => q[Cave Carrot],
	61 => q[Cave Carrot],
	60 => q[Cave Carrot],
	59 => q[Cave Carrot],
	58 => q[Cave Carrot],
	57 => q[Cave Carrot],
	56 => q[Cave Carrot],
	55 => q[Cave Carrot],
	54 => q[Cave Carrot],
	53 => q[Cave Carrot],
	52 => q[Cave Carrot],
	51 => q[Cave Carrot],
	50 => q[Cave Carrot],
	49 => q[Cave Carrot],
	48 => q[Cave Carrot],
	47 => q[Cave Carrot],
	46 => q[Cave Carrot],
	45 => q[Cave Carrot],
	44 => q[Cave Carrot],
	43 => q[Cave Carrot],
	42 => q[Cave Carrot],
	41 => q[Cave Carrot],
	40 => q[Cave Carrot],
	39 => q[Cave Carrot],
	38 => q[Cave Carrot],
	37 => q[Cave Carrot],
	36 => q[Cave Carrot],
	35 => q[Cave Carrot],
	34 => q[Cave Carrot],
	33 => q[Cave Carrot],
	32 => q[Cave Carrot],
	31 => q[Cave Carrot],
	30 => q[Cave Carrot],
	29 => q[Cave Carrot],
	28 => q[Cave Carrot],
	27 => q[Cave Carrot],
	26 => q[Cave Carrot],
	25 => q[Cave Carrot],
	24 => q[Cave Carrot],
	23 => q[Parsnip],
	22 => q[Parsnip],
	21 => q[Dandelion],
	20 => q[Dandelion],
	19 => q[Leek],
	18 => q[Leek],
	17 => q[Daffodil],
	16 => q[Daffodil],
	15 => q[Wild Horseradish],
	14 => q[Wild Horseradish],
	13 => q[Wild Horseradish],
	12 => q[Wild Horseradish],
	11 => q[Wild Horseradish],
	10 => q[Wild Horseradish],
	9 => q[Wild Horseradish],
	8 => q[Wild Horseradish],
	7 => q[Wild Horseradish],
	6 => q[Wild Horseradish],
	5 => q[Wild Horseradish],
	4 => q[Wild Horseradish],
	3 => q[Wild Horseradish],
	2 => q[Wild Horseradish],
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
	q[Chanterelle] => 160,
	q[Cheese] => 200,
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
	q[Egg (White)] => 50,
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
	q[Goat Cheese] => 375,
	q[Goat Milk] => 225,
	q[Gold Bar] => 250,
	q[Gold Ore] => 25,
	q[Grape] => 80,
	q[Grape Starter] => 30,
	q[Gravel Path] => 1,
	q[Green Bean] => 40,
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
	q[Large Egg (White)] => 95,
	q[Large Egg (Brown)] => 95,
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
	q[Shad] => 60,
	q[Shrimp] => 60,
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
	q[Stone] => 0,
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
	q[Sweet Gem Berry] => 3000,
	q[Sweet Pea] => 50,
	q[Tiger Trout] => 150,
	q[Tilapia] => 75,
	q[Tom Kha Soup] => 250,
	q[Tomato] => 60,
	q[Tomato Seeds] => 25,
	q[Tortilla] => 50,
	q[Trap Bobber] => 200,
	q[Treasure Hunter] => 250,
	q[Trout Soup] => 100,
	q[Truffle] => 625,
	q[Truffle Oil] => 1065,
	q[Tulip] => 30,
	q[Tulip Bulb] => 10,
	q[Tuna] => 100,
	q[Vegetable Medley] => 120,
	q[Void Egg] => 65,
	q[Void Essence] => 50,
	q[Void Mayonnaise] => 275,
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
	my $ID_End = 200000000;
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
				foreach my $slot (1..10) {
					my $item = $rng->Next(2,790);
					my $name = $items{$item};
					my $name = $items{$item};
					my $base = $prices{$name};
					my $price = List::Util::max($rng->Next(1,11)*100,$base*$rng->Next(3,6));
					my $qty = 1;
					if ($rng->NextDouble() < 0.1) { $qty = 5 };
					if ($cabbage <= -1 and ($name eq 'Red Cabbage' or $name eq 'Red Cabbage Seeds')) {
						$found{$name} = [] if (not exists $found{$name});
						push @{$found{$name}}, printDate($daysPlayed) . " ($qty)";
						$cabbage += $qty;
					}
					foreach my $k (keys %need) {
						if ($need{$k} <= -1 and $name eq $k) {
							$found{$k} = [] if (not exists $found{$k});
							push @{$found{$k}}, printDate($daysPlayed) . " ($qty)";
							$need{$k} += $qty;
						}
					}
					foreach my $k (keys %check) {
						if ($check{$k} <= -1 and $name eq $k) {
							$found{$k} = [] if (not exists $found{$k});
							push @{$found{$k}}, printDate($daysPlayed) . " ($qty)";
							$check{$k} += $qty;
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
		foreach my $g (16..$max_geodes) {
			my $numCracked = $g;
			my $rng = myPRNG::Random($numCracked + ($gameID/2));
			if ($rng->NextDouble() >= 0.5) {
				my $theNext = $rng->NextDouble();
				if ($rng->NextDouble() < 0.008 and $numCracked > 15) {
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
