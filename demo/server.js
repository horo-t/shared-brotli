const crypto = require('crypto');
const fastify = require('fastify')({
  logger: false,
});
const https = require('node:https');
const path = require('path');

async function getHttps(url) {
  return new Promise((resolve, reject) => {
    const data = [];
    https.get(url, (res) => {
      res.on('data', (d) => {
        data.push(d);
      }).on('end', (e) => {
        resolve(Buffer.concat(data));
      });
    }).on('error', (e) => {
      reject(e);
    });
  });
}
console.log(__filename);
const THREE_JS_VERSIONS = ['r80', 'r81', 'r82', 'r83', 'r84'];
async function initilizeLib(lib) {
  // https://developers.google.com/speed/libraries
  async function getThree(version) {
    const res = await getHttps(
      `https://ajax.googleapis.com/ajax/libs/threejs/${version}/three.min.js`
    );
    return new Uint8Array(res);
  }

  const compress = require('./compress_workerpool');
  let promises = [];
  THREE_JS_VERSIONS.forEach(async (ver) => {
    let resolve;
    let promise = new Promise((res) => {
      resolve = res;
    });
    promises.push(promise);
    let data = {
      initilized: promise,
    };
    lib[ver] = data;
    data.file = await getThree(ver);
    console.log('downloaded ' + ver);
    data.sha256 = crypto
      .createHash('sha256')
      .update(data.file)
      .digest('base64');
    console.log('sha256 ' + data.sha256);
    data.compressed = await compress.compress(data.file);
    console.log(
      `${ver} compressed ${data.file.length} -> ${data.compressed.length}`
    );
    resolve();
  });
  await Promise.all(promises);
  promises = [];
  THREE_JS_VERSIONS.forEach((v1) => {
    THREE_JS_VERSIONS.forEach(async (v2) => {
      // if (v1 == v2) return;
      let resolve;
      let promise = new Promise((res) => {
        resolve = res;
      });
      promises.push(promise);
      const compressed = await compress.compressWithDict(
        lib[v1].file,
        lib[v2].file
      );
      lib[v1][v2] = compressed;
      console.log(`data.compressed ${v1} to ${v2} ${compressed.length}`);
      resolve();
    });
  });
  await Promise.all(promises);
  console.log('done');
  compress.terminate();
}

let three_js_lib = {};
const libinitilized = initilizeLib(three_js_lib);

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/', // optional: default '/'
});

fastify.listen(
  { port: process.env.PORT, host: '0.0.0.0' },
  function (err, address) {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
    fastify.log.info(`server listening on ${address}`);
  }
);

function getMatchingVer(lib, hashes_str, ver) {
  if (hashes_str === undefined) return undefined;
  let hash_set = {};
  hashes_str.split(',').forEach((v) => {
    hash_set[v] = true;
  });
  let mached_ver = undefined;
  let mached_size = -1;
  THREE_JS_VERSIONS.forEach((v) => {
    if (hash_set['sha256/' + lib[v].sha256]) {
      if (mached_size == -1 || mached_size > lib[ver][v].length) {
        mached_size = lib[ver][v].length;
        mached_ver = v;
      }
    }
  });
  return mached_ver;
}

THREE_JS_VERSIONS.forEach((ver) => {
  fastify.get(`/three/${ver}.js`, async function (request, reply) {
    console.log('ver: ' + ver);
    reply.header('content-type', 'application/javascript; charset=utf-8');
    reply.header('Can-Be-Used-As-Dictionary', '/three/');
    await libinitilized;

    const mached_ver = getMatchingVer(
      three_js_lib,
      request.headers['shared-dictionary'],
      ver
    );
    if (mached_ver !== undefined) {
      console.log(`mached_ver ${mached_ver}`);
      reply.header(
        'shared-brotli-dictionary',
        'sha256/' + three_js_lib[mached_ver].sha256
      );
      reply.header('content-encoding', 'sbr');
      reply.header('content-length', three_js_lib[ver][mached_ver].length);
      reply.send(Buffer.from(three_js_lib[ver][mached_ver]));
    } else {
      reply.header('content-length', three_js_lib[ver].compressed.length);
      reply.header('content-encoding', 'br');
      reply.send(Buffer.from(three_js_lib[ver].compressed));
    }
  });
});
