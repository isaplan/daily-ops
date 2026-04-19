import { d as defineEventHandler, g as getDb } from '../../../nitro/nitro.mjs';
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

const active_get = defineEventHandler(async () => {
  const db = await getDb();
  const activeWorkers = await db.collection("members").find({
    is_active: true,
    email: { $exists: true, $ne: "" }
  }).sort({ name: 1 }).project({
    _id: 1,
    name: 1,
    email: 1,
    contract_type: 1,
    contract_start_date: 1,
    contract_end_date: 1,
    hourly_rate: 1,
    phone: 1
  }).toArray();
  const data = activeWorkers.map((w) => ({
    _id: String(w._id),
    name: w.name || "",
    email: w.email || "",
    contractType: w.contract_type || "",
    contractStartDate: w.contract_start_date ? new Date(w.contract_start_date).toISOString() : null,
    contractEndDate: w.contract_end_date ? new Date(w.contract_end_date).toISOString() : null,
    hourlyRate: w.hourly_rate || 0,
    phone: w.phone || ""
  }));
  return {
    success: true,
    count: data.length,
    data
  };
});

export { active_get as default };
//# sourceMappingURL=active.get.mjs.map
