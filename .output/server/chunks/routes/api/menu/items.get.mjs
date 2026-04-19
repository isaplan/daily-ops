import { d as defineEventHandler, a as getQuery, P as getMenuItemsCollection } from '../../../nitro/nitro.mjs';
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

const items_get = defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = Math.min(Math.max(0, Number(query.limit) || 50), 2e3);
  const skip = Math.max(0, Number(query.skip) || 0);
  const type = typeof query.type === "string" ? query.type : void 0;
  const subType = typeof query.subType === "string" ? query.subType : void 0;
  const coll = await getMenuItemsCollection();
  const filter = {};
  if (type) filter.type = type;
  if (subType) filter.subType = subType;
  const [items, total] = await Promise.all([
    coll.find(filter).sort({ productGroup: 1, sourceFile: 1, rowIndex: 1, sortOrder: 1, name: 1 }).skip(skip).limit(limit).toArray(),
    coll.countDocuments(filter)
  ]);
  const data = items.map((doc) => {
    const { _id, ...rest } = doc;
    return { _id: _id == null ? void 0 : _id.toString(), ...rest };
  });
  return { success: true, data, total };
});

export { items_get as default };
//# sourceMappingURL=items.get.mjs.map
