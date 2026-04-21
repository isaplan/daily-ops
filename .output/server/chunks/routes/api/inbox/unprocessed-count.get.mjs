import { d as defineEventHandler, A as ensureInboxCollections } from '../../../nitro/nitro.mjs';
import { k as countUnprocessedAttachments } from '../../../_/inboxRepository.mjs';
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

const unprocessedCount_get = defineEventHandler(async () => {
  await ensureInboxCollections();
  const count = await countUnprocessedAttachments();
  return { success: true, data: { count } };
});

export { unprocessedCount_get as default };
//# sourceMappingURL=unprocessed-count.get.mjs.map
