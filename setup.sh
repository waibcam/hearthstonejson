#!/bin/bash

rm -rf disunity
wget https://github.com/ata4/disunity/releases/download/v0.2.1/disunity_v0.2.1.zip
unzip -d disunity disunity_v0.2.1.zip
rm disunity_v0.2.1.zip
chmod 755 disunity/disunity.sh

npm install
