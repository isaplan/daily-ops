import { defineEventHandler, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a as getDb } from '../../../../nitro/nitro.mjs';
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

const asPrintable = (value) => {
  if (value === null || value === void 0) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
const flattenFields = (value, prefix = "", out = []) => {
  for (const [key, raw] of Object.entries(value)) {
    if (key.startsWith("_")) continue;
    const fieldName = prefix ? `${prefix}.${key}` : key;
    if (raw === null || raw === void 0 || typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" || raw instanceof Date) {
      out.push({ field: fieldName, sampleValue: asPrintable(raw) });
      continue;
    }
    if (Array.isArray(raw)) {
      out.push({ field: fieldName, sampleValue: asPrintable(raw[0]) });
      continue;
    }
    if (typeof raw === "object") {
      flattenFields(raw, fieldName, out);
    }
  }
  return out;
};
const rawSample_get = defineEventHandler(async (event) => {
  var _a;
  const dataSource = (((_a = event.context.params) == null ? void 0 : _a.datasource) || "").toLowerCase();
  if (dataSource !== "eitje" && dataSource !== "bork") {
    throw createError({ statusCode: 400, statusMessage: "Invalid datasource" });
  }
  const db = await getDb();
  const collectionName = dataSource === "eitje" ? "eitje_raw_data" : "bork_raw_data";
  const sample = await db.collection(collectionName).find({}).sort({ _id: -1 }).limit(1).next();
  const fields = sample ? flattenFields(sample).slice(0, 80) : [];
  return { success: true, fields };
});

export { rawSample_get as default };
//# sourceMappingURL=raw-sample.get.mjs.map
