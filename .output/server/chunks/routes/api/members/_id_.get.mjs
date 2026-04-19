import { d as defineEventHandler, C as getRouterParam, c as createError, g as getDb, M as fetchMemberEitjePlaces } from '../../../nitro/nitro.mjs';
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

const _id__get = defineEventHandler(async (event) => {
  var _a, _b, _c, _d, _e;
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Member not found" });
  }
  const db = await getDb();
  const member = await db.collection("members").findOne({
    _id: oid
  });
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: "Member not found" });
  }
  const m = member;
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
  const supportIdStr = typeof m.support_id === "string" ? m.support_id : void 0;
  const eitje_places = await fetchMemberEitjePlaces(db, {
    supportId: supportIdStr,
    userName: name,
    monthsBack: 36
  });
  const merged = eitje_places.merged;
  const eitje_totals = {
    worked_hours: merged.reduce((s, r) => s + r.worked_hours, 0),
    planned_hours: merged.reduce((s, r) => s + r.planned_hours, 0),
    places_count: merged.length
  };
  const data = {
    _id: String(member._id),
    name: name || `Member ${String(member._id).slice(-6)}`,
    email: (typeof m.email === "string" ? m.email : "") || "",
    slack_username: typeof m.slack_username === "string" ? m.slack_username : void 0,
    location_id: locationId ? String(locationId) : void 0,
    team_id: teamId ? String(teamId) : void 0,
    location_name: locationName,
    team_name: teamName,
    is_active: m.is_active !== false && m.isActive !== false,
    // Worker data fields
    contract_type: typeof m.contract_type === "string" ? m.contract_type : void 0,
    contract_start_date: m.contract_start_date ? new Date(m.contract_start_date).toISOString() : void 0,
    contract_end_date: m.contract_end_date ? new Date(m.contract_end_date).toISOString() : void 0,
    hourly_rate: typeof m.hourly_rate === "number" ? m.hourly_rate : void 0,
    weekly_hours: typeof m.weekly_hours === "number" ? m.weekly_hours : void 0,
    monthly_hours: typeof m.monthly_hours === "number" ? m.monthly_hours : void 0,
    phone: typeof m.phone === "string" ? m.phone : void 0,
    age: typeof m.age === "number" ? m.age : void 0,
    birthday: typeof m.birthday === "string" ? m.birthday : void 0,
    postcode: typeof m.postcode === "string" ? m.postcode : void 0,
    city: typeof m.city === "string" ? m.city : void 0,
    street: typeof m.street === "string" ? m.street : void 0,
    nmbrs_id: typeof m.nmbrs_id === "string" ? m.nmbrs_id : void 0,
    support_id: typeof m.support_id === "string" ? m.support_id : void 0,
    eitje_places: {
      months_back: eitje_places.months_back,
      range_start: eitje_places.range_start,
      range_end: eitje_places.range_end,
      merged: eitje_places.merged,
      data_source: eitje_places.source
    },
    eitje_totals
  };
  return { success: true, data };
});

export { _id__get as default };
//# sourceMappingURL=_id_.get.mjs.map
