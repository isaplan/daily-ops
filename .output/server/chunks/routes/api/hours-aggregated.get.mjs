import { d as defineEventHandler, g as getDb, a as getQuery, E as EITJE_HOURS_ADD_FIELDS, c as createError } from '../../nitro/nitro.mjs';
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

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;
function parseHoursPage(query) {
  var _a, _b;
  const page = Math.max(1, parseInt(String((_a = query.page) != null ? _a : "1"), 10) || 1);
  const rawSize = parseInt(String((_b = query.pageSize) != null ? _b : String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
function normalizeHoursDateRange(startDate, endDate) {
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const thirtyBack = /* @__PURE__ */ new Date();
  thirtyBack.setDate(thirtyBack.getDate() - 30);
  const thirtyStr = thirtyBack.toISOString().split("T")[0];
  if (!startDate && !endDate) return { start: thirtyStr, end: todayStr };
  if (startDate && !endDate) return { start: startDate, end: todayStr };
  if (!startDate && endDate) {
    const e = new Date(endDate);
    const s = new Date(e);
    s.setDate(s.getDate() - 30);
    return { start: s.toISOString().split("T")[0], end: endDate };
  }
  return { start: startDate, end: endDate };
}
async function sumHoursBaseMatch(db, collectionName, q) {
  var _a, _b, _c;
  const [row] = await db.collection(collectionName).aggregate([
    { $match: q },
    {
      $group: {
        _id: null,
        total_hours: { $sum: { $ifNull: ["$total_hours", 0] } },
        total_cost: { $sum: { $ifNull: ["$total_cost", 0] } },
        record_count: { $sum: { $ifNull: ["$record_count", 0] } }
      }
    }
  ]).toArray();
  const r = row;
  return {
    total_hours: (_a = r == null ? void 0 : r.total_hours) != null ? _a : 0,
    total_cost: (_b = r == null ? void 0 : r.total_cost) != null ? _b : 0,
    record_count: (_c = r == null ? void 0 : r.record_count) != null ? _c : 0
  };
}
const hoursAggregated_get = defineEventHandler(async (event) => {
  var _a, _b, _c;
  try {
    const db = await getDb();
    const query = getQuery(event);
    const { page, pageSize, skip } = parseHoursPage(query);
    const startDate = query.startDate;
    const endDate = query.endDate;
    const { start: rangeStart, end: rangeEnd } = normalizeHoursDateRange(startDate, endDate);
    const locationId = query.locationId;
    const endpoint = query.endpoint || "time_registration_shifts";
    const groupBy = query.groupBy || "day";
    const source = query.source;
    const sortBy = query.sortBy || "date";
    const sortOrder = query.sortOrder || "desc";
    const includeLocations = query.includeLocations !== "false" && query.includeLocations !== "0";
    const emptyPaginated = (locations2) => ({
      success: true,
      data: [],
      pagination: { page, pageSize, totalCount: 0 },
      totals: { total_hours: 0, total_cost: 0, record_count: 0 },
      summary: { total_records: 0, group_by: groupBy },
      locations: locations2
    });
    if (groupBy === "worker" && source === "contracts") {
      const contractDocs = await db.collection("test-eitje-contracts").find({}).toArray();
      const allRows = contractDocs.filter((d) => {
        var _a2;
        return ((_a2 = d.total_worked_hours) != null ? _a2 : 0) > 0;
      }).map(
        (d) => {
          var _a2, _b2, _c2, _d, _e, _f, _g, _h;
          return {
            worker_id: (_a2 = d.support_id) != null ? _a2 : "",
            worker_name: (_b2 = d.employee_name) != null ? _b2 : "Unknown",
            total_hours: (_c2 = d.total_worked_hours) != null ? _c2 : 0,
            total_cost: Math.round(((_d = d.total_worked_hours) != null ? _d : 0) * ((_e = d.hourly_rate) != null ? _e : 0) * 100) / 100,
            record_count: (_f = d.total_worked_days) != null ? _f : 0,
            location_count: d.contract_location ? 1 : 0,
            hourly_rate: (_g = d.hourly_rate) != null ? _g : 0,
            contract_type: (_h = d.contract_type) != null ? _h : "-",
            team_name: "-"
          };
        }
      );
      const sortField2 = sortBy === "total_cost" ? "total_cost" : sortBy === "worker_name" ? "worker_name" : "total_hours";
      const dir = sortOrder === "asc" ? 1 : -1;
      allRows.sort(
        (a, b) => {
          const va = sortField2 === "worker_name" ? a.worker_name : sortField2 === "total_cost" ? a.total_cost : a.total_hours;
          const vb = sortField2 === "worker_name" ? b.worker_name : sortField2 === "total_cost" ? b.total_cost : b.total_hours;
          return dir * (va < vb ? -1 : va > vb ? 1 : 0);
        }
      );
      const totalCount2 = allRows.length;
      const totals2 = allRows.reduce(
        (acc, r) => ({
          total_hours: acc.total_hours + r.total_hours,
          total_cost: acc.total_cost + r.total_cost,
          record_count: acc.record_count + r.record_count
        }),
        { total_hours: 0, total_cost: 0, record_count: 0 }
      );
      const data = allRows.slice(skip, skip + pageSize);
      let locations2 = [];
      if (includeLocations) {
        const locs = await db.collection("locations").find({}, { projection: { name: 1 } }).sort({ name: 1 }).toArray();
        locations2 = locs.map((l) => ({ _id: String(l._id), name: l.name }));
      }
      return {
        success: true,
        data,
        pagination: { page, pageSize, totalCount: totalCount2 },
        totals: totals2,
        summary: { total_records: totalCount2, group_by: "worker", source: "contracts" },
        locations: locations2
      };
    }
    const q = {
      period_type: "day",
      period: { $gte: rangeStart, $lte: rangeEnd }
    };
    if (locationId && locationId !== "all") {
      try {
        q.locationId = new ObjectId(locationId);
      } catch {
        q.locationId = locationId;
      }
    }
    let aggregation = [{ $match: q }];
    if (groupBy === "day") {
      aggregation.push({
        $group: {
          _id: "$period",
          total_hours: { $sum: "$total_hours" },
          total_cost: { $sum: "$total_cost" },
          record_count: { $sum: "$record_count" },
          location_count: { $sum: 1 }
        }
      });
      aggregation.push({
        $project: {
          _id: 0,
          date: "$_id",
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          location_count: 1
        }
      });
    } else if (groupBy === "team") {
      aggregation.push({
        $group: {
          _id: { teamId: "$teamId", team_name: "$team_name" },
          total_hours: { $sum: "$total_hours" },
          total_cost: { $sum: "$total_cost" },
          record_count: { $sum: "$record_count" },
          location_count: { $addToSet: "$locationId" },
          worker_count: { $addToSet: "$userId" }
        }
      });
      aggregation.push({
        $project: {
          _id: 0,
          team_id: "$_id.teamId",
          team_name: { $ifNull: ["$_id.team_name", "Unknown"] },
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          location_count: { $size: { $filter: { input: "$location_count", as: "l", cond: { $ne: ["$$l", null] } } } },
          worker_count: { $size: { $filter: { input: "$worker_count", as: "w", cond: { $ne: ["$$w", null] } } } }
        }
      });
    } else if (groupBy === "worker") {
      aggregation.push({
        $group: {
          _id: { userId: "$userId", user_name: "$user_name" },
          total_hours: { $sum: "$total_hours" },
          total_cost: { $sum: "$total_cost" },
          record_count: { $sum: "$record_count" },
          location_count: { $addToSet: "$locationId" },
          team_names: { $addToSet: "$team_name" },
          hourly_rate: { $first: "$hourly_rate" },
          contract_type: { $first: "$contract_type" }
        }
      });
      aggregation.push({
        $project: {
          _id: 0,
          worker_id: "$_id.userId",
          worker_name: { $ifNull: ["$_id.user_name", "Unknown"] },
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          location_count: { $size: { $filter: { input: "$location_count", as: "l", cond: { $ne: ["$$l", null] } } } },
          team_name: {
            $cond: [
              {
                $eq: [
                  {
                    $size: {
                      $filter: {
                        input: "$team_names",
                        as: "t",
                        cond: { $and: [{ $ne: ["$$t", null] }, { $ne: ["$$t", "Unknown"] }] }
                      }
                    }
                  },
                  1
                ]
              },
              {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$team_names",
                      as: "t",
                      cond: { $and: [{ $ne: ["$$t", null] }, { $ne: ["$$t", "Unknown"] }] }
                    }
                  },
                  0
                ]
              },
              {
                $concat: [
                  {
                    $toString: {
                      $size: {
                        $filter: {
                          input: "$team_names",
                          as: "t",
                          cond: { $and: [{ $ne: ["$$t", null] }, { $ne: ["$$t", "Unknown"] }] }
                        }
                      }
                    }
                  },
                  " teams"
                ]
              }
            ]
          },
          hourly_rate: { $ifNull: ["$hourly_rate", 0] },
          contract_type: { $ifNull: ["$contract_type", "-"] }
        }
      });
    } else if (groupBy === "location") {
      aggregation.push({
        $group: {
          _id: { $ifNull: ["$locationId", "$environmentId"] },
          total_hours: { $sum: "$total_hours" },
          total_cost: { $sum: "$total_cost" },
          record_count: { $sum: "$record_count" },
          worker_count: { $addToSet: "$userId" },
          location_name: { $first: "$location_name" }
        }
      });
      aggregation.push({
        $project: {
          _id: 0,
          location_id: "$_id",
          location_name: { $ifNull: ["$location_name", "Unknown"] },
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          worker_count: { $size: { $filter: { input: "$worker_count", as: "w", cond: { $ne: ["$$w", null] } } } }
        }
      });
    } else if (groupBy === "worker_location_team") {
      const workerId = query.workerId;
      if (!workerId) {
        let locations2 = [];
        if (includeLocations) {
          const locs = await db.collection("locations").find({}, { projection: { name: 1 } }).sort({ name: 1 }).toArray();
          locations2 = locs.map((l) => ({ _id: String(l._id), name: l.name }));
        }
        return emptyPaginated(locations2);
      }
      let userIdMatch;
      const numId = Number(workerId);
      if (!isNaN(numId) && numId.toString() === workerId.toString()) {
        userIdMatch = numId;
      } else {
        try {
          userIdMatch = new ObjectId(workerId);
        } catch {
          userIdMatch = workerId;
        }
      }
      aggregation = [
        {
          $match: {
            ...q,
            userId: userIdMatch,
            locationId: { $exists: true, $ne: null },
            teamId: { $exists: true, $ne: null },
            team_name: { $exists: true, $nin: [null, "Unknown"] },
            location_name: { $exists: true, $nin: [null, "Unknown"] }
          }
        },
        {
          $group: {
            _id: {
              locationId: "$locationId",
              location_name: "$location_name",
              teamId: "$teamId",
              team_name: "$team_name"
            },
            total_hours: { $sum: "$total_hours" },
            total_cost: { $sum: "$total_cost" },
            record_count: { $sum: "$record_count" },
            hourly_rate: { $first: "$hourly_rate" }
          }
        },
        {
          $project: {
            _id: 0,
            location_name: "$_id.location_name",
            team_name: "$_id.team_name",
            total_hours: 1,
            total_cost: 1,
            record_count: 1,
            hourly_rate: { $ifNull: ["$hourly_rate", 0] }
          }
        },
        { $sort: { location_name: 1, team_name: 1 } }
      ];
    } else {
      aggregation.push({
        $group: {
          _id: { period: "$period", locationId: "$locationId" },
          location_name: { $first: "$location_name" },
          total_hours: { $sum: "$total_hours" },
          total_cost: { $sum: "$total_cost" },
          record_count: { $sum: "$record_count" }
        }
      });
      aggregation.push({
        $project: {
          _id: 0,
          date: "$_id.period",
          location_id: "$_id.locationId",
          location_name: { $ifNull: ["$location_name", "Unknown"] },
          total_hours: 1,
          total_cost: 1,
          record_count: 1
        }
      });
    }
    const sortField = sortBy === "location" || sortBy === "location_name" ? "location_name" : sortBy === "team_name" ? "team_name" : sortBy === "worker_name" ? "worker_name" : sortBy === "total_hours" ? "total_hours" : sortBy === "total_cost" ? "total_cost" : "date";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    if (groupBy !== "worker_location_team") {
      aggregation.push({ $sort: { [sortField]: sortDirection } });
    }
    aggregation.push({
      $facet: {
        total: [{ $count: "count" }],
        data: [{ $skip: skip }, { $limit: pageSize }]
      }
    });
    const collectionName = endpoint === "planning_shifts" ? "eitje_planning_registration_aggregation" : "eitje_time_registration_aggregation";
    const [aggOut, totals] = await Promise.all([
      db.collection(collectionName).aggregate(aggregation).toArray(),
      sumHoursBaseMatch(db, collectionName, q)
    ]);
    const facet = aggOut[0];
    let results = (_a = facet == null ? void 0 : facet.data) != null ? _a : [];
    let totalCount = (_c = (_b = facet == null ? void 0 : facet.total[0]) == null ? void 0 : _b.count) != null ? _c : 0;
    let totalsOut = totals;
    if (totalCount === 0 && endpoint === "time_registration_shifts" && (groupBy === "day" || groupBy === "date_location" || !["day", "team", "worker", "location", "worker_location_team"].includes(groupBy))) {
      try {
        const rawMatch = { endpoint: "time_registration_shifts" };
        const endD = new Date(rangeEnd);
        endD.setHours(23, 59, 59, 999);
        rawMatch.date = { $gte: new Date(rangeStart), $lte: endD, $exists: true, $ne: null };
        if (locationId && locationId !== "all") {
          try {
            rawMatch.locationId = new ObjectId(locationId);
          } catch {
            rawMatch.locationId = locationId;
          }
        }
        if (groupBy === "day") {
          const rawPipeline = [
            { $match: rawMatch },
            {
              $addFields: {
                period: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$date" } } },
                ...EITJE_HOURS_ADD_FIELDS,
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
              $group: {
                _id: "$period",
                total_hours: { $sum: "$hours" },
                total_cost: { $sum: "$cost" },
                record_count: { $sum: 1 },
                location_count: { $addToSet: "$locationId" }
              }
            },
            {
              $project: {
                _id: 0,
                date: "$_id",
                total_hours: 1,
                total_cost: 1,
                record_count: 1,
                location_count: { $size: "$location_count" }
              }
            },
            { $sort: { [sortBy === "total_hours" ? "total_hours" : "date"]: sortOrder === "asc" ? 1 : -1 } }
          ];
          const rawFull = await db.collection("eitje_raw_data").aggregate(rawPipeline).toArray();
          totalCount = rawFull.length;
          results = rawFull.slice(skip, skip + pageSize);
          totalsOut = rawFull.reduce(
            (acc, r) => {
              var _a2, _b2, _c2;
              return {
                total_hours: acc.total_hours + Number((_a2 = r.total_hours) != null ? _a2 : 0),
                total_cost: acc.total_cost + Number((_b2 = r.total_cost) != null ? _b2 : 0),
                record_count: acc.record_count + Number((_c2 = r.record_count) != null ? _c2 : 0)
              };
            },
            { total_hours: 0, total_cost: 0, record_count: 0 }
          );
        } else {
          const rawPipeline = [
            { $match: rawMatch },
            {
              $addFields: {
                period: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$date" } } },
                ...EITJE_HOURS_ADD_FIELDS,
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
                },
                locName: {
                  $toString: {
                    $ifNull: [
                      "$extracted.locationName",
                      {
                        $ifNull: [
                          "$extracted.environmentName",
                          {
                            $ifNull: [
                              "$rawApiResponse.location_name",
                              {
                                $ifNull: [
                                  "$rawApiResponse.environment_name",
                                  { $ifNull: ["$rawApiResponse.environment.name", "Unknown"] }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                }
              }
            },
            {
              $group: {
                _id: { period: "$period", locationId: "$locationId", location_name: "$locName" },
                total_hours: { $sum: "$hours" },
                total_cost: { $sum: "$cost" },
                record_count: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                date: "$_id.period",
                location_id: { $ifNull: [{ $toString: "$_id.locationId" }, ""] },
                location_name: "$_id.location_name",
                total_hours: 1,
                total_cost: 1,
                record_count: 1
              }
            },
            {
              $sort: {
                [sortBy === "location_name" ? "location_name" : sortBy === "total_hours" ? "total_hours" : "date"]: sortOrder === "asc" ? 1 : -1
              }
            }
          ];
          const rawFull = await db.collection("eitje_raw_data").aggregate(rawPipeline).toArray();
          totalCount = rawFull.length;
          results = rawFull.slice(skip, skip + pageSize);
          totalsOut = rawFull.reduce(
            (acc, r) => {
              var _a2, _b2, _c2;
              return {
                total_hours: acc.total_hours + Number((_a2 = r.total_hours) != null ? _a2 : 0),
                total_cost: acc.total_cost + Number((_b2 = r.total_cost) != null ? _b2 : 0),
                record_count: acc.record_count + Number((_c2 = r.record_count) != null ? _c2 : 0)
              };
            },
            { total_hours: 0, total_cost: 0, record_count: 0 }
          );
        }
      } catch (fallbackErr) {
        console.error("[hours-aggregated] raw fallback failed:", fallbackErr);
      }
    }
    let locations = [];
    if (includeLocations && groupBy !== "location") {
      const locs = await db.collection("locations").find({}, { projection: { name: 1 } }).sort({ name: 1 }).toArray();
      locations = locs.map((l) => ({ _id: String(l._id), name: l.name }));
    }
    return {
      success: true,
      data: results,
      pagination: { page, pageSize, totalCount },
      totals: totalsOut,
      summary: { total_records: totalCount, group_by: groupBy },
      locations
    };
  } catch (error) {
    console.error("[hours-aggregated]", error);
    throw createError({ statusCode: 500, message: "Failed to fetch hours data" });
  }
});

export { hoursAggregated_get as default };
//# sourceMappingURL=hours-aggregated.get.mjs.map
