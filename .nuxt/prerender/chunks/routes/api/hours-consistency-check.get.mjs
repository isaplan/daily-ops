import { defineEventHandler, getQuery, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a as getDb, F as EITJE_AGG_ADD_VENUE_KEY, w as getUtcDayRange, G as EITJE_LABOR_SHIFT_START_FIELD, E as EITJE_HOURS_ADD_FIELDS, H as EITJE_LABOR_PERIOD_FROM_SHIFT_START_FIELD } from '../../nitro/nitro.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
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

function padUtcRange(dayStart, dayEnd, padDays) {
  const lo = new Date(dayStart);
  lo.setUTCDate(lo.getUTCDate() - padDays);
  const hi = new Date(dayEnd);
  hi.setUTCDate(hi.getUTCDate() + padDays);
  return { lo, hi };
}
const hoursConsistencyCheck_get = defineEventHandler(async (event) => {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  try {
    const db = await getDb();
    const query = getQuery(event);
    const startDate = query.startDate || "2025-01-01";
    const endDate = query.endDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const endpoint = query.endpoint || "time_registration_shifts";
    const tolerance = 0.02;
    const aggQuery = {
      period_type: "day",
      period: { $gte: startDate, $lte: endDate }
    };
    const aggPipeline = [
      { $match: aggQuery },
      EITJE_AGG_ADD_VENUE_KEY,
      {
        $group: {
          _id: { period: "$period", venueKey: "$venueKey" },
          location_name: { $max: "$location_name" },
          total_hours: { $sum: "$total_hours" },
          record_count: { $sum: "$record_count" }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id.period",
          location_id: { $toString: "$_id.venueKey" },
          location_name: { $ifNull: ["$location_name", "Unknown"] },
          total_hours: 1,
          record_count: 1
        }
      }
    ];
    const collectionName = endpoint === "planning_shifts" ? "eitje_planning_registration_aggregation" : "eitje_time_registration_aggregation";
    const rows = await db.collection(collectionName).aggregate(aggPipeline).toArray();
    const mismatches = [];
    const ok = [];
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const endpointName = endpoint === "planning_shifts" ? "planning_shifts" : "time_registration_shifts";
    for (const row of rows) {
      const dateStr = typeof row.date === "string" ? row.date.slice(0, 10) : new Date(row.date).toISOString().slice(0, 10);
      const locationIdParam = row.location_id != null ? String(row.location_id) : void 0;
      const isHexObjectId = Boolean(locationIdParam && /^[a-f0-9]{24}$/i.test(locationIdParam));
      const venueLabel = (_a = row.location_name) != null ? _a : "Unknown";
      let match;
      const { dayStart, dayEnd } = getUtcDayRange(dateStr);
      const { lo, hi } = padUtcRange(dayStart, dayEnd, 2);
      const dateCondition = { date: { $gte: lo, $lte: hi } };
      if (isHexObjectId && locationIdParam) {
        let locationIdObj = null;
        try {
          locationIdObj = new ObjectId(locationIdParam);
        } catch {
        }
        const locIdStr = String(locationIdParam);
        const locationDoc = await db.collection("unified_location").findOne({
          $or: [
            ...locationIdObj ? [{ primaryId: locationIdObj }] : [],
            { allIdValues: locationIdObj },
            { allIdValues: locIdStr },
            { eitjeIds: locationIdParam }
          ].filter(Boolean)
        });
        const eitjeIds = (_b = locationDoc == null ? void 0 : locationDoc.eitjeIds) != null ? _b : [];
        const locationClauses = [];
        if (locationIdObj) locationClauses.push({ locationId: locationIdObj });
        locationClauses.push({ locationId: locIdStr });
        if (eitjeIds.length) locationClauses.push({ environmentId: { $in: eitjeIds } });
        match = {
          endpoint: endpointName,
          $and: [dateCondition, { $or: locationClauses }]
        };
      } else if (venueLabel && venueLabel !== "Unknown") {
        const esc = escapeRegex(venueLabel.trim());
        match = {
          endpoint: endpointName,
          $and: [
            dateCondition,
            {
              $or: [
                { "extracted.locationName": { $regex: `^${esc}$`, $options: "i" } },
                { "rawApiResponse.location_name": { $regex: `^${esc}$`, $options: "i" } },
                { "rawApiResponse.environment_name": { $regex: `^${esc}$`, $options: "i" } },
                { "rawApiResponse.environment.name": { $regex: `^${esc}$`, $options: "i" } }
              ]
            }
          ]
        };
      } else {
        match = {
          endpoint: endpointName,
          $and: [dateCondition]
        };
      }
      const rawSumPipeline = [
        { $match: match },
        { $addFields: { ...EITJE_HOURS_ADD_FIELDS, ...EITJE_LABOR_SHIFT_START_FIELD } },
        { $addFields: EITJE_LABOR_PERIOD_FROM_SHIFT_START_FIELD },
        { $match: { period: dateStr } },
        { $group: { _id: null, raw_sum: { $sum: "$hours" }, raw_count: { $sum: 1 } } }
      ];
      const rawResult = await db.collection("eitje_raw_data").aggregate(rawSumPipeline).toArray();
      const raw_sum = (_d = (_c = rawResult[0]) == null ? void 0 : _c.raw_sum) != null ? _d : 0;
      const raw_count = (_f = (_e = rawResult[0]) == null ? void 0 : _e.raw_count) != null ? _f : 0;
      const row_total = Number((_g = row.total_hours) != null ? _g : 0);
      const diff = Math.abs(raw_sum - row_total);
      if (diff > tolerance) {
        mismatches.push({
          date: dateStr,
          location_name: (_h = row.location_name) != null ? _h : "Unknown",
          location_id: locationIdParam != null ? locationIdParam : "",
          row_total,
          raw_sum: Math.round(raw_sum * 100) / 100,
          raw_count,
          row_record_count: (_i = row.record_count) != null ? _i : 0,
          diff: Math.round(diff * 100) / 100
        });
      } else {
        ok.push({ date: dateStr, location_name: (_j = row.location_name) != null ? _j : "Unknown" });
      }
    }
    return {
      success: true,
      summary: {
        total_rows: rows.length,
        ok_count: ok.length,
        mismatch_count: mismatches.length
      },
      mismatches,
      possible_causes: `When row total \u2260 sum of raw records, common causes: (1) Labor period is Amsterdam calendar date of shift ISO start; padded raw window must include those docs. (2) Location: raw uses environmentId, aggregation uses unified locationId \u2013 mismatched eitjeIds. (3) Duplicates in raw vs grouped aggregation buckets. (4) Hours formula: break_minutes or start/end rounding.`
    };
  } catch (error) {
    console.error("[hours-consistency-check]", error);
    throw createError({ statusCode: 500, message: "Consistency check failed" });
  }
});

export { hoursConsistencyCheck_get as default };
//# sourceMappingURL=hours-consistency-check.get.mjs.map
