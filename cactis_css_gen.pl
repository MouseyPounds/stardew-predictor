#!/usr/bin/perl
#
# cactis_css_gen.pl
#
# small perl script to generate the css for cactis images used in Stardew Predictor
# prints to STDOUT and should be redirected to cactis.css

my $scale = 3;
my $tile_width = 16 * $scale;
my $tile_height = 16 * $scale;
my $image_width = 8 * $tile_width;

	print <<"END_PRINT";
/* cactis.css
 * https://mouseypounds.github.io/stardew-predictor/
 */

img.cactis {
    width: ${tile_width}px;
    height: ${tile_height}px;
	vertical-align: middle;
	background-image:url("./FreeCactuses.png")
}
END_PRINT

for (my $i = 0; $i < 24; $i++) {
	use integer;
	
	my $x = 0 - ($tile_width * ($i % ($image_width/$tile_width)));
	my $y = 0 - ($tile_height * ($i / ($image_width/$tile_width)));
	
	print <<"END_PRINT";
img#c_top_$i {
    background-position: ${x}px ${y}px;
}
END_PRINT
	$y -= 3 * $tile_height;
	print <<"END_PRINT";
img#c_mid_$i {
    background-position: ${x}px ${y}px;
}
END_PRINT
	$y -= 3 * $tile_height;

	if ($i < 16) {
		print <<"END_PRINT";
img#c_bot_$i {
    background-position: ${x}px ${y}px;
}
END_PRINT
	}
}