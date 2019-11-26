#!/usr/bin/perl
#
# shirt_css_gen.pl
#
# small perl script to generate the css for shirt images used in Stardew Predictor
# prints to STDOUT and should be redirected to shirt.css

my $tile_width = 32;
my $tile_height = 32;
my $image_width = 512;

	print <<"END_PRINT";
/* shirt.css
 * https://mouseypounds.github.io/stardew-predictor/
 */

img.shirt {
    width: ${tile_width}px;
    height: ${tile_height}px;
	vertical-align: middle;
	background-image:url("./shirt_sprites.png")
}
END_PRINT

for (my $i = 0; $i < 128; $i++) {
	use integer;
	
	my $x = 0 - ($tile_width * ($i % ($image_width/$tile_width)));
	my $y = 0 - ($tile_height * ($i / ($image_width/$tile_width)));
	my $id = "shirt_" . ($i+1);
	
	print <<"END_PRINT";
img#$id {
    background-position: ${x}px ${y}px;
}
END_PRINT
}