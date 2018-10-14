#!/usr/bin/perl
#
# wallpaper_css_gen.pl
#
# small perl script to generate the css for wallpaper images used in Stardew Predictor
# prints to STDOUT and should be redirected to wallpaper.css

my $tile_width = 16;
my $tile_height = 48;
my $tiles_per_row = 16;

	print <<"END_PRINT";
/* wallpaper.css
 * https://mouseypounds.github.io/stardew-predictor/
 */

 img.wp {
    width: ${tile_width}px;
    height: ${tile_height}px;
	background-image:url("./walls_and_floors.png")
}
END_PRINT

for (my $i = 0; $i < 112; $i++) {
	use integer;
	
	my $x = 0 - ($tile_width * ($i % $tiles_per_row));
	my $y = 0 - ($tile_height * ($i / $tiles_per_row));
	my $id = "wp_" . ($i+1);
	
	print <<"END_PRINT";
img#$id {
    background-position: ${x}px ${y}px;
}
END_PRINT
}