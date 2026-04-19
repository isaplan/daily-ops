import { d as defineEventHandler, g as getDb, a as getQuery, q as getUtcDayRange, E as EITJE_HOURS_ADD_FIELDS, c as createError } from '../../nitro/nitro.mjs';
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

const hoursConsistencyCheck_get = defineEventHandler(async (event) => {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
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
      {
        $group: {
          _id: { period: "$period", locationId: "$locationId" },
          location_name: { $first: "$location_name" },
          total_hours: { $sum: "$total_hours" },
          record_count: { $sum: "$record_count" }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id.period",
          location_id: "$_id.locationId",
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
    for (const row of rows) {
      const dateStr = typeof row.date === "string" ? row.date.slice(0, 10) : new Date(row.date).toISOString().slice(0, 10);
      const locationIdParam = row.location_id != null ? String(row.location_id) : void 0;
      let match;
      if (locationIdParam) {
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
        const eitjeIds = (_a = locationDoc == null ? void 0 : locationDoc.eitjeIds) != null ? _a : [];
        const { dayStart, dayEnd } = getUtcDayRange(dateStr);
        const dateCondition = { $or: [{ date: { $gte: dayStart, $lte: dayEnd } }, { date: dateStr }] };
        const locationClauses = [];
        if (locationIdObj) locationClauses.push({ locationId: locationIdObj });
        locationClauses.push({ locationId: locIdStr });
        if (eitjeIds.length) locationClauses.push({ environmentId: { $in: eitjeIds } });
        match = {
          endpoint: endpoint === "planning_shifts" ? "planning_shifts" : "time_registration_shifts",
          $and: [dateCondition, { $or: locationClauses }]
        };
      } else {
        const { dayStart, dayEnd } = getUtcDayRange(dateStr);
        match = {
          endpoint: endpoint === "planning_shifts" ? "planning_shifts" : "time_registration_shifts",
          $and: [{ $or: [{ date: { $gte: dayStart, $lte: dayEnd } }, { date: dateStr }] }]
        };
      }
      const rawSumPipeline = [
        { $match: match },
        { $addFields: EITJE_HOURS_ADD_FIELDS },
        { $group: { _id: null, raw_sum: { $sum: "$hours" }, raw_count: { $sum: 1 } } }
      ];
      const rawResult = await db.collection("eitje_raw_data").aggregate(rawSumPipeline).toArray();
      const raw_sum = (_c = (_b = rawResult[0]) == null ? void 0 : _b.raw_sum) != null ? _c : 0;
      const raw_count = (_e = (_d = rawResult[0]) == null ? void 0 : _d.raw_count) != null ? _e : 0;
      const row_total = Number((_f = row.total_hours) != null ? _f : 0);
      const diff = Math.abs(raw_sum - row_total);
      if (diff > tolerance) {
        mismatches.push({
          date: dateStr,
          location_name: (_g = row.location_name) != null ? _g : "Unknown",
          location_id: locationIdParam != null ? locationIdParam : "",
          row_total,
          raw_sum: Math.round(raw_sum * 100) / 100,
          raw_count,
          row_record_count: (_h = row.record_count) != null ? _h : 0,
          diff: Math.round(diff * 100) / 100
        });
      } else {
        ok.push({ date: dateStr, location_name: (_i = row.location_name) != null ? _i : "Unknown" });
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
      possible_causes: `When row total \u2260 sum of raw records, common causes: (1) Date/timezone: raw 'date' may be stored in local TZ so UTC day range includes different shifts. (2) Location: raw uses environmentId, aggregation uses unified locationId \u2013 mismatched eitjeIds can include/exclude different docs. (3) Duplicates: same shift stored multiple times in raw (same support_id or fallback key) so raw sum is inflated; aggregation groups by (date, location, user, team) so may count once. (4) Hours formula: break_minutes or start/end rounding differs between aggregation pipeline and raw.`
    };
  } catch (error) {
    console.error("[hours-consistency-check]", error);
    throw createError({ statusCode: 500, message: "Consistency check failed" });
  }
});

export { hoursConsistencyCheck_get as default };
//# sourceMappingURL=hours-consistency-check.get.mjs.map
