import { defineEventHandler, getRouterParam, createError, readBody } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a as getDb } from '../../../nitro/nitro.mjs';
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

const _id__put = defineEventHandler(async (event) => {
  var _a, _b, _c, _d, _e;
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Member not found" });
  }
  const body = await readBody(event);
  const db = await getDb();
  const update = { updated_at: /* @__PURE__ */ new Date() };
  if ((body == null ? void 0 : body.name) !== void 0) update.name = body.name.trim();
  if ((body == null ? void 0 : body.email) !== void 0) update.email = body.email.trim().toLowerCase();
  if ((body == null ? void 0 : body.slack_username) !== void 0) update.slack_username = body.slack_username.trim() || void 0;
  if ((body == null ? void 0 : body.location_id) !== void 0) {
    if (body.location_id) {
      try {
        update.location_id = new ObjectId(body.location_id);
      } catch {
        throw createError({ statusCode: 400, statusMessage: "Invalid location_id" });
      }
    } else {
      update.location_id = null;
    }
  }
  if ((body == null ? void 0 : body.team_id) !== void 0) {
    if (body.team_id) {
      try {
        update.team_id = new ObjectId(body.team_id);
      } catch {
        throw createError({ statusCode: 400, statusMessage: "Invalid team_id" });
      }
    } else {
      update.team_id = null;
    }
  }
  const result = await db.collection("members").findOneAndUpdate(
    { _id: oid },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Member not found" });
  }
  const m = result;
  const nameVal = (_e = (_d = (_c = (_b = (_a = m.name) != null ? _a : m.Name) != null ? _b : m.naam) != null ? _c : m.displayName) != null ? _d : m.full_name) != null ? _e : m.title;
  const name = typeof nameVal === "string" ? nameVal.trim() : "";
  const locationId = m.location_id;
  const teamId = m.team_id;
  let locationName;
  let teamName;
  if (locationId) {
    try {
      const loc = await db.collection("locations").findOne({ _id: new ObjectId(String(locationId)) });
      locationName = loc ? loc.name : void 0;
    } catch {
    }
  }
  if (teamId) {
    try {
      const team = await db.collection("teams").findOne({ _id: new ObjectId(String(teamId)) });
      teamName = team ? team.name : void 0;
    } catch {
    }
  }
  const data = {
    _id: String(result._id),
    name: name || `Member ${String(result._id).slice(-6)}`,
    email: (typeof m.email === "string" ? m.email : "") || "",
    slack_username: typeof m.slack_username === "string" ? m.slack_username : void 0,
    location_id: locationId ? String(locationId) : void 0,
    team_id: teamId ? String(teamId) : void 0,
    location_name: locationName,
    team_name: teamName,
    is_active: m.is_active !== false && m.isActive !== false
  };
  return { success: true, data };
});

export { _id__put as default };
//# sourceMappingURL=_id_.put.mjs.map
