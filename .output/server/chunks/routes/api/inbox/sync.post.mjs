import { d as defineEventHandler, r as readBody, c as createError } from '../../../nitro/nitro.mjs';
import { r as runInboxGmailSync } from '../../../_/inboxSyncService.mjs';
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
import '../../../_/inboxProcessService.mjs';
import '../../../_/documentParserService.mjs';
import '../../../_/rawDataStorageService.mjs';
import '../../../_/inboxRepository.mjs';

const sync_post = defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch(() => ({}));
    return await runInboxGmailSync({
      maxResults: body.maxResults,
      query: body.query
    });
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to sync emails"
    });
  }
});

export { sync_post as default };
//# sourceMappingURL=sync.post.mjs.map
