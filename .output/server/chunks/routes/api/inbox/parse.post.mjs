import { d as defineEventHandler, D as readMultipartFormData } from '../../../nitro/nitro.mjs';
import { Buffer } from 'node:buffer';
import { d as documentParserService } from '../../../_/documentParserService.mjs';
import 'mongodb';
import 'papaparse';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'fs';
import 'stream';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'path';
import 'googleapis';
import 'node:url';
import '@iconify/utils';
import 'consola';
import 'node:module';

const MAX = 10 * 1024 * 1024;
const parse_post = defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event);
  const file = form == null ? void 0 : form.find((f) => f.name === "file" && f.data && f.filename);
  if (!(file == null ? void 0 : file.data) || !file.filename) {
    return { success: false, error: "No file provided" };
  }
  if (file.data.length > MAX) {
    return { success: false, error: "File size exceeds 10MB limit" };
  }
  const buffer = Buffer.from(file.data);
  const mime = file.type || "application/octet-stream";
  const parseResult = await documentParserService.parseDocument({
    fileName: file.filename,
    mimeType: mime,
    data: mime.includes("csv") || file.filename.toLowerCase().endsWith(".csv") ? buffer.toString("utf-8") : buffer,
    autoDetectType: true
  });
  return { success: parseResult.success, data: parseResult };
});

export { parse_post as default };
//# sourceMappingURL=parse.post.mjs.map
