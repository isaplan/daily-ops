import { d as defineEventHandler, r as readBody, c as createError, g as getDb } from '../../nitro/nitro.mjs';
import { ObjectId } from 'mongodb';
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

const index_post = defineEventHandler(async (event) => {
  var _a, _b, _c;
  const body = await readBody(event);
  if (!((_a = body == null ? void 0 : body.name) == null ? void 0 : _a.trim())) {
    throw createError({ statusCode: 400, statusMessage: "name is required" });
  }
  if (!((_b = body == null ? void 0 : body.email) == null ? void 0 : _b.trim())) {
    throw createError({ statusCode: 400, statusMessage: "email is required" });
  }
  const db = await getDb();
  const now = /* @__PURE__ */ new Date();
  const doc = {
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    slack_username: ((_c = body.slack_username) == null ? void 0 : _c.trim()) || void 0,
    roles: [{ role: "kitchen_staff", scope: "team", grantedAt: now }],
    is_active: true,
    created_at: now,
    updated_at: now
  };
  if (body.location_id) {
    try {
      doc.location_id = new ObjectId(body.location_id);
    } catch {
    }
  }
  if (body.team_id) {
    try {
      doc.team_id = new ObjectId(body.team_id);
    } catch {
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
    is_active: inserted.is_active
  } : { _id: String(result.insertedId), name: doc.name, email: doc.email };
  return { success: true, data };
});

export { index_post as default };
//# sourceMappingURL=index.post2.mjs.map
