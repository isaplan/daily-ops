import { d as defineEventHandler, g as getDb, a as getQuery, c as createError, q as getUtcDayRange, E as EITJE_HOURS_ADD_FIELDS } from '../../nitro/nitro.mjs';
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
