import { d as defineEventHandler, g as getDb, a as getQuery } from '../../nitro/nitro.mjs';
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

const index_get = defineEventHandler(async (event) => {
  const db = await getDb();
  const query = getQuery(event);
  const filter = {
    email: { $exists: true, $ne: "" }
  };
  if (query.active === "true") {
    filter.is_active = true;
  } else if (query.active === "false") {
    filter.is_active = false;
  }
  const workers = await db.collection("members").find(filter).sort({ name: 1 }).project({
    _id: 1,
    name: 1,
    email: 1,
    contract_type: 1,
    contract_start_date: 1,
    contract_end_date: 1,
    hourly_rate: 1,
    phone: 1,
    is_active: 1,
    age: 1,
    city: 1,
    postcode: 1,
    street: 1
  }).toArray();
  const data = workers.map((w) => ({
    _id: String(w._id),
    name: w.name || "",
    email: w.email || "",
    contractType: w.contract_type || "",
    contractStartDate: w.contract_start_date ? new Date(w.contract_start_date).toISOString() : null,
    contractEndDate: w.contract_end_date ? new Date(w.contract_end_date).toISOString() : null,
    hourlyRate: w.hourly_rate || 0,
    phone: w.phone || "",
    isActive: w.is_active || false,
    age: w.age || null,
    city: w.city || "",
    postcode: w.postcode || "",
    street: w.street || ""
  }));
  return {
    success: true,
    count: data.length,
    data
  };
});

export { index_get as default };
//# sourceMappingURL=index.get7.mjs.map
