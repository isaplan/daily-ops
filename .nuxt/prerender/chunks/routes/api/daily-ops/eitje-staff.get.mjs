import { defineEventHandler, getQuery, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a as getDb } from '../../../nitro/nitro.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ufo/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
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

function normStr(s) {
  return String(s != null ? s : "").trim().toLowerCase().replace(/\s+/g, " ");
}
function ymdFromValue(v) {
  if (v == null) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}
function toNum(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function dedupeKey(doc) {
  const name = normStr(doc.employee_name);
  const loc = normStr(doc.contract_location);
  return `${name}|${loc}`;
}
const eitjeStaff_get = defineEventHandler(async (event) => {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  try {
    const query = getQuery(event);
    const skip = Math.max(0, parseInt(String((_a = query.skip) != null ? _a : "0"), 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(String((_b = query.limit) != null ? _b : "50"), 10) || 50));
    const search = normStr((_c = query.search) != null ? _c : "");
    const locationFilter = String((_d = query.location) != null ? _d : "").trim().toLowerCase();
    const db = await getDb();
    const raw = await db.collection("inbox-eitje-contracts").find({}).sort({ _id: -1 }).toArray();
    const bestByKey = /* @__PURE__ */ new Map();
    for (const doc of raw) {
      const k = dedupeKey(doc);
      if (!bestByKey.has(k)) bestByKey.set(k, []);
      bestByKey.get(k).push(doc);
    }
    const members = await db.collection("members").find({}).project({ support_id: 1, email: 1, name: 1 }).toArray();
    const bySupport = /* @__PURE__ */ new Map();
    const byEmail = /* @__PURE__ */ new Map();
    const byName = /* @__PURE__ */ new Map();
    for (const m of members) {
      const id = String(m._id);
      const sup = String((_e = m.support_id) != null ? _e : "").trim();
      if (sup) bySupport.set(sup, { id });
      const em = String((_f = m.email) != null ? _f : "").trim().toLowerCase();
      if (em && !byEmail.has(em)) byEmail.set(em, { id });
      const nm = normStr(m.name);
      if (nm && !byName.has(nm)) byName.set(nm, { id });
    }
    const rows = [];
    for (const doc of bestByKey.values()) {
      const employee_name = String((_g = doc.employee_name) != null ? _g : "").trim() || "Unknown";
      const support_id = String((_h = doc.support_id) != null ? _h : "").trim();
      const contract_type = String((_i = doc.contract_type) != null ? _i : "").trim() || "\u2014";
      const contract_location = String((_j = doc.contract_location) != null ? _j : "").trim() || "\u2014";
      const startdatum = ymdFromValue(doc.start_date);
      const einddatum = ymdFromValue(doc.end_date);
      const hourly_rate = toNum(doc.hourly_rate);
      const cost_per_hour = hourly_rate !== null ? hourly_rate * 1.36 : null;
      if (locationFilter && !normStr(contract_location).includes(locationFilter) && normStr(contract_location) !== locationFilter) {
        continue;
      }
      if (search) {
        const hay = `${normStr(employee_name)} ${normStr(contract_location)} ${support_id.toLowerCase()}`;
        if (!hay.includes(search)) continue;
      }
      let match_confidence = "none";
      let matched_member_id;
      if (support_id && bySupport.has(support_id)) {
        match_confidence = "high";
        matched_member_id = bySupport.get(support_id).id;
      } else {
        const em = String((_k = doc.email) != null ? _k : "").trim().toLowerCase();
        if (em && byEmail.has(em)) {
          match_confidence = "medium";
          matched_member_id = byEmail.get(em).id;
        } else {
          const nm = normStr(employee_name);
          if (nm && byName.has(nm)) {
            match_confidence = "medium";
            matched_member_id = byName.get(nm).id;
          }
        }
      }
      rows.push({
        support_ids: support_id ? [support_id] : [],
        employee_name,
        contract_type,
        contract_location,
        startdatum,
        einddatum,
        hourly_rate,
        cost_per_hour,
        ...matched_member_id ? { matched_member_id } : {},
        match_confidence
      });
    }
    rows.sort((a, b) => {
      const order = { none: 0, medium: 1, high: 2 };
      if (order[a.match_confidence] !== order[b.match_confidence]) {
        return order[a.match_confidence] - order[b.match_confidence];
      }
      return a.employee_name.localeCompare(b.employee_name, "nl");
    });
    const total = rows.length;
    const matched = rows.filter((r) => r.match_confidence !== "none").length;
    const unmatched = total - matched;
    const distinct_contract_locations = [
      ...new Set(rows.map((r) => r.contract_location.trim()).filter((s) => s && s !== "\u2014"))
    ].sort((a, b) => a.localeCompare(b, "nl"));
    const page = rows.slice(skip, skip + limit);
    return {
      success: true,
      data: page,
      pagination: { skip, limit, total },
      summary: {
        total_staff: total,
        matched,
        unmatched,
        distinct_contract_locations
      }
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to load Eitje staff"
    });
  }
});

export { eitjeStaff_get as default };
//# sourceMappingURL=eitje-staff.get.mjs.map
