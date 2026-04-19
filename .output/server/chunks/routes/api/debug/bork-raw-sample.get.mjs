import { d as defineEventHandler, g as getDb } from '../../../nitro/nitro.mjs';
import 'mongodb';
import 'papaparse';
import 'fs';
import 'path';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'stream';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '@iconify/utils';
import 'consola';

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
