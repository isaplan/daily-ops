import { d as defineEventHandler, c as createError, g as getDb } from '../../../../nitro/nitro.mjs';
import 'mongodb';
import 'papaparse';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'fs';
import 'stream';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'path';
import 'googleapis';
import 'node:url';
import '@iconify/utils';
import 'consola';
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
