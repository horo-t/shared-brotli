const workerpool = require('workerpool');
const {isMainThread} = require('worker_threads');

if (!isMainThread) {
  const compress = require("./compress");
  workerpool.worker({
    compressWithDict: compress.compressWithDict
  });
} else {
  const pool = workerpool.pool(__filename);
  async function compress(input) {
    return compressWithDict(input, null);
  }
  async function compressWithDict(input, dict) {
    return pool.exec('compressWithDict', [input, dict])
  }
  function terminate() {
    pool.terminate();
  }
  exports.compress = compress;
  exports.compressWithDict = compressWithDict;
  exports.terminate = terminate;
}