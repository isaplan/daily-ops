import { d as defineEventHandler, P as getMenuItemsCollection } from '../../../nitro/nitro.mjs';
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

const items_delete = defineEventHandler(async () => {
  const coll = await getMenuItemsCollection();
  const result = await coll.deleteMany({});
  return { success: true, deleted: result.deletedCount };
});

export { items_delete as default };
//# sourceMappingURL=items.delete.mjs.map
