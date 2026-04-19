import { d as defineEventHandler, r as readBody, c as createError, T as getMenusCollection } from '../../../../nitro/nitro.mjs';
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
