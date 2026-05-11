import { defineEventHandler } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a as getDb } from '../../../nitro/nitro.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ufo/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/papaparse@5.5.3/node_modules/papaparse/papaparse.js';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'node:fs';
import 'node:stream';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/destr/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/nitropack/node_modules/hookable/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ofetch/dist/node.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/node-mock-http/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/fs.mjs';
import 'node:crypto';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/fs-lite.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/lru-cache.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ohash/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/klona/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/defu/dist/defu.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/scule/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unctx/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/radix3/dist/index.mjs';
import 'node:path';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/googleapis@171.4.0/node_modules/googleapis/build/src/index.js';
import 'node:http';
import 'node:https';
import 'node:url';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/pathe/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/@iconify/utils/lib/index.js';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/consola/dist/index.mjs';
import 'node:module';

const borkRawSample_get = defineEventHandler(async () => {
  try {
    const db = await getDb();
    const count = await db.collection("bork_raw_data").countDocuments();
    if (count === 0) {
      return { error: "No documents in bork_raw_data" };
    }
    const sample = await db.collection("bork_raw_data").findOne({});
    const firstRecord = Array.isArray(sample == null ? void 0 : sample.rawApiResponse) ? sample == null ? void 0 : sample.rawApiResponse[0] : sample == null ? void 0 : sample.rawApiResponse;
    return {
      totalCount: count,
      documentStructure: {
        topLevelKeys: Object.keys(sample || {}),
        syncDedupKey: sample == null ? void 0 : sample.syncDedupKey,
        endpoint: sample == null ? void 0 : sample.endpoint,
        locationId: sample == null ? void 0 : sample.locationId,
        date: sample == null ? void 0 : sample.date,
        rawApiResponseType: Array.isArray(sample == null ? void 0 : sample.rawApiResponse) ? "ARRAY" : typeof (sample == null ? void 0 : sample.rawApiResponse),
        rawApiResponseLength: Array.isArray(sample == null ? void 0 : sample.rawApiResponse) ? sample.rawApiResponse.length : "N/A"
      },
      firstRecord: firstRecord ? {
        keys: Object.keys(firstRecord),
        sample: firstRecord
      } : null
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});

export { borkRawSample_get as default };
//# sourceMappingURL=bork-raw-sample.get.mjs.map
