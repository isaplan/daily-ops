import { d as defineEventHandler, Z as getMenusCollection } from '../../../nitro/nitro.mjs';
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

const menus_get = defineEventHandler(async () => {
  const coll = await getMenusCollection();
  const docs = await coll.find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray();
  const data = docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { _id: _id == null ? void 0 : _id.toString(), ...rest };
  });
  return { success: true, data };
});

export { menus_get as default };
//# sourceMappingURL=menus.get.mjs.map
