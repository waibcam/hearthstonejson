Intro
-----

This project extracts card data from Hearthstone's "base-Win.MPQ" into JSON files.

It is meant to run in Linux. You need both java and wine installed.

Setup
-----

    git clone https://github.com/Sembiance/hearthstonejson.git
    ./build.sh

Run
---
    node generate.js /path/to/base-Win.MPQ


Results
-------

In the 'out' directory will be an 'AllCards.json' file. All will be a bunch of other .json files of cards seperated by set.
