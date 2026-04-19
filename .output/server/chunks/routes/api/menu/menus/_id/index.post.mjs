import { d as defineEventHandler, C as getRouterParam, c as createError, T as getMenusCollection, W as getMenuVersionsCollection } from '../../../../../nitro/nitro.mjs';
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

const index_post = defineEventHandler(async (event) => {
  var _a, _b;
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing menu id" });
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Menu not found" });
  }
  const menusColl = await getMenusCollection();
  const menu = await menusColl.findOne({ _id: oid });
  if (!menu) throw createError({ statusCode: 404, statusMessage: "Menu not found" });
  const snapshot = {};
  if ((_a = menu.menuSectionsV2) == null ? void 0 : _a.length) snapshot.menuSectionsV2 = JSON.parse(JSON.stringify(menu.menuSectionsV2));
  else if ((_b = menu.menuSections) == null ? void 0 : _b.length) snapshot.menuSections = JSON.parse(JSON.stringify(menu.menuSections));
  const versionsColl = await getMenuVersionsCollection();
  const doc = {
    _id: new ObjectId(),
    menuId: id,
    savedAt: (/* @__PURE__ */ new Date()).toISOString(),
    snapshot
  };
  await versionsColl.insertOne(doc);
  return {
    success: true,
    data: { _id: doc._id.toString(), savedAt: doc.savedAt }
  };
});

export { index_post as default };
//# sourceMappingURL=index.post.mjs.map
