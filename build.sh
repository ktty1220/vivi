#!/bin/sh

name=vivi
coffee=src/${name}.coffee
js=dist/${name}.js
jsmin=dist/${name}.min.js
less=src/${name}.less
css=dist/${name}.css
cssmin=dist/${name}.min.css
bower=bower_components
vendorjs=${bower}/hammerjs/hammer.js
vendorcss="${bower}/reset-css/reset.css ${bower}/normalize.css/normalize.css"

coffee -cp $coffee | cat ${vendorjs} - > $js
uglifyjs --comments='/License/' -cm -o $jsmin $js
rm $css && touch $css
for vc in $vendorcss
do
  sed '1 s/^\/\* /\/*!\n/' $vc >> $css
  echo >> $css
done
lessc $less >> $css
uglifycss $css > $cssmin
