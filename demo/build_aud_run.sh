#!/bin/bash -e

readonly BROTLI_REV="ed1995b6bda19244070ab5d331111f16f67c8054"
readonly EMSDK_REV="17f6a2ef92f198f3c9ff30d07664e4090a0ecaf7"
readonly EMSDK_VER="3.1.32"

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
