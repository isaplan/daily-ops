import { d as defineEventHandler, g as getDb, a as getQuery, c as createError } from '../../nitro/nitro.mjs';
import { ObjectId } from 'mongodb';
import 'papaparse';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'fs';
import 'stream';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'path';
import 'googleapis';
import 'node:url';
import '@iconify/utils';
import 'consola';
import 'node:module';

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;
function parsePageParams(query) {
  var _a, _b;
  const page = Math.max(1, parseInt(String((_a = query.page) != null ? _a : "1"), 10) || 1);
  const rawSize = parseInt(String((_b = query.pageSize) != null ? _b : String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
function normalizeDateRange(startDate, endDate) {
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
function parseLocationFilter(locationId) {
  if (!locationId || locationId === "all") return void 0;
  try {
    return new ObjectId(locationId);
  } catch {
    return locationId;
  }
}
function isoDateToBorkYmdInt(iso) {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  return y * 1e4 + m * 100 + d;
}
async function aggregateSalesByProductFromRaw(db, rangeStartIso, rangeEndIso, unifiedLocationId, productSearch, minLineTotal, sortObj, skip, pageSize) {
  var _a, _b, _c, _d, _e, _f, _g;
  const startYmd = isoDateToBorkYmdInt(rangeStartIso);
  const endYmd = isoDateToBorkYmdInt(rangeEndIso);
  const rawMatch = { rawApiResponse: { $exists: true, $ne: null } };
  if (unifiedLocationId !== void 0) {
    const maps = await db.collection("bork_unified_location_mapping").find({ unifiedLocationId }).project({ borkLocationId: 1 }).toArray();
    const borkIds = maps.map((m) => m.borkLocationId).filter((id) => id != null);
    if (borkIds.length === 0) {
      return { results: [], totalCount: 0, totals: { total_revenue: 0, total_quantity: 0, record_count: 0 } };
    }
    rawMatch.locationId = { $in: borkIds };
  }
  const escapedSearch = productSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pipeline = [
    { $match: rawMatch },
    {
      $addFields: {
        _tickets: {
          $cond: {
            if: { $isArray: "$rawApiResponse" },
            then: "$rawApiResponse",
            else: {
              $cond: {
                if: { $ne: ["$rawApiResponse", null] },
                then: ["$rawApiResponse"],
                else: []
              }
            }
          }
        }
      }
    },
    { $unwind: { path: "$_tickets", preserveNullAndEmptyArrays: false } },
    { $unwind: { path: "$_tickets.Orders", preserveNullAndEmptyArrays: false } },
    {
      $addFields: {
        _ord: "$_tickets.Orders",
        borkLocationId: "$locationId"
      }
    },
    {
      $addFields: {
        odRaw: { $ifNull: ["$_ord.Date", "$_ord.ActualDate"] }
      }
    },
    {
      $addFields: {
        orderYmd: {
          $convert: {
            input: {
              $substrCP: [
                { $concat: ["00000000", { $toString: { $ifNull: ["$odRaw", ""] } }] },
                {
                  $subtract: [
                    { $strLenCP: { $concat: ["00000000", { $toString: { $ifNull: ["$odRaw", ""] } }] } },
                    8
                  ]
                },
                8
              ]
            },
            to: "int",
            onError: null,
            onNull: null
          }
        }
      }
    },
    { $match: { orderYmd: { $gte: startYmd, $lte: endYmd } } },
    { $unwind: { path: "$_ord.Lines", preserveNullAndEmptyArrays: false } },
    {
      $addFields: {
        line: "$_ord.Lines",
        lineUnitPrice: { $toDouble: { $ifNull: ["$_ord.Lines.Price", 0] } },
        lineQty: { $toDouble: { $ifNull: ["$_ord.Lines.Qty", 0] } },
        productKey: { $toString: { $ifNull: ["$_ord.Lines.ProductKey", "unknown"] } },
        productName: { $ifNull: ["$_ord.Lines.ProductName", "Unknown"] }
      }
    },
    {
      $addFields: {
        lineValue: { $multiply: ["$lineUnitPrice", "$lineQty"] }
      }
    },
    {
      $lookup: {
        from: "bork_unified_location_mapping",
        let: { bid: "$borkLocationId" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: [{ $toString: "$borkLocationId" }, { $toString: "$$bid" }] }
            }
          },
          { $limit: 1 }
        ],
        as: "_loc"
      }
    },
    { $match: { "_loc.0": { $exists: true } } },
    {
      $addFields: {
        unifiedLocationId: { $arrayElemAt: ["$_loc.unifiedLocationId", 0] },
        unifiedLocationName: { $arrayElemAt: ["$_loc.unifiedLocationName", 0] }
      }
    },
    {
      $group: {
        _id: {
          productKey: "$productKey",
          productName: "$productName",
          unitPrice: "$lineUnitPrice",
          locationId: "$unifiedLocationId",
          locationName: "$unifiedLocationName"
        },
        quantity: { $sum: "$lineQty" },
        lineTotal: { $sum: "$lineValue" }
      }
    },
    {
      $group: {
        _id: {
          productKey: "$_id.productKey",
          unitPrice: "$_id.unitPrice"
        },
        productName: { $first: "$_id.productName" },
        unit_price: { $first: "$_id.unitPrice" },
        total_quantity: { $sum: "$quantity" },
        total_revenue: { $sum: "$lineTotal" },
        byLocation: {
          $push: {
            locationId: "$_id.locationId",
            locationName: "$_id.locationName",
            quantity: "$quantity",
            lineTotal: "$lineTotal"
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        productId: "$_id.productKey",
        productName: 1,
        unit_price: 1,
        total_quantity: 1,
        total_revenue: 1,
        byLocation: 1
      }
    }
  ];
  if (productSearch) {
    pipeline.push({ $match: { productName: { $regex: escapedSearch, $options: "i" } } });
  }
  if (minLineTotal > 0) {
    pipeline.push({ $match: { total_revenue: { $gte: minLineTotal } } });
  }
  pipeline.push({ $sort: sortObj });
  pipeline.push({
    $facet: {
      totals: [
        {
          $group: {
            _id: null,
            total_revenue: { $sum: "$total_revenue" },
            total_quantity: { $sum: "$total_quantity" }
          }
        }
      ],
      totalCount: [{ $count: "count" }],
      data: [{ $skip: skip }, { $limit: pageSize }]
    }
  });
  const agg = await db.collection("bork_raw_data").aggregate(pipeline, { allowDiskUse: true }).toArray();
  const facet = agg[0];
  const t = facet == null ? void 0 : facet.totals[0];
  return {
    results: (_a = facet == null ? void 0 : facet.data) != null ? _a : [],
    totalCount: (_c = (_b = facet == null ? void 0 : facet.totalCount[0]) == null ? void 0 : _b.count) != null ? _c : 0,
    totals: {
      total_revenue: (_d = t == null ? void 0 : t.total_revenue) != null ? _d : 0,
      total_quantity: (_e = t == null ? void 0 : t.total_quantity) != null ? _e : 0,
      record_count: (_g = (_f = facet == null ? void 0 : facet.totalCount[0]) == null ? void 0 : _f.count) != null ? _g : 0
    }
  };
}
async function sumMatchedMetrics(db, collection, match) {
  var _a, _b, _c;
  const [row] = await db.collection(collection).aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total_revenue: { $sum: { $ifNull: ["$total_revenue", 0] } },
        total_quantity: { $sum: { $ifNull: ["$total_quantity", 0] } },
        record_count: { $sum: { $ifNull: ["$record_count", 0] } }
      }
    }
  ]).toArray();
  const r = row;
  return {
    total_revenue: (_a = r == null ? void 0 : r.total_revenue) != null ? _a : 0,
    total_quantity: (_b = r == null ? void 0 : r.total_quantity) != null ? _b : 0,
    record_count: (_c = r == null ? void 0 : r.record_count) != null ? _c : 0
  };
}
async function findPaged(db, collection, match, sortObj, skip, limit, excludeProducts) {
  const projection = excludeProducts ? { products: 0 } : {};
  const col = db.collection(collection);
  const [results, totalCount, totals] = await Promise.all([
    col.find(match, { projection }).sort(sortObj).skip(skip).limit(limit).toArray(),
    col.countDocuments(match),
    sumMatchedMetrics(db, collection, match)
  ]);
  return { results, totalCount, totals };
}
const salesAggregated_get = defineEventHandler(async (event) => {
  var _a, _b, _c;
  try {
    const db = await getDb();
    const query = getQuery(event);
    const { page, pageSize, skip } = parsePageParams(query);
    const rawStart = typeof query.startDate === "string" ? query.startDate : void 0;
    const rawEnd = typeof query.endDate === "string" ? query.endDate : void 0;
    const { start: rangeStart, end: rangeEnd } = normalizeDateRange(rawStart, rawEnd);
    const locationId = typeof query.locationId === "string" ? query.locationId : void 0;
    const groupBy = query.groupBy || "date";
    const sortBy = query.sortBy || "date";
    const sortOrder = query.sortOrder || "desc";
    const includeProducts = query.includeProducts === "true" || query.includeProducts === "1";
    const includeLocations = query.includeLocations !== "false" && query.includeLocations !== "0";
    const productSearch = typeof query.productSearch === "string" ? query.productSearch.trim() : "";
    const minRevenueRaw = query.minRevenue;
    const minRevenue = typeof minRevenueRaw === "string" || typeof minRevenueRaw === "number" ? Math.max(0, Number(minRevenueRaw) || 0) : 0;
    const dateFilter = {
      $gte: rangeStart,
      $lte: rangeEnd
    };
    const q = { date: dateFilter };
    const locationFilter = parseLocationFilter(locationId);
    if (locationFilter !== void 0) q.locationId = locationFilter;
    const sortField = sortBy === "location" || sortBy === "location_name" ? "locationName" : sortBy === "product_name" ? "product_name" : sortBy === "unit_price" ? "unit_price" : sortBy === "total_revenue" ? "total_revenue" : sortBy === "total_quantity" ? "total_quantity" : "date";
    let resolvedSortKey = sortField;
    if (groupBy === "location" && (sortBy === "location" || sortBy === "location_name")) {
      resolvedSortKey = "location_name";
    } else if (groupBy === "product" && sortBy === "product_name") {
      resolvedSortKey = "productName";
    } else if (groupBy === "product" && sortBy === "unit_price") {
      resolvedSortKey = "unit_price";
    }
    if (groupBy === "product" && resolvedSortKey === "date") {
      resolvedSortKey = "total_revenue";
    }
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortObj = { [resolvedSortKey]: sortDirection };
    let results = [];
    let collectionName = "bork_sales_by_cron";
    let totalCount = 0;
    let totals = { total_revenue: 0, total_quantity: 0, record_count: 0 };
    const excludeProducts = !includeProducts;
    if (groupBy === "date") {
      collectionName = "bork_sales_by_cron";
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, false);
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    } else if (groupBy === "location") {
      collectionName = "bork_sales_by_cron";
      const pipeline = [
        { $match: q },
        {
          $group: {
            _id: { locationId: "$locationId", locationName: "$locationName" },
            total_revenue: { $sum: "$total_revenue" },
            total_quantity: { $sum: "$total_quantity" },
            record_count: { $sum: "$record_count" }
          }
        },
        {
          $project: {
            _id: 0,
            locationId: "$_id.locationId",
            location_name: "$_id.locationName",
            total_revenue: { $round: ["$total_revenue", 2] },
            total_quantity: { $round: ["$total_quantity", 2] },
            record_count: 1
          }
        },
        { $sort: sortObj },
        {
          $facet: {
            total: [{ $count: "count" }],
            data: [{ $skip: skip }, { $limit: pageSize }]
          }
        }
      ];
      const agg = await db.collection(collectionName).aggregate(pipeline).toArray();
      const facet = agg[0];
      totalCount = (_b = (_a = facet == null ? void 0 : facet.total[0]) == null ? void 0 : _a.count) != null ? _b : 0;
      results = (_c = facet == null ? void 0 : facet.data) != null ? _c : [];
      totals = await sumMatchedMetrics(db, collectionName, q);
    } else if (groupBy === "product") {
      collectionName = "bork_raw_data";
      const out = await aggregateSalesByProductFromRaw(
        db,
        rangeStart,
        rangeEnd,
        locationFilter,
        productSearch,
        minRevenue,
        sortObj,
        skip,
        pageSize
      );
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    } else if (groupBy === "guestAccount" || groupBy === "hour" || groupBy === "table" || groupBy === "worker" || groupBy === "date_location") {
      if (groupBy === "table") collectionName = "bork_sales_by_table";
      else if (groupBy === "worker") collectionName = "bork_sales_by_worker";
      else if (groupBy === "guestAccount") collectionName = "bork_sales_by_guest_account";
      else collectionName = "bork_sales_by_hour";
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts);
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    } else {
      collectionName = "bork_sales_by_hour";
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts);
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    }
    let locations = [];
    if (includeLocations && groupBy !== "location") {
      const locs = await db.collection("locations").find({}, { projection: { name: 1 } }).sort({ name: 1 }).toArray();
      locations = locs.map((l) => ({
        _id: String(l._id),
        name: typeof l.name === "string" ? l.name : ""
      }));
    }
    return {
      success: true,
      data: results,
      pagination: {
        page,
        pageSize,
        totalCount
      },
      totals,
      summary: {
        group_by: groupBy,
        collection: collectionName
      },
      locations
    };
  } catch (error) {
    console.error("[sales-aggregated]", error);
    throw createError({ statusCode: 500, message: "Failed to fetch sales data" });
  }
});

export { salesAggregated_get as default };
//# sourceMappingURL=sales-aggregated.get.mjs.map
