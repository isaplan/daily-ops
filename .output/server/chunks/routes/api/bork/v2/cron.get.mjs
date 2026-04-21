import { d as defineEventHandler, a as getQuery, g as getDb } from '../../../../nitro/nitro.mjs';
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

const cron_get = defineEventHandler(async (event) => {
  var _a, _b, _c, _d;
  const jobType = getQuery(event).jobType || "daily-data";
  const db = await getDb();
  const row = await db.collection("integration_cron_jobs").findOne({ source: "bork", jobType });
  return {
    success: true,
    data: row ? {
      isActive: Boolean(row.isActive),
      lastRun: row.lastRun || null,
      lastRunUTC: row.lastRunUTC || null,
      schedule: row.schedule || null,
      lastSyncAt: (_a = row.lastSyncAt) != null ? _a : null,
      lastSyncOk: (_b = row.lastSyncOk) != null ? _b : null,
      lastSyncMessage: (_c = row.lastSyncMessage) != null ? _c : null,
      lastSyncDetail: (_d = row.lastSyncDetail) != null ? _d : null
    } : null
  };
});

export { cron_get as default };
//# sourceMappingURL=cron.get.mjs.map
