import { d as defineEventHandler, A as ensureInboxCollections, B as ensureInboxIndexes, C as getRouterParam, c as createError } from '../../../../nitro/nitro.mjs';
import { a as processEmailAttachments } from '../../../../_/inboxProcessService.mjs';
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
import '../../../../_/documentParserService.mjs';
import '../../../../_/rawDataStorageService.mjs';
import '../../../../_/gmailApiService.mjs';
import 'googleapis';
import '../../../../_/inboxRepository.mjs';

const _emailId__post = defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections();
    await ensureInboxIndexes();
    const emailId = getRouterParam(event, "emailId");
    if (!emailId) {
      throw createError({ statusCode: 400, statusMessage: "Missing emailId" });
    }
    const data = await processEmailAttachments(emailId);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    const msg = error instanceof Error ? error.message : "Failed to process email";
    if (msg === "Email not found") {
      throw createError({ statusCode: 404, statusMessage: msg });
    }
    throw createError({ statusCode: 500, statusMessage: msg });
  }
});

export { _emailId__post as default };
//# sourceMappingURL=_emailId_.post.mjs.map
