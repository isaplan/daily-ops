import { d as defineEventHandler, S as getNotesCollection, T as activeNotesMatch } from '../../nitro/nitro.mjs';
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

const index_get = defineEventHandler(async () => {
  const coll = await getNotesCollection();
  const tags = await coll.distinct("tags", {
    tags: { $exists: true, $ne: [] },
    ...activeNotesMatch()
  });
  const normalized = tags.filter((t) => typeof t === "string" && t.trim() !== "").map((t) => t.trim().toLowerCase());
  const unique = [...new Set(normalized)].sort((a, b) => a.localeCompare(b));
  return { success: true, data: unique };
});

export { index_get as default };
//# sourceMappingURL=index.get4.mjs.map
