import { defineEventHandler, getRouterParam, createError, readBody } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
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

function isMenuSectionArray(v) {
  return Array.isArray(v) && v.every(
    (x) => x && typeof x.id === "string" && typeof x.name === "string" && Array.isArray(x.productIds)
  );
}
const _id__patch = defineEventHandler(async (event) => {
  var _a;
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing menu id" });
  }
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Menu not found" });
  }
  const body = await readBody(event);
  const now = /* @__PURE__ */ new Date();
  const coll = await getMenusCollection();
  const updates = { updatedAt: now };
  if ((body == null ? void 0 : body.menuSections) !== void 0) {
    if (!isMenuSectionArray(body.menuSections)) {
      throw createError({ statusCode: 400, statusMessage: "menuSections must be array of { id, name, productIds }" });
    }
    updates.menuSections = body.menuSections;
  }
  if (typeof (body == null ? void 0 : body.name) === "string") updates.name = body.name.trim();
  if ((body == null ? void 0 : body.startDate) !== void 0) updates.startDate = body.startDate ? String(body.startDate).trim() : null;
  if ((body == null ? void 0 : body.location) !== void 0) updates.location = body.location ? String(body.location).trim() : null;
  if ((body == null ? void 0 : body.defaultWastePercent) !== void 0) updates.defaultWastePercent = body.defaultWastePercent;
  if ((body == null ? void 0 : body.defaultMarginMultiplier) !== void 0) updates.defaultMarginMultiplier = body.defaultMarginMultiplier;
  if ((body == null ? void 0 : body.defaultVatRate) !== void 0) updates.defaultVatRate = body.defaultVatRate;
  const result = await coll.findOneAndUpdate(
    { _id: oid },
    { $set: updates },
    { returnDocument: "after" }
  );
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Menu not found" });
  }
  const doc = result;
  return {
    success: true,
    data: {
      _id: (_a = doc._id) == null ? void 0 : _a.toString(),
      name: doc.name,
      menuSections: doc.menuSections,
      updatedAt: doc.updatedAt
    }
  };
});

export { _id__patch as default };
//# sourceMappingURL=_id_.patch.mjs.map
