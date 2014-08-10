$ wget --mirror -p --html-extension --trust-server-names --convert-links -e robots=off -P . http://ubjson.org/
$ find ! -name *.html -delete
