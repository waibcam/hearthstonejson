Intro
-----

This project extracts card data from Hearthstone's "cardxml0.unity3d" into JSON files.

This is then used to generate the website: [http://hearthstonejson.com](http://hearthstonejson.com)

It is meant to run in Linux. To run you need:
* nodejs
* git
* java
* cmake

NOTE: It used to extract 'cardxml0.unity3d' directly from base-Win.MPQ but due to changes by Blizzard it doesn't currently do this. Instead, use the 'cardxml0.unity3d' file directly, found in the Data folder of the Hearthstone install location.

Build
-----

    git clone https://github.com/Sembiance/hearthstonejson.git
    cd hearthstonejson
    ./build.sh

Run
---
    node generate.js /path/to/cardxml0.unity3d


Results
-------

In the 'out' directory will be a JSON file per set.
