#!/bin/bash -e

readonly BROTLI_REV="ed1995b6bda19244070ab5d331111f16f67c8054"
readonly EMSDK_REV="17f6a2ef92f198f3c9ff30d07664e4090a0ecaf7"
readonly EMSDK_VER="3.1.32"

rm -rf third_party encode.wasm encode.js demofiles.tar.gz

mkdir third_party
cd third_party

# Download brotli

git clone https://github.com/google/brotli.git
cd brotli
git checkout $BROTLI_REV

# Build dictionary_generator
cd research/
bazel build dictionary_generator
cd ../../

# Wikipedia demo
mkdir -p wikipedia/pages_for_dict/
mkdir -p wikipedia/pages/

i=0
while [ "$i" -lt 10 ]; do
    PN=$(printf "%03d" $(expr $i + 1))
    i=$(expr $i + 1)
    curl -L https://en.wikipedia.org/wiki/Special:Random -o "./wikipedia/pages/$PN.html"
done

i=0
while [ "$i" -lt 10 ]; do
    PN=$(printf "%03d" $(expr $i + 1))
    i=$(expr $i + 1)
    curl -L https://en.wikipedia.org/wiki/Special:Random -o "./wikipedia/pages_for_dict/$PN.html"
done

./brotli/research/bazel-bin/dictionary_generator -t128k ./wikipedia/wikipedia.dict ./wikipedia/pages_for_dict/*

# Google Search demo
mkdir -p google_search/pages_for_dict/
mkdir -p google_search/pages/

UA="Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36"
SEARCH_URL="https://www.google.com/search?hl=en&q="

i=0
while read line; do
  PN=$(printf "%03d" $(expr $i + 1))
  i=$(expr $i + 1)
  echo $line
  echo "${SEARCH_URL}${line}"
  curl  -H "User-Agent: $UA" -L "${SEARCH_URL}${line}" -o "./google_search/pages/$PN.html"
done < ../search_list.txt


i=0
while read line; do
  PN=$(printf "%03d" $(expr $i + 1))
  i=$(expr $i + 1)
  echo $line
  echo "${SEARCH_URL}${line}"
  curl  -H "User-Agent: $UA" -L "${SEARCH_URL}${line}" -o "./google_search/pages_for_dict/$PN.html"
done < ../search_list_for_dict.txt

./brotli/research/bazel-bin/dictionary_generator -t128k ./google_search/google_search.dict ./google_search/pages_for_dict/*


# Download Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
git checkout $EMSDK_REV

./emsdk install $EMSDK_VER
./emsdk activate $EMSDK_VER

source ./emsdk_env.sh
cd ../../

zip -r demofiles.zip \
   third_party/wikipedia/wikipedia.dict \
   third_party/wikipedia/pages/ \
   third_party/google_search/google_search.dict \
   third_party/google_search/pages/

make

npm install
npm run start
