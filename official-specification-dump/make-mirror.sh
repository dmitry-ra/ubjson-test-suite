#!/bin/bash

cd $(dirname $(readlink -f $0))
wget --mirror -p --html-extension --trust-server-names --convert-links -e robots=off -P . http://ubjson.org/
date -u --rfc-3339=seconds > timestamp.txt
cd ubjson.org
find -name *.html -exec sed -i.bak -re 's/<!--.*?-->/<!-- REMOVED -->/g' {} \;
find ! -name *.html -delete