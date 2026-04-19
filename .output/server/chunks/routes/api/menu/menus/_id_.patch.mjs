import { d as defineEventHandler, C as getRouterParam, c as createError, r as readBody, T as getMenusCollection } from '../../../../nitro/nitro.mjs';
import { ObjectId } from 'mongodb';
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
