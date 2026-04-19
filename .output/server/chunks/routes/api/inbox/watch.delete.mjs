import { d as defineEventHandler, A as ensureInboxCollections, c as createError } from '../../../nitro/nitro.mjs';
import { g as gmailWatchService } from '../../../_/gmailWatchService.mjs';
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
import 'googleapis';

const watch_delete = defineEventHandler(async () => {
  try {
    await ensureInboxCollections();
    await gmailWatchService.stop();
    return { success: true, data: { message: "Gmail watch stopped successfully" } };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to stop Gmail watch"
    });
  }
});

export { watch_delete as default };
//# sourceMappingURL=watch.delete.mjs.map
