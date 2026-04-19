import { g as getDb, q as getUtcDayRange, E as EITJE_HOURS_ADD_FIELDS } from '../nitro/nitro.mjs';
import { ObjectId } from 'mongodb';

const DEFAULT_CHECKS = ["duplicates_raw", "duplicates_aggregation", "normalization", "sums"];
function getDefaultDateRange() {
  const end = /* @__PURE__ */ new Date();
  const start = /* @__PURE__ */ new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0]
  };
}
async function checkRawDuplicates(options) {
  var _a;
  const db = await getDb();
  const endpoint = options.endpoint === "planning_shifts" ? "planning_shifts" : "time_registration_shifts";
  const limit = (_a = options.limit) != null ? _a : 50;
  const match = {
    endpoint,
    date: {
      $gte: /* @__PURE__ */ new Date(options.startDate + "T00:00:00.000Z"),
      $lte: /* @__PURE__ */ new Date(options.endDate + "T23:59:59.999Z")
    }
  };
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          locationId: "$locationId",
          userId: { $ifNull: ["$extracted.userId", "$rawApiResponse.user_id"] },
          teamId: { $ifNull: ["$extracted.teamId", "$rawApiResponse.team_id"] },
          supportId: { $ifNull: ["$extracted.supportId", "$rawApiResponse.support_id"] }
        },
        count: { $sum: 1 },
        docIds: { $push: { $toString: "$_id" } }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: limit }
  ];
  const groups = await db.collection("eitje_raw_data").aggregate(pipeline).toArray();
  let totalExtraDocs = 0;
  const out = groups.map((g) => {
    var _a2, _b, _c;
    totalExtraDocs += g.count - 1;
    return {
      date: g._id.date,
      locationId: g._id.locationId != null ? String(g._id.locationId) : null,
      userId: (_a2 = g._id.userId) != null ? _a2 : null,
      teamId: (_b = g._id.teamId) != null ? _b : null,
      supportId: (_c = g._id.supportId) != null ? _c : null,
      count: g.count,
      docIds: g.docIds.slice(0, 10)
    };
  });
  const totalDuplicateGroups = groups.length;
  return {
    ok: totalDuplicateGroups === 0,
    totalDuplicateGroups,
    totalExtraDocs,
    groups: out
  };
}
async function checkAggregationDuplicates(options) {
  var _a;
  const db = await getDb();
  const collectionName = options.endpoint === "planning_shifts" ? "eitje_planning_registration_aggregation" : "eitje_time_registration_aggregation";
  const limit = (_a = options.limit) != null ? _a : 50;
  const pipeline = [
    {
      $match: {
        period_type: "day",
        period: { $gte: options.startDate, $lte: options.endDate }
      }
    },
    {
      $group: {
        _id: {
          period: "$period",
          locationId: "$locationId",
          userId: "$userId",
          teamId: "$teamId"
        },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: limit }
  ];
  const groups = await db.collection(collectionName).aggregate(pipeline).toArray();
  const out = groups.map((g) => ({
    period: g._id.period,
    locationId: g._id.locationId != null ? String(g._id.locationId) : null,
    userId: g._id.userId != null ? String(g._id.userId) : null,
    teamId: g._id.teamId != null ? String(g._id.teamId) : null,
    count: g.count
  }));
  return {
    ok: groups.length === 0,
    totalDuplicateGroups: groups.length,
    groups: out
  };
}
async function checkNormalization(options) {
  const db = await getDb();
  const endpoint = options.endpoint === "planning_shifts" ? "planning_shifts" : "time_registration_shifts";
  const rawMatch = { endpoint };
  const aggMatch = { period_type: "day" };
  const rawTotal = await db.collection("eitje_raw_data").countDocuments(rawMatch);
  const aggTotal = await db.collection("eitje_time_registration_aggregation").countDocuments(aggMatch);
  const rawIssues = [];
  const aggIssues = [];
  const rawCursor = db.collection("eitje_raw_data").find(rawMatch).limit(5e3);
  for await (const doc of rawCursor) {
    const id = doc._id != null ? String(doc._id) : "";
    if (doc.date == null) rawIssues.push({ collection: "eitje_raw_data", docId: id, reason: "missing date", field: "date" });
    const hasLocation = doc.locationId != null || doc.environmentId != null;
    if (!hasLocation) rawIssues.push({ collection: "eitje_raw_data", docId: id, reason: "missing locationId and environmentId", field: "locationId" });
    if (rawIssues.length >= 100) break;
  }
  const aggCursor = db.collection("eitje_time_registration_aggregation").find(aggMatch).limit(5e3);
  for await (const doc of aggCursor) {
    const id = doc._id != null ? String(doc._id) : "";
    if (doc.period == null) aggIssues.push({ collection: "eitje_time_registration_aggregation", docId: id, reason: "missing period", field: "period" });
    if (doc.total_hours == null && doc.total_hours !== 0) aggIssues.push({ collection: "eitje_time_registration_aggregation", docId: id, reason: "missing total_hours", field: "total_hours" });
    if (doc.record_count == null && doc.record_count !== 0) aggIssues.push({ collection: "eitje_time_registration_aggregation", docId: id, reason: "missing record_count", field: "record_count" });
    if (aggIssues.length >= 100) break;
  }
  return {
    raw: { total: rawTotal, withIssues: rawIssues.length, issues: rawIssues.slice(0, 50) },
    aggregation: { total: aggTotal, withIssues: aggIssues.length, issues: aggIssues.slice(0, 50) }
  };
}
async function checkAggregationVsRawSums(options) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const db = await getDb();
  const endpoint = options.endpoint === "planning_shifts" ? "planning_shifts" : "time_registration_shifts";
  const tolerance = (_a = options.tolerance) != null ? _a : 0.02;
  const collectionName = endpoint === "planning_shifts" ? "eitje_planning_registration_aggregation" : "eitje_time_registration_aggregation";
  const aggPipeline = [
    { $match: { period_type: "day", period: { $gte: options.startDate, $lte: options.endDate } } },
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
  const rows = await db.collection(collectionName).aggregate(aggPipeline).toArray();
  const mismatches = [];
  let okCount = 0;
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
      const eitjeIds = (_b = locationDoc == null ? void 0 : locationDoc.eitjeIds) != null ? _b : [];
      const { dayStart, dayEnd } = getUtcDayRange(dateStr);
      const dateCondition = { $or: [{ date: { $gte: dayStart, $lte: dayEnd } }, { date: dateStr }] };
      const locationClauses = [];
      if (locationIdObj) locationClauses.push({ locationId: locationIdObj });
      locationClauses.push({ locationId: locIdStr });
      if (eitjeIds.length) locationClauses.push({ environmentId: { $in: eitjeIds } });
      match = {
        endpoint,
        $and: [dateCondition, { $or: locationClauses }]
      };
    } else {
      const { dayStart, dayEnd } = getUtcDayRange(dateStr);
      match = {
        endpoint,
        $and: [{ $or: [{ date: { $gte: dayStart, $lte: dayEnd } }, { date: dateStr }] }]
      };
    }
    const rawSumPipeline = [
      { $match: match },
      { $addFields: EITJE_HOURS_ADD_FIELDS },
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
      okCount++;
    }
  }
  const possible_causes = "When row total \u2260 sum of raw: (1) Date/timezone (2) Location mapping environmentId vs locationId (3) Duplicates in raw (4) Hours formula/rounding.";
  return {
    ok: mismatches.length === 0,
    total_rows: rows.length,
    ok_count: okCount,
    mismatch_count: mismatches.length,
    mismatches,
    possible_causes
  };
}
async function runIntegrityChecks(options) {
  var _a, _b, _c, _d, _e;
  const checks = ((_a = options.checks) == null ? void 0 : _a.length) ? options.checks : DEFAULT_CHECKS;
  const { startDate, endDate } = options.startDate && options.endDate ? { startDate: options.startDate, endDate: options.endDate } : getDefaultDateRange();
  const endpoint = (_b = options.endpoint) != null ? _b : "time_registration_shifts";
  const report = {
    ok: true,
    ranAt: (/* @__PURE__ */ new Date()).toISOString(),
    options: { startDate, endDate, checks }
  };
  if (checks.includes("duplicates_raw")) {
    const result = await checkRawDuplicates({
      startDate,
      endDate,
      endpoint,
      limit: (_c = options.duplicateLimit) != null ? _c : 50
    });
    report.duplicates_raw = {
      ok: result.ok,
      totalDuplicateGroups: result.totalDuplicateGroups,
      totalExtraDocs: result.totalExtraDocs,
      groups: result.groups
    };
    if (!result.ok) report.ok = false;
  }
  if (checks.includes("duplicates_aggregation")) {
    const result = await checkAggregationDuplicates({
      startDate,
      endDate,
      endpoint,
      limit: (_d = options.duplicateLimit) != null ? _d : 50
    });
    report.duplicates_aggregation = {
      ok: result.ok,
      totalDuplicateGroups: result.totalDuplicateGroups,
      groups: result.groups
    };
    if (!result.ok) report.ok = false;
  }
  if (checks.includes("normalization")) {
    const result = await checkNormalization({ endpoint });
    const rawOk = result.raw.withIssues === 0;
    const aggOk = result.aggregation.withIssues === 0;
    report.normalization = {
      ok: rawOk && aggOk,
      raw: result.raw,
      aggregation: result.aggregation
    };
    if (!report.normalization.ok) report.ok = false;
  }
  if (checks.includes("sums")) {
    const result = await checkAggregationVsRawSums({
      startDate,
      endDate,
      endpoint,
      tolerance: (_e = options.sumsTolerance) != null ? _e : 0.02
    });
    report.sums = {
      ok: result.ok,
      total_rows: result.total_rows,
      ok_count: result.ok_count,
      mismatch_count: result.mismatch_count,
      mismatches: result.mismatches,
      possible_causes: result.possible_causes
    };
    if (!result.ok) report.ok = false;
  }
  return report;
}
async function fixRawDuplicates(options) {
  const db = await getDb();
  const coll = db.collection("eitje_raw_data");
  const endpoint = options.endpoint === "planning_shifts" ? "planning_shifts" : "time_registration_shifts";
  const dayStart = /* @__PURE__ */ new Date(options.startDate + "T00:00:00.000Z");
  const dayEnd = /* @__PURE__ */ new Date(options.endDate + "T23:59:59.999Z");
  const pipeline = [
    {
      $match: {
        endpoint,
        $or: [
          { date: { $gte: dayStart, $lte: dayEnd } },
          { date: { $gte: options.startDate, $lte: options.endDate } }
        ]
      }
    },
    {
      $addFields: {
        _userId: { $toString: { $ifNull: ["$extracted.userId", "$rawApiResponse.user_id"] } },
        _teamId: { $toString: { $ifNull: ["$extracted.teamId", "$rawApiResponse.team_id"] } },
        _supportId: { $toString: { $ifNull: ["$extracted.supportId", { $ifNull: ["$rawApiResponse.support_id", { $ifNull: ["$rawApiResponse.id", "$_id"] }] }] } },
        _dateStr: {
          $cond: [
            { $eq: [{ $type: "$date" }, "string"] },
            { $substr: ["$date", 0, 10] },
            { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$date" } } }
          ]
        }
      }
    },
    {
      $group: {
        _id: { date: "$_dateStr", userId: "$_userId", teamId: "$_teamId", supportId: "$_supportId" },
        ids: { $push: "$_id" },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $project: { ids: 1, count: 1 } }
  ];
  const groups = await coll.aggregate(pipeline).toArray();
  const allToDelete = [];
  for (const g of groups) {
    allToDelete.push(...g.ids.slice(1));
  }
  if (allToDelete.length === 0) return 0;
  const BATCH = 500;
  let totalDeleted = 0;
  for (let i = 0; i < allToDelete.length; i += BATCH) {
    const batch = allToDelete.slice(i, i + BATCH);
    const del = await coll.deleteMany({ _id: { $in: batch } });
    totalDeleted += del.deletedCount;
  }
  return totalDeleted;
}
async function fixAggregationDuplicates(options) {
  var _a, _b;
  const db = await getDb();
  const coll = db.collection(options.endpoint === "planning_shifts" ? "eitje_planning_registration_aggregation" : "eitje_time_registration_aggregation");
  const pipeline = [
    { $match: { period_type: "day", period: { $gte: options.startDate, $lte: options.endDate } } },
    { $group: { _id: { period: "$period", locationId: "$locationId", userId: "$userId", teamId: "$teamId" }, ids: { $push: "$_id" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $project: { remove: { $slice: ["$ids", 1, { $subtract: [{ $size: "$ids" }, 1] }] } } },
    { $unwind: "$remove" },
    { $group: { _id: null, toDelete: { $push: "$remove" } } }
  ];
  const result = await coll.aggregate(pipeline).toArray();
  const toDelete = (_b = (_a = result[0]) == null ? void 0 : _a.toDelete) != null ? _b : [];
  if (toDelete.length === 0) return 0;
  const del = await coll.deleteMany({ _id: { $in: toDelete } });
  return del.deletedCount;
}
async function fixSumMismatches(options) {
  var _a, _b;
  const db = await getDb();
  const endpoint = options.endpoint === "planning_shifts" ? "planning_shifts" : "time_registration_shifts";
  const tolerance = (_a = options.tolerance) != null ? _a : 0.02;
  const coll = db.collection(endpoint === "planning_shifts" ? "eitje_planning_registration_aggregation" : "eitje_time_registration_aggregation");
  const { mismatches } = await checkAggregationVsRawSums({ ...options, tolerance });
  if (mismatches.length === 0) return 0;
  let fixed = 0;
  for (const m of mismatches) {
    const dateStr = m.date;
    const locationIdParam = m.location_id;
    if (!locationIdParam) continue;
    let locationIdObj = null;
    try {
      locationIdObj = new ObjectId(locationIdParam);
    } catch {
      continue;
    }
    const locIdStr = String(locationIdParam);
    const locationDoc = await db.collection("unified_location").findOne({
      $or: [
        { primaryId: locationIdObj },
        { allIdValues: locationIdObj },
        { allIdValues: locIdStr },
        { eitjeIds: locationIdParam }
      ]
    });
    const eitjeIds = (_b = locationDoc == null ? void 0 : locationDoc.eitjeIds) != null ? _b : [];
    const { dayStart, dayEnd } = getUtcDayRange(dateStr);
    const dateCondition = { $or: [{ date: { $gte: dayStart, $lte: dayEnd } }, { date: dateStr }] };
    const locationClauses = [
      { locationId: locationIdObj },
      { locationId: locIdStr }
    ];
    if (eitjeIds.length) locationClauses.push({ environmentId: { $in: eitjeIds } });
    const rawMatch = {
      endpoint,
      $and: [dateCondition, { $or: locationClauses }]
    };
    const rawPipeline = [
      { $match: rawMatch },
      {
        $addFields: {
          ...EITJE_HOURS_ADD_FIELDS,
          period: dateStr,
          userId: { $ifNull: ["$extracted.userId", "$rawApiResponse.user_id"] },
          teamId: { $ifNull: ["$extracted.teamId", "$rawApiResponse.team_id"] },
          cost: {
            $ifNull: [
              { $divide: [{ $toDouble: "$extracted.amountInCents" }, 100] },
              { $ifNull: [{ $divide: [{ $toDouble: "$rawApiResponse.amt_in_cents" }, 100] }, 0] }
            ]
          }
        }
      },
      {
        $lookup: {
          from: "unified_user",
          let: { uid: "$userId" },
          pipeline: [
            { $match: { $expr: { $or: [{ $in: ["$$uid", { $ifNull: ["$eitjeIds", []] }] }, { $in: ["$$uid", { $ifNull: ["$allIdValues", []] }] }, { $eq: ["$primaryId", "$$uid"] }] } } },
            { $limit: 1 },
            { $project: { primaryName: 1 } }
          ],
          as: "u"
        }
      },
      {
        $lookup: {
          from: "unified_team",
          let: { tid: "$teamId" },
          pipeline: [
            { $match: { $expr: { $or: [{ $in: ["$$tid", { $ifNull: ["$eitjeIds", []] }] }, { $in: ["$$tid", { $ifNull: ["$allIdValues", []] }] }, { $eq: ["$primaryId", "$$tid"] }] } } },
            { $limit: 1 },
            { $project: { primaryName: 1 } }
          ],
          as: "t"
        }
      },
      {
        $group: {
          _id: { period: "$period", locationId: { $literal: locationIdObj }, userId: "$userId", teamId: "$teamId" },
          location_name: { $first: m.location_name },
          user_name: { $first: { $ifNull: [{ $arrayElemAt: ["$u.primaryName", 0] }, "Unknown"] } },
          team_name: { $first: { $ifNull: [{ $arrayElemAt: ["$t.primaryName", 0] }, "Unknown"] } },
          total_hours: { $sum: "$hours" },
          total_cost: { $sum: "$cost" },
          record_count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          period: "$_id.period",
          period_type: "day",
          locationId: "$_id.locationId",
          location_name: 1,
          userId: "$_id.userId",
          user_name: 1,
          teamId: "$_id.teamId",
          team_name: 1,
          total_hours: 1,
          total_cost: 1,
          record_count: 1
        }
      }
    ];
    const newDocs = await db.collection("eitje_raw_data").aggregate(rawPipeline).toArray();
    await coll.deleteMany({ period_type: "day", period: dateStr, locationId: locationIdObj });
    if (newDocs.length > 0) {
      await coll.insertMany(newDocs);
      fixed++;
    }
  }
  return fixed;
}
async function runAndFix(options) {
  const { startDate, endDate } = (options == null ? void 0 : options.startDate) && (options == null ? void 0 : options.endDate) ? options : getDefaultDateRange();
  const rawDeduped = await fixRawDuplicates({ startDate, endDate });
  if (options == null ? void 0 : options.rawOnly) {
    return { rawDeduped, aggDeduped: 0, reAggregated: 0 };
  }
  const aggDeduped = await fixAggregationDuplicates({ startDate, endDate });
  const reAggregated = await fixSumMismatches({ startDate, endDate });
  return { rawDeduped, aggDeduped, reAggregated };
}

export { runIntegrityChecks as a, runAndFix as r };
//# sourceMappingURL=dataIntegrityService.mjs.map
