import { d as defineEventHandler, C as getRouterParam, c as createError, W as getMenuVersionsCollection } from '../../../../../nitro/nitro.mjs';
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

const index_get = defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing menu id" });
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Menu not found" });
  }
  const coll = await getMenuVersionsCollection();
  const list = await coll.find({ menuId: id }).sort({ savedAt: -1 }).limit(50).project({ _id: 1, savedAt: 1 }).toArray();
  const data = list.map((d) => {
    var _a;
    return {
      _id: (_a = d._id) == null ? void 0 : _a.toString(),
      savedAt: d.savedAt
    };
  });
  return { success: true, data };
});

export { index_get as default };
//# sourceMappingURL=index.get.mjs.map
