#!/bin/bash -e

readonly BROTLI_REV="9801a2c5d6c67c467ffad676ac301379bb877fc3"
readonly EMSDK_REV="b6574f3a89dbe25d007e3fdc7681faac5a5c0403"
readonly EMSDK_VER="3.1.21"

rm -rf third_party encode.wasm encode.js

mkdir third_party
cd third_party
git clone https://github.com/google/brotli.git
cd brotli
git checkout $BROTLI_REV
cd ../
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
git checkout $EMSDK_REV

./emsdk install $EMSDK_VER
./emsdk activate $EMSDK_VER

source ./emsdk_env.sh
cd ../../

make

npm install
npm run start
