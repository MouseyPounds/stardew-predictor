#!/usr/bin/perl
#
# wallpaper_css_gen.pl
#
# small perl script to generate the css for wallpaper images used in Stardew Predictor
# prints to STDOUT and should be redirected to wallpaper.css

my $tile_width = 16;
my $tile_height = 48;
my $image_width = 256;

	print <<"END_PRINT";
/* wallpaper.css
 * https://mouseypounds.github.io/stardew-predictor/
 */

div.wp {
	clear: left;
}
img.wp {
	float: left;
    width: ${tile_width}px;
    height: 45px;
	border-top: 1px solid black;
	border-bottom: 1px solid black;
	background-image:url("./walls_and_floors.png")
}
img.left {
	border-left: 1px solid black;
}
img.right {
	border-right: 1px solid black;
}
END_PRINT

for (my $i = 0; $i < 112; $i++) {
	use integer;
	
	my $x = 0 - ($tile_width * ($i % ($image_width/$tile_width)));
	my $y = 0 - ($tile_height * ($i / ($image_width/$tile_width)));
	my $id = "wp_" . ($i+1);
	
	print <<"END_PRINT";
img#$id {
    background-position: ${x}px ${y}px;
}
END_PRINT
}

$tile_width = 32;
$tile_height = 32;

	print <<"END_PRINT";
div.fl {
	clear: left;
}
img.fl {
	float: left;
    width: ${tile_width}px;
    height: ${tile_height}px;
	border: 1px solid black;
	background-image:url("./walls_and_floors.png")
}
END_PRINT
for (my $i = 0; $i < 56; $i++) {
	use integer;
	
	my $x = 0 - ($tile_width * ($i % ($image_width/$tile_width)));
	my $y = -336 - ($tile_height * ($i / ($image_width/$tile_width)));
	my $id = "fl_" . ($i+1);
	
	print <<"END_PRINT";
img#$id {
    background-position: ${x}px ${y}px;
}
END_PRINT
}
