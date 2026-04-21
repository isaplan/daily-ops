import { d as defineEventHandler, A as ensureInboxCollections, B as ensureInboxIndexes, C as getRouterParam, c as createError } from '../../../nitro/nitro.mjs';
import { g as getEmailWithAttachments } from '../../../_/inboxRepository.mjs';
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

const _id__get = defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections();
    await ensureInboxIndexes();
    const id = getRouterParam(event, "id");
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: "Missing id" });
    }
    const result = await getEmailWithAttachments(id);
    if (!result) {
      throw createError({ statusCode: 404, statusMessage: "Email not found" });
    }
    return {
      success: true,
      data: {
        ...result.email,
        attachments: result.attachments
      }
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to get email"
    });
  }
});

export { _id__get as default };
//# sourceMappingURL=_id_.get.mjs.map
