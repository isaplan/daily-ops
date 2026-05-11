import { defineEventHandler, readMultipartFormData } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { $ as getMenuItemsCollection, a0 as parseMenuFileToRows, a1 as productGroupFromFilename, a2 as extractDumpRows } from '../../../nitro/nitro.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ufo/dist/index.mjs';
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

const MAX_FILE_SIZE = 10 * 1024 * 1024;
async function processOneFile(file, coll, now, acc) {
  const lower = file.filename.toLowerCase();
  lower.endsWith(".csv");
  lower.endsWith(".xlsx") || lower.endsWith(".xls");
  lower.endsWith(".pdf");
  let rows;
  const parseResult = await parseMenuFileToRows(file.data, file.filename);
  if (!parseResult.success) {
    acc.errors.push({ row: 0, error: `${file.filename}: ${parseResult.error}` });
    return;
  }
  rows = parseResult.rows;
  const productGroup = productGroupFromFilename(file.filename);
  const dumpRows = extractDumpRows(rows, file.filename, productGroup);
  for (const row of dumpRows) {
    try {
      const doc = {
        productGroup: row.productGroup,
        sourceFile: row.sourceFile,
        rowIndex: row.rowIndex,
        data: row.data,
        createdAt: now,
        updatedAt: now
      };
      const key = { productGroup: row.productGroup, sourceFile: row.sourceFile, rowIndex: row.rowIndex };
      const existing = await coll.findOne(key);
      if (existing) {
        await coll.updateOne(
          { _id: existing._id },
          { $set: { data: row.data, updatedAt: now } }
        );
        acc.updated++;
      } else {
        await coll.insertOne({
          ...doc,
          _id: new ObjectId()
        });
        acc.imported++;
      }
    } catch (e) {
      acc.errors.push({
        row: row.rowIndex,
        error: e instanceof Error ? e.message : "Insert/update failed"
      });
    }
  }
}
const import_post = defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event);
  if (!form || form.length === 0) {
    return { success: false, imported: 0, updated: 0, failed: 0, errors: [{ row: 0, error: "No file uploaded" }] };
  }
  const files = form.filter((f) => f.name === "file" && f.data && f.filename);
  if (files.length === 0) {
    return { success: false, imported: 0, updated: 0, failed: 0, errors: [{ row: 0, error: "Missing file or filename" }] };
  }
  for (const file of files) {
    if (file.data.length > MAX_FILE_SIZE) {
      return {
        success: false,
        imported: 0,
        updated: 0,
        failed: 0,
        errors: [{ row: 0, error: `${file.filename} too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` }]
      };
    }
  }
  const now = /* @__PURE__ */ new Date();
  const coll = await getMenuItemsCollection();
  const acc = { imported: 0, updated: 0, errors: [] };
  for (const file of files) {
    await processOneFile(file, coll, now, acc);
  }
  return {
    success: acc.errors.length === 0,
    imported: acc.imported,
    updated: acc.updated,
    failed: acc.errors.length,
    errors: acc.errors
  };
});

export { import_post as default };
//# sourceMappingURL=import.post.mjs.map
