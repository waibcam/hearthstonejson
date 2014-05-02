#!/bin/bash

echo "Downloading disunity..."
rm -rf disunity
wget https://github.com/ata4/disunity/releases/download/v0.2.1/disunity_v0.2.1.zip
unzip -d disunity disunity_v0.2.1.zip
rm disunity_v0.2.1.zip
chmod 755 disunity/disunity.sh

echo "Building MPQExtractor..."
git submodule init
git submodule update
cd MPQExtractor
git submodule init
git submodule update
mkdir build
cd build
cmake ..
make
cd ..
cd ..

echo "Installing NPM modules..."
npm install

echo "Linking C.js..."
cd node_modules
ln -s ../shared/C.js
cd ..

