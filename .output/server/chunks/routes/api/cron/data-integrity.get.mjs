import { d as defineEventHandler, a as getQuery } from '../../../nitro/nitro.mjs';
import { r as runAndFix } from '../../../_/dataIntegrityService.mjs';
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

const dataIntegrity_get = defineEventHandler(async (event) => {
  const q = getQuery(event);
  const result = await runAndFix({
    startDate: q.startDate,
    endDate: q.endDate,
    rawOnly: q.rawOnly === "1" || q.rawOnly === "true"
  });
  return { success: true, ...result };
});

export { dataIntegrity_get as default };
//# sourceMappingURL=data-integrity.get.mjs.map
