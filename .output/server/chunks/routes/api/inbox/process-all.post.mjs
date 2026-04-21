import { d as defineEventHandler, A as ensureInboxCollections, B as ensureInboxIndexes, r as readBody, c as createError } from '../../../nitro/nitro.mjs';
import { p as processAllUnprocessed } from '../../../_/inboxProcessService.mjs';
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
import '../../../_/documentParserService.mjs';
import '../../../_/rawDataStorageService.mjs';
import '../../../_/inboxRepository.mjs';

const processAll_post = defineEventHandler(async (event) => {
  var _a;
  try {
    await ensureInboxCollections();
    await ensureInboxIndexes();
    const body = await readBody(event).catch(() => ({}));
    const maxEmails = (_a = body.maxEmails) != null ? _a : 50;
    const data = await processAllUnprocessed(maxEmails);
    return { success: true, data };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to process all emails"
    });
  }
});

export { processAll_post as default };
//# sourceMappingURL=process-all.post.mjs.map
