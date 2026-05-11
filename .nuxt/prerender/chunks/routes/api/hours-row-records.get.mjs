import { defineEventHandler, getQuery, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a as getDb, w as getUtcDayRange, E as EITJE_HOURS_ADD_FIELDS } from '../../nitro/nitro.mjs';
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

const hoursRowRecords_get = defineEventHandler(async (event) => {
  var _a;
  try {
    const db = await getDb();
    const query = getQuery(event);
    const dateStr = query.date;
    const locationIdParam = query.locationId;
    const endpoint = query.endpoint || "time_registration_shifts";
    if (!dateStr) {
      throw createError({ statusCode: 400, message: "date is required" });
    }
    const { dayStart, dayEnd } = getUtcDayRange(dateStr);
    const dateCondition = {
      $or: [
        { date: { $gte: dayStart, $lte: dayEnd } },
        { date: dateStr }
      ]
    };
    const match = {
      endpoint: endpoint === "planning_shifts" ? "planning_shifts" : "time_registration_shifts",
      $and: [dateCondition]
    };
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
      const locationClauses = [];
      if (locationIdObj) locationClauses.push({ locationId: locationIdObj });
      locationClauses.push({ locationId: locIdStr });
      if (eitjeIds.length) locationClauses.push({ environmentId: { $in: eitjeIds } });
      match.$and.push({ $or: locationClauses });
    } else {
      const locationNameParam = query.locationName;
      if (locationNameParam && locationNameParam !== "Unknown") {
        ;
        match.$and.push({
          $or: [
            { "extracted.locationName": locationNameParam },
            { "rawApiResponse.environment.name": locationNameParam },
            { "rawApiResponse.environment_name": locationNameParam },
            { "rawApiResponse.location_name": locationNameParam }
          ]
        });
      }
    }
    const pipeline = [
      { $match: match },
      {
        $addFields: {
          ...EITJE_HOURS_ADD_FIELDS,
          userId: {
            $ifNull: [
              "$extracted.userId",
              { $ifNull: ["$rawApiResponse.user_id", "$rawApiResponse.user.id"] }
            ]
          },
          teamId: {
            $ifNull: [
              "$extracted.teamId",
              { $ifNull: ["$rawApiResponse.team_id", "$rawApiResponse.team.id"] }
            ]
          },
          start: "$rawApiResponse.start",
          end: "$rawApiResponse.end"
        }
      },
      {
        $lookup: {
          from: "unified_user",
          let: { uid: "$userId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ["$$uid", { $ifNull: ["$eitjeIds", []] }] },
                    { $in: ["$$uid", { $ifNull: ["$allIdValues", []] }] },
                    { $eq: ["$primaryId", "$$uid"] }
                  ]
                }
              }
            },
            { $limit: 1 },
            { $project: { canonicalName: 1, primaryName: 1 } }
          ],
          as: "user"
        }
      },
      {
        $lookup: {
          from: "unified_team",
          let: { tid: "$teamId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ["$$tid", { $ifNull: ["$eitjeIds", []] }] },
                    { $in: ["$$tid", { $ifNull: ["$allIdValues", []] }] },
                    { $eq: ["$primaryId", "$$tid"] }
                  ]
                }
              }
            },
            { $limit: 1 },
            { $project: { canonicalName: 1, primaryName: 1 } }
          ],
          as: "team"
        }
      },
      {
        $project: {
          _id: 1,
          support_id: {
            $ifNull: [
              "$extracted.supportId",
              { $ifNull: ["$rawApiResponse.support_id", "$rawApiResponse.id"] }
            ]
          },
          worker_name: {
            $ifNull: [
              { $arrayElemAt: ["$user.canonicalName", 0] },
              {
                $ifNull: [
                  { $arrayElemAt: ["$user.primaryName", 0] },
                  { $ifNull: ["$rawApiResponse.user.name", "Unknown"] }
                ]
              }
            ]
          },
          team_name: {
            $ifNull: [
              { $arrayElemAt: ["$team.canonicalName", 0] },
              {
                $ifNull: [
                  { $arrayElemAt: ["$team.primaryName", 0] },
                  { $ifNull: ["$rawApiResponse.team.name", "Unknown"] }
                ]
              }
            ]
          },
          start: 1,
          end: 1,
          hours: 1
        }
      },
      { $sort: { start: 1 } }
    ];
    const records = await db.collection("eitje_raw_data").aggregate(pipeline).toArray();
    const formatted = records.map((r) => {
      var _a2, _b, _c;
      return {
        id: r._id != null ? String(r._id) : "",
        support_id: r.support_id != null ? String(r.support_id) : "",
        worker_name: (_a2 = r.worker_name) != null ? _a2 : "Unknown",
        team_name: (_b = r.team_name) != null ? _b : "Unknown",
        start: r.start ? new Date(r.start).toLocaleString(void 0, { dateStyle: "short", timeStyle: "short" }) : "-",
        end: r.end ? new Date(r.end).toLocaleString(void 0, { dateStyle: "short", timeStyle: "short" }) : "-",
        hours: Math.round(((_c = r.hours) != null ? _c : 0) * 100) / 100
      };
    });
    return { success: true, data: formatted };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("[hours-row-records]", error);
    throw createError({ statusCode: 500, message: "Failed to fetch row records" });
  }
});

export { hoursRowRecords_get as default };
//# sourceMappingURL=hours-row-records.get.mjs.map
