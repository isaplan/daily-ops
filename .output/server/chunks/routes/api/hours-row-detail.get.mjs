import { d as defineEventHandler, g as getDb, a as getQuery, c as createError } from '../../nitro/nitro.mjs';
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

const hoursRowDetail_get = defineEventHandler(async (event) => {
  try {
    const db = await getDb();
    const query = getQuery(event);
    const date = query.date;
    const locationIdParam = query.locationId;
    const endpoint = query.endpoint || "time_registration_shifts";
    if (!date) {
      throw createError({ statusCode: 400, message: "date is required" });
    }
    const q = {
      period_type: "day",
      period: date
    };
    if (locationIdParam) {
      try {
        q.locationId = new ObjectId(locationIdParam);
      } catch {
        q.locationId = locationIdParam;
      }
    }
    const collectionName = endpoint === "planning_shifts" ? "eitje_planning_registration_aggregation" : "eitje_time_registration_aggregation";
    const docs = await db.collection(collectionName).find(q).sort({ user_name: 1, team_name: 1 }).toArray();
    const records = docs.map((d) => {
      var _a, _b, _c, _d, _e;
      return {
        worker_name: (_a = d.user_name) != null ? _a : "Unknown",
        team_name: (_b = d.team_name) != null ? _b : "Unknown",
        total_hours: (_c = d.total_hours) != null ? _c : 0,
        total_cost: (_d = d.total_cost) != null ? _d : 0,
        record_count: (_e = d.record_count) != null ? _e : 0
      };
    });
    return { success: true, data: records };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("[hours-row-detail]", error);
    throw createError({ statusCode: 500, message: "Failed to fetch row detail" });
  }
});

export { hoursRowDetail_get as default };
//# sourceMappingURL=hours-row-detail.get.mjs.map
