const crypto = require('crypto');
const fastify = require('fastify')({
  logger: false,
});
const https = require('node:https');
const path = require('path');
const fs = require('fs').promises;
const LRU = require('lru-cache');

const is_in_glitch_demo = (process.env.PROJECT_DOMAIN == 'shared-brotli');

async function getHttps(url) {
  return new Promise((resolve, reject) => {
    const data = [];
    https
      .get(url, (res) => {
        res
          .on('data', (d) => {
            data.push(d);
          })
          .on('end', (e) => {
            resolve(Buffer.concat(data));
          });
      })
      .on('error', (e) => {
        reject(e);
      });
  });
}
async function getHttpsWithRes(url) {
  return new Promise((resolve, reject) => {
    const data = [];
    https
      .get(url, { headers: { 'accept-encoding': 'gzip,br' } }, (res) => {
        res
          .on('data', (d) => {
            data.push(d);
          })
          .on('end', (e) => {
            resolve({
              res: res,
              body: Buffer.concat(data),
            });
          });
      })
      .on('error', (e) => {
        reject(e);
      });
  });
}
console.log('__filename: ' + __filename);

const THREE_JS_VERSIONS = ['r80', 'r81'];
// const THREE_JS_VERSIONS = ['r80', 'r81', 'r82', 'r83', 'r84'];

async function initilizeLib(lib, wikipediadata, googlesearchdata) {
  // https://developers.google.com/speed/libraries
  async function getThree(version) {
    const res = await getHttps(
      `https://ajax.googleapis.com/ajax/libs/threejs/${version}/three.min.js`
    );
    return new Uint8Array(res);
  }

  const compress = require('./compress_workerpool');

  const wikipedia_dict = await fs.readFile('third_party/wikipedia/wikipedia.dict');
  wikipediadata.dict = {
    data: wikipedia_dict,
    sha256: crypto.createHash('sha256').update(wikipedia_dict).digest('base64'),
    compressed: await compress.compress(wikipedia_dict),
  };
  console.log(
    'wikipediadata.dict: ' +
        `raw: ${wikipediadata.dict.data.length} ` +
        `sha256: ${wikipediadata.dict.sha256} ` +
        `compressed: ${wikipediadata.dict.compressed.length}`
  );
  let promises = [];
  for (let i = 1; i <= 10; ++i) {
    promises.push(
      new Promise(async (resolve) => {
        const filename = ('000' + i).slice(-3) + '.html';
        const html = await fs.readFile('third_party/wikipedia/pages/' + filename);
        const filedata = {
          raw: html,
          br: await compress.compress(html),
          sbr: await compress.compressWithDict(html, wikipedia_dict),
        };
        console.log(
          `wikipedia ${filename}: ` +
              `raw: ${filedata.raw.length} ` +
              `br: ${filedata.br.length} ` +
              `sbr: ${filedata.sbr.length}`
        );
        wikipediadata[filename] = filedata;
        resolve();
      })
    );
  }

  const google_search_dict = await fs.readFile('third_party/google_search/google_search.dict');
  googlesearchdata.dict = {
    data: google_search_dict,
    sha256: crypto.createHash('sha256').update(google_search_dict).digest('base64'),
    compressed: await compress.compress(google_search_dict),
  };
  console.log(
    'googlesearchdata.dict: ' +
        `raw: ${googlesearchdata.dict.data.length} ` +
        `sha256: ${googlesearchdata.dict.sha256} ` +
        `compressed: ${googlesearchdata.dict.compressed.length}`
  );
  for (let i = 1; i <= 10; ++i) {
    promises.push(
      new Promise(async (resolve) => {
        const filename = ('000' + i).slice(-3) + '.html';
        const html = await fs.readFile('third_party/google_search/pages/' + filename);
        const filedata = {
          raw: html,
          br: await compress.compress(html),
          sbr: await compress.compressWithDict(html, google_search_dict),
        };
        console.log(
          `google search ${filename}: ` +
              `raw: ${filedata.raw.length} ` +
              `br: ${filedata.br.length} ` +
              `sbr: ${filedata.sbr.length}`
        );
        googlesearchdata[filename] = filedata;
        resolve();
      })
    );
  }

  await Promise.all(promises);

  promises = [];
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
let wikipedia_data = {};
let google_search_data = {};
const libinitilized = initilizeLib(three_js_lib, wikipedia_data, google_search_data);

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
    console.log('query: ' + JSON.stringify(request.query));
    reply.header('content-type', 'application/javascript; charset=utf-8');
    reply.header('Cache-Control', 'public');
    if (request.query['path'] != undefined) {
      reply.header('Can-Be-Used-As-Dictionary', request.query['path']);
    } else {
      reply.header('Can-Be-Used-As-Dictionary', '/three/');
    }
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

fastify.get(`/wikipedia.dict`, async function (request, reply) {
  await libinitilized;
  reply.header('Cache-Control', 'public');
  reply.header('content-type', 'binary/octet-stream');
  reply.header('Can-Be-Used-As-Dictionary', '/wikipedia/');
  reply.header('content-length', wikipedia_data.dict.compressed.length);
  reply.header('content-encoding', 'br');
  reply.send(Buffer.from(wikipedia_data.dict.compressed));
});

fastify.get(`/wikipedia.dict.br`, async function (request, reply) {
  await libinitilized;
  reply.header('Cache-Control', 'public');
  reply.header('content-type', 'binary/octet-stream');
  reply.header('content-length', wikipedia_data.dict.compressed.length);
  //  reply.header('content-encoding', 'br');
  reply.send(Buffer.from(wikipedia_data.dict.compressed));
});

fastify.get(`/wikipedia/`, async function (request, reply) {
  await libinitilized;
  reply.header('content-type', 'text/html; charset=utf-8');
  const id = request.query['id'];
  if (id == undefined) {
    reply.send('no id');
    return;
  }
  const data = wikipedia_data[request.query['id']];
  if (data == undefined) {
    reply.send('not found');
    return;
  }
  if (
    request.headers["sec-available-dictionary"] ==
    'sha256/' + wikipedia_data.dict.sha256
  ) {
    reply.header('content-length', data.br.length);
    reply.header('content-encoding', 'sbr');
    reply.header('vary', 'sec-available-dictionary');
    reply.send(Buffer.from(data.sbr));
  } else {
    reply.header('content-length', data.br.length);
    reply.header('content-encoding', 'br');
    if (is_in_glitch_demo) {
      reply.header(
        'shared-dictionary-url',
        'https://shared-brotli-dictionary.glitch.me/wikipedia.dict');
    } else {
      reply.header('shared-dictionary-url','/wikipedia.dict');
    }
    reply.send(Buffer.from(data.br));
  }
});

const wikipediaCache = new LRU({
  max: 500,
  maxSize: 100 * 1000 * 1000,
  sizeCalculation: (value, key) => {
    return value.body.length;
  },
  ttl: 1000 * 60 * 5,
});

async function proxyWikipedia(request, reply) {
  const target_url = request.url;
  let result = wikipediaCache.get(target_url);
  if (result == null) {
    result = await getHttpsWithRes(`https://en.wikipedia.org${target_url}`);
    wikipediaCache.set(target_url, result);
  } else {
  }
  const content_type = result.res.headers['content-type'];
  reply.header('content-type', content_type);

  const content_encoding = result.res.headers['content-encoding'];
  if (content_encoding != undefined) {
    reply.header('content-encoding', content_encoding);
  }
  reply.send(Buffer.from(result.body));
}

fastify.get(`/w/*`, proxyWikipedia);
fastify.get(`/static/*`, proxyWikipedia);

// Google search demo

fastify.get(`/google_search.dict`, async function (request, reply) {
  await libinitilized;
  reply.header('Cache-Control', 'public');
  reply.header('content-type', 'binary/octet-stream');
  reply.header('Can-Be-Used-As-Dictionary', '/google_search/');
  reply.header('content-length', google_search_data.dict.compressed.length);
  reply.header('content-encoding', 'br');
  reply.send(Buffer.from(google_search_data.dict.compressed));
});

fastify.get(`/google_search.dict.br`, async function (request, reply) {
  await libinitilized;
  reply.header('Cache-Control', 'public');
  reply.header('content-type', 'binary/octet-stream');
  reply.header('content-length', google_search_data.dict.compressed.length);
  //  reply.header('content-encoding', 'br');
  reply.send(Buffer.from(google_search_data.dict.compressed));
});

fastify.get(`/google_search/`, async function (request, reply) {
  await libinitilized;
  reply.header('content-type', 'text/html; charset=utf-8');
  const id = request.query['id'];
  if (id == undefined) {
    reply.send('no id');
    return;
  }
  const data = google_search_data[request.query['id']];
  if (data == undefined) {
    reply.send('not found');
    return;
  }
  if (
    request.headers["sec-available-dictionary"] ==
    'sha256/' + google_search_data.dict.sha256
  ) {
    reply.header('content-length', data.br.length);
    reply.header('content-encoding', 'sbr');
    reply.header('vary', 'sec-available-dictionary');
    reply.send(Buffer.from(data.sbr));
  } else {
    reply.header('content-length', data.br.length);
    reply.header('content-encoding', 'br');
    if (is_in_glitch_demo) {
      reply.header(
        'shared-dictionary-url',
        'https://shared-brotli-dictionary.glitch.me/google_search.dict');
    } else {
      reply.header('shared-dictionary-url','/google_search.dict');
    }
    reply.send(Buffer.from(data.br));
  }
});

const googleCache = new LRU({
  max: 500,
  maxSize: 100 * 1000 * 1000,
  sizeCalculation: (value, key) => {
    return value.body.length;
  },
  ttl: 1000 * 60 * 5,
});

async function proxyGoogle(request, reply) {
  const target_url = request.url;
  let result = googleCache.get(target_url);
  if (result == null) {
    result = await getHttpsWithRes(`https://www.google.com${target_url}`);
    googleCache.set(target_url, result);
  } else {
  }
  const content_type = result.res.headers['content-type'];
  reply.header('content-type', content_type);

  const content_encoding = result.res.headers['content-encoding'];
  if (content_encoding != undefined) {
    reply.header('content-encoding', content_encoding);
  }
  reply.send(Buffer.from(result.body));
}

fastify.get(`/images/*`, proxyGoogle);
fastify.get(`/gen_204`, proxyGoogle);
fastify.get(`/xjs/*`, proxyGoogle);
