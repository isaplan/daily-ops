import { defineEventHandler, getQuery, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a as getDb, J as normalizeEitjeHoursVenueName, w as getUtcDayRange, E as EITJE_HOURS_ADD_FIELDS } from '../../nitro/nitro.mjs';
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

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const hoursRowDetail_get = defineEventHandler(async (event) => {
  var _a;
  try {
    const db = await getDb();
    const query = getQuery(event);
    const date = query.date;
    const locationIdParam = query.locationId;
    const locationNameRaw = query.locationName;
    const locationNameParam = typeof locationNameRaw === "string" && locationNameRaw.trim() !== "" ? normalizeEitjeHoursVenueName(locationNameRaw) : "";
    const endpoint = query.endpoint || "time_registration_shifts";
    if (!date) {
      throw createError({ statusCode: 400, message: "date is required" });
    }
    if (endpoint === "planning_shifts") {
      const collectionName = "eitje_planning_registration_aggregation";
      const q = {
        period_type: "day",
        period: date
      };
      const orBranches = [];
      if (locationIdParam) {
        try {
          const oid = new ObjectId(locationIdParam);
          orBranches.push({ locationId: { $in: [oid, locationIdParam] } });
        } catch {
          orBranches.push({ locationId: locationIdParam });
        }
      }
      if (locationNameParam) {
        orBranches.push({
          $expr: {
            $eq: [
              {
                $toLower: {
                  $trim: {
                    input: {
                      $replaceAll: {
                        input: { $ifNull: ["$location_name", ""] },
                        find: "\xA0",
                        replacement: " "
                      }
                    }
                  }
                }
              },
              locationNameParam
            ]
          }
        });
      }
      if (orBranches.length === 1) {
        Object.assign(q, orBranches[0]);
      } else if (orBranches.length > 1) {
        q.$or = orBranches;
      } else {
        return { success: true, data: [] };
      }
      const pipeline = [
        { $match: q },
        {
          $addFields: {
            userKey: { $toString: { $ifNull: ["$userId", ""] } },
            teamKey: { $toString: { $ifNull: ["$teamId", ""] } }
          }
        },
        {
          $group: {
            _id: { userKey: "$userKey", teamKey: "$teamKey" },
            worker_name: { $first: "$user_name" },
            team_name: { $first: "$team_name" },
            total_hours: { $sum: { $ifNull: ["$total_hours", 0] } },
            total_cost: { $sum: { $ifNull: ["$total_cost", 0] } },
            record_count: { $sum: { $ifNull: ["$record_count", 0] } }
          }
        },
        {
          $project: {
            _id: 0,
            worker_name: { $ifNull: ["$worker_name", "Unknown"] },
            team_name: { $ifNull: ["$team_name", "Unknown"] },
            total_hours: { $round: ["$total_hours", 2] },
            total_cost: { $round: ["$total_cost", 2] },
            record_count: 1
          }
        },
        { $sort: { worker_name: 1, team_name: 1 } }
      ];
      const records2 = await db.collection(collectionName).aggregate(pipeline).toArray();
      return { success: true, data: records2 };
    }
    const { dayStart, dayEnd } = getUtcDayRange(date);
    const dateCondition = {
      $or: [
        { date: { $gte: dayStart, $lte: dayEnd } },
        { date }
      ]
    };
    const match = {
      endpoint: "time_registration_shifts",
      $and: [dateCondition]
    };
    const locationOr = [];
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
      locationOr.push({ $or: locationClauses });
    }
    const nameTrim = typeof locationNameRaw === "string" ? locationNameRaw.trim() : "";
    if (nameTrim && nameTrim !== "Unknown") {
      const esc = escapeRegex(nameTrim);
      locationOr.push({
        $or: [
          { "extracted.locationName": { $regex: `^${esc}$`, $options: "i" } },
          { "rawApiResponse.location_name": { $regex: `^${esc}$`, $options: "i" } },
          { "rawApiResponse.environment_name": { $regex: `^${esc}$`, $options: "i" } },
          { "rawApiResponse.environment.name": { $regex: `^${esc}$`, $options: "i" } }
        ]
      });
    }
    if (locationOr.length === 0) {
      return { success: true, data: [] };
    }
    ;
    match.$and.push(locationOr.length === 1 ? locationOr[0] : { $or: locationOr });
    const rawPipeline = [
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
          supportIdStr: {
            $toString: {
              $ifNull: [
                "$extracted.supportId",
                { $ifNull: ["$rawApiResponse.support_id", "$rawApiResponse.id"] }
              ]
            }
          },
          cost: {
            $ifNull: [
              { $divide: [{ $toDouble: "$extracted.amountInCents" }, 100] },
              {
                $ifNull: [
                  { $divide: [{ $toDouble: "$rawApiResponse.amt_in_cents" }, 100] },
                  {
                    $ifNull: [
                      { $toDouble: "$extracted.amount" },
                      { $ifNull: [{ $toDouble: "$rawApiResponse.amount" }, 0] }
                    ]
                  }
                ]
              }
            ]
          }
        }
      },
      {
        $addFields: {
          shiftDedupeKey: {
            $cond: [
              { $gt: [{ $strLenCP: { $trim: { input: "$supportIdStr" } } }, 0] },
              { $trim: { input: "$supportIdStr" } },
              { $toString: "$_id" }
            ]
          }
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
          shiftDedupeKey: 1,
          hours: 1,
          cost: 1,
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
          }
        }
      },
      { $sort: { _id: 1 } },
      {
        $group: {
          _id: "$shiftDedupeKey",
          hours: { $first: "$hours" },
          cost: { $first: "$cost" },
          worker_name: { $first: "$worker_name" },
          team_name: { $first: "$team_name" }
        }
      },
      {
        $group: {
          _id: { w: "$worker_name", t: "$team_name" },
          total_hours: { $sum: "$hours" },
          total_cost: { $sum: "$cost" },
          record_count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          worker_name: { $ifNull: ["$_id.w", "Unknown"] },
          team_name: { $ifNull: ["$_id.t", "Unknown"] },
          total_hours: { $round: ["$total_hours", 2] },
          total_cost: { $round: ["$total_cost", 2] },
          record_count: 1
        }
      },
      { $sort: { worker_name: 1, team_name: 1 } }
    ];
    const records = await db.collection("eitje_raw_data").aggregate(rawPipeline).toArray();
    return { success: true, data: records };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("[hours-row-detail]", error);
    throw createError({ statusCode: 500, message: "Failed to fetch row detail" });
  }
});

export { hoursRowDetail_get as default };
//# sourceMappingURL=hours-row-detail.get.mjs.map
