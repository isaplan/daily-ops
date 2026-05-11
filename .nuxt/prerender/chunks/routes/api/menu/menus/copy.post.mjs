import { defineEventHandler, readBody, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a3 as getMenusCollection } from '../../../../nitro/nitro.mjs';
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

const copy_post = defineEventHandler(async (event) => {
  const body = await readBody(event);
  const copyFrom = body == null ? void 0 : body.copyFrom;
  if (!copyFrom || typeof copyFrom !== "string") {
    throw createError({ statusCode: 400, statusMessage: "copyFrom (menu id) is required" });
  }
  let sourceOid;
  try {
    sourceOid = new ObjectId(copyFrom);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Source menu not found" });
  }
  const coll = await getMenusCollection();
  const source = await coll.findOne({ _id: sourceOid });
  if (!source) {
    throw createError({ statusCode: 404, statusMessage: "Source menu not found" });
  }
  const now = /* @__PURE__ */ new Date();
  const newName = typeof (body == null ? void 0 : body.name) === "string" && body.name.trim() ? body.name.trim() : `${source.name} (copy)`;
  const doc = {
    _id: new ObjectId(),
    name: newName,
    startDate: source.startDate,
    location: source.location,
    defaultWastePercent: source.defaultWastePercent,
    defaultMarginMultiplier: source.defaultMarginMultiplier,
    defaultVatRate: source.defaultVatRate,
    copiedFromMenuId: copyFrom,
    createdAt: now,
    updatedAt: now
  };
  if (source.menuSectionsV2 && source.menuSectionsV2.length > 0) {
    doc.menuSectionsV2 = JSON.parse(JSON.stringify(source.menuSectionsV2));
  } else if (source.menuSections && source.menuSections.length > 0) {
    doc.menuSections = JSON.parse(JSON.stringify(source.menuSections));
  } else {
    doc.menuSections = [];
  }
  await coll.insertOne(doc);
  const inserted = doc;
  return {
    success: true,
    data: {
      _id: inserted._id.toString(),
      name: inserted.name,
      menuSections: inserted.menuSections,
      menuSectionsV2: inserted.menuSectionsV2,
      copiedFromMenuId: inserted.copiedFromMenuId,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt
    }
  };
});

export { copy_post as default };
//# sourceMappingURL=copy.post.mjs.map
