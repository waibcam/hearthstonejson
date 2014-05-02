Intro
-----

This project extracts card data from Hearthstone's "base-Win.MPQ" into JSON files.

This is then used to generate the website: [http://hearthstonejson.com](http://hearthstonejson.com)

It is meant to run in Linux. You need both java and wine installed.

Setup
-----

    git clone https://github.com/Sembiance/hearthstonejson.git
    cd hearthstonejson
    ./setup.sh

Run
---
    node generate.js /path/to/base-Win.MPQ


Results
-------

In the 'out' directory will be a JSON file per set.
