import { d as defineEventHandler, A as ensureInboxCollections, B as ensureInboxIndexes, a as getQuery, c as createError } from '../../../nitro/nitro.mjs';
import { l as listEmails } from '../../../_/inboxRepository.mjs';
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

const list_get = defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections();
    await ensureInboxIndexes();
    const q = getQuery(event);
    const page = Math.max(1, parseInt(String(q.page || "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(q.limit || "20"), 10)));
    const filters = {};
    if (q.status) filters.status = q.status;
    if (q.from) filters.from = String(q.from);
    if (q.archived !== void 0) filters.archived = q.archived === "true";
    if (q.dateFrom || q.dateTo) {
      filters.dateFrom = q.dateFrom ? new Date(String(q.dateFrom)) : void 0;
      filters.dateTo = q.dateTo ? new Date(String(q.dateTo)) : void 0;
    }
    const data = await listEmails(page, limit, filters);
    return { success: true, data };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to list emails"
    });
  }
});

export { list_get as default };
//# sourceMappingURL=list.get.mjs.map
