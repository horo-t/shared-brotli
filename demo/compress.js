const asm_encode = require("./encode");

const loaded = new Promise((resolve) => {
  asm_encode.addOnInit(resolve);
});

async function compress(input) {
  return compressWithDict(input, null);
}

async function compressWithDict(input, dict) {
  await loaded;
  const quality = 5;
  const mode = 1;
  const lgwin = 22;
  const buf = asm_encode._malloc(input.length);
  const outSize = input.length + 1024;
  const outBuf = asm_encode._malloc(outSize);
  let encodedSize = -1;
  asm_encode.HEAPU8.set(input, buf);
  if (dict) {
    const dictBuf = asm_encode._malloc(dict.length);
    asm_encode.HEAPU8.set(dict, dictBuf);
    encodedSize = asm_encode._encodeWithDict(
      quality,
      lgwin,
      mode,
      input.length,
      buf,
      dict.length,
      dictBuf,
      outSize,
      outBuf
    );
    asm_encode._free(dictBuf);
  } else {
    encodedSize = asm_encode._encode(
      quality,
      lgwin,
      mode,
      input.length,
      buf,
      outSize,
      outBuf
    );
  }

  let outBuffer = null;
  if (encodedSize !== -1) {
    outBuffer = new Uint8Array(encodedSize);
    outBuffer.set(asm_encode.HEAPU8.subarray(outBuf, outBuf + encodedSize));
  }

  asm_encode._free(buf);
  asm_encode._free(outBuf);
  return outBuffer;
}

exports.compress = compress;
exports.compressWithDict = compressWithDict;
