**What is it?**

Mirror of the official site [http://ubjson.org/](http://ubjson.org/).

**Why?**

Trying to track changes.
Current dump timestamp:
`2014-08-11 01:45:29 +0400`

**Used commands:**

`$ wget --mirror -p --html-extension --trust-server-names --convert-links -e robots=off -P . http://ubjson.org/`

`$ find ! -name *.html -delete`
