import { defineEventHandler, readBody, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a as getDb } from '../../nitro/nitro.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ufo/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/papaparse@5.5.3/node_modules/papaparse/papaparse.js';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'node:fs';
import 'node:stream';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/destr/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/nitropack/node_modules/hookable/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ofetch/dist/node.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/node-mock-http/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/fs.mjs';
import 'node:crypto';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/fs-lite.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/lru-cache.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ohash/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/klona/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/defu/dist/defu.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/scule/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unctx/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/radix3/dist/index.mjs';
import 'node:path';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/googleapis@171.4.0/node_modules/googleapis/build/src/index.js';
import 'node:http';
import 'node:https';
import 'node:url';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/pathe/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/@iconify/utils/lib/index.js';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/consola/dist/index.mjs';
import 'node:module';

const index_post = defineEventHandler(async (event) => {
  var _a, _b, _c;
  const body = await readBody(event);
  if (!((_a = body == null ? void 0 : body.name) == null ? void 0 : _a.trim())) {
    throw createError({ statusCode: 400, statusMessage: "name is required" });
  }
  const db = await getDb();
  const now = /* @__PURE__ */ new Date();
  let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    const sid = String((_b = body.support_id) != null ? _b : "").trim();
    email = sid ? `support-${sid.replace(/[^\w.-]/g, "_")}@noreply.local` : `member-${new ObjectId().toHexString()}@noreply.local`;
  }
  const doc = {
    name: body.name.trim(),
    email,
    slack_username: ((_c = body.slack_username) == null ? void 0 : _c.trim()) || void 0,
    roles: [{ role: "kitchen_staff", scope: "team", grantedAt: now }],
    is_active: true,
    created_at: now,
    updated_at: now
  };
  const sup = typeof body.support_id === "string" ? body.support_id.trim() : "";
  if (sup) {
    const existing = await db.collection("members").findOne({ support_id: sup });
    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: "A member already exists for this support_id"
      });
    }
    doc.support_id = sup;
  }
  const hr = typeof body.hourly_rate === "number" && Number.isFinite(body.hourly_rate) ? body.hourly_rate : void 0;
  if (hr !== void 0) doc.hourly_rate = hr;
  const ct = typeof body.contract_type === "string" ? body.contract_type.trim() : "";
  if (ct) doc.contract_type = ct;
  if (body.location_id) {
    try {
      doc.location_id = new ObjectId(body.location_id);
    } catch {
      doc.location_id = void 0;
    }
  }
  if (body.team_id) {
    try {
      doc.team_id = new ObjectId(body.team_id);
    } catch {
      doc.team_id = void 0;
    }
  }
  const result = await db.collection("members").insertOne(doc);
  const inserted = await db.collection("members").findOne({ _id: result.insertedId });
  const data = inserted ? {
    _id: String(inserted._id),
    name: inserted.name,
    email: inserted.email,
    slack_username: inserted.slack_username,
    location_id: inserted.location_id ? String(inserted.location_id) : void 0,
    team_id: inserted.team_id ? String(inserted.team_id) : void 0,
    support_id: typeof inserted.support_id === "string" ? inserted.support_id : void 0,
    hourly_rate: typeof inserted.hourly_rate === "number" ? inserted.hourly_rate : void 0,
    contract_type: typeof inserted.contract_type === "string" ? inserted.contract_type : void 0,
    is_active: inserted.is_active
  } : { _id: String(result.insertedId), name: doc.name, email: doc.email };
  return { success: true, data };
});

export { index_post as default };
//# sourceMappingURL=index.post2.mjs.map
