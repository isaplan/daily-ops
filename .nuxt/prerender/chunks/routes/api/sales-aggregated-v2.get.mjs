import { defineEventHandler, getQuery, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a as getDb, b as resolveBorkAggReadSuffix } from '../../nitro/nitro.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a as amsterdamTodayYmd, b as amsterdamYmdForOffset } from '../../_/importTableQuickDates.mjs';

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;
function parsePageParams(query) {
  var _a, _b;
  const page = Math.max(1, parseInt(String((_a = query.page) != null ? _a : "1"), 10) || 1);
  const rawSize = parseInt(String((_b = query.pageSize) != null ? _b : String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
function normalizeV2BusinessDateRange(startDate, endDate) {
  const yesterday = amsterdamYmdForOffset(-1);
  const thirtyBeforeYesterday = amsterdamYmdForOffset(-30);
  if (!startDate && !endDate) return { start: thirtyBeforeYesterday, end: yesterday };
  if (startDate && !endDate) return { start: startDate, end: yesterday };
  if (!startDate && endDate) {
    const e = /* @__PURE__ */ new Date(`${endDate}T12:00:00Z`);
    const s = new Date(e.getTime() - 29 * 24 * 60 * 60 * 1e3);
    const pad = (n) => String(n).padStart(2, "0");
    const start = `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
    return { start, end: endDate };
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
async function aggregateLocationFromBusinessDays(db, collection, match, sortObj, skip, pageSize) {
  var _a, _b, _c;
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: { locationId: "$locationId", locationName: "$locationName" },
        total_revenue: { $sum: { $ifNull: ["$total_revenue", 0] } },
        total_quantity: { $sum: { $ifNull: ["$total_quantity", 0] } },
        record_count: { $sum: { $ifNull: ["$record_count", 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        locationId: "$_id.locationId",
        location_name: "$_id.locationName",
        total_revenue: { $round: ["$total_revenue", 2] },
        total_quantity: { $round: ["$total_quantity", 2] },
        record_count: 1,
        product_count: { $literal: 0 }
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
  const agg = await db.collection(collection).aggregate(pipeline).toArray();
  const facet = agg[0];
  const totals = await sumMatchedMetrics(db, collection, match);
  return {
    results: (_a = facet == null ? void 0 : facet.data) != null ? _a : [],
    totalCount: (_c = (_b = facet == null ? void 0 : facet.total[0]) == null ? void 0 : _b.count) != null ? _c : 0,
    totals
  };
}
async function aggregateSalesByProductFromV2Collection(db, collection, rangeStart, rangeEnd, unifiedLocationId, productSearch, minLineTotal, sortObj, skip, pageSize) {
  var _a, _b, _c, _d, _e, _f, _g;
  const match = {
    business_date: { $gte: rangeStart, $lte: rangeEnd }
  };
  if (unifiedLocationId !== void 0) match.locationId = unifiedLocationId;
  const escapedSearch = productSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          productId: "$productId",
          unitPrice: "$unit_price",
          locationId: "$locationId",
          locationName: "$locationName"
        },
        productName: { $first: "$productName" },
        quantity: { $sum: { $ifNull: ["$total_quantity", 0] } },
        lineTotal: { $sum: { $ifNull: ["$total_revenue", 0] } }
      }
    },
    {
      $group: {
        _id: { productKey: "$_id.productId", unitPrice: "$_id.unitPrice" },
        productName: { $first: "$productName" },
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
  const agg = await db.collection(collection).aggregate(pipeline, { allowDiskUse: true }).toArray();
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
function mapSalesRowsForUi(groupBy, rows) {
  return rows.map((raw) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const r = raw;
    const out = { ...r };
    if (groupBy === "hour" || groupBy === "table" || groupBy === "worker" || groupBy === "guestAccount") {
      out.date = (_b = (_a = r.calendar_date) != null ? _a : r.date) != null ? _b : r.business_date;
      out.hour = (_d = (_c = r.calendar_hour) != null ? _c : r.hour) != null ? _d : r.business_hour;
    }
    if (groupBy === "date" || groupBy === "date_location") {
      out.date = (_e = r.business_date) != null ? _e : r.date;
      out.location_count = 1;
      out.location_name = (_f = r.locationName) != null ? _f : r.location_name;
    }
    if (groupBy === "product") {
      out.product_name = (_g = r.productName) != null ? _g : r.product_name;
      const bl = r.byLocation;
      out.location_count = Array.isArray(bl) ? bl.length : 0;
    }
    return out;
  });
}
const salesAggregated_get = defineEventHandler(async (event) => {
  try {
    const db = await getDb();
    const query = getQuery(event);
    const { page, pageSize, skip } = parsePageParams(query);
    const suffix = resolveBorkAggReadSuffix();
    const rawStart = typeof query.startDate === "string" ? query.startDate : void 0;
    const rawEnd = typeof query.endDate === "string" ? query.endDate : void 0;
    let { start: rangeStart, end: rangeEnd } = normalizeV2BusinessDateRange(rawStart, rawEnd);
    const todayAmsterdam = amsterdamTodayYmd();
    if (rangeEnd >= todayAmsterdam) {
      rangeEnd = amsterdamYmdForOffset(-1);
    }
    if (rangeStart > rangeEnd) {
      rangeStart = amsterdamYmdForOffset(-30);
    }
    const locationId = typeof query.locationId === "string" ? query.locationId : void 0;
    let groupBy = query.groupBy || "date";
    if (groupBy === "day") groupBy = "date";
    const sortBy = query.sortBy || "date";
    const sortOrder = query.sortOrder || "desc";
    const includeProducts = query.includeProducts === "true" || query.includeProducts === "1";
    const includeLocations = query.includeLocations !== "false" && query.includeLocations !== "0";
    const productSearch = typeof query.productSearch === "string" ? query.productSearch.trim() : "";
    const minRevenueRaw = query.minRevenue;
    const minRevenue = typeof minRevenueRaw === "string" || typeof minRevenueRaw === "number" ? Math.max(0, Number(minRevenueRaw) || 0) : 0;
    const fullDaysOnly = query.fullDaysOnly === "true" || query.fullDaysOnly === "1";
    const dateFilter = {
      $gte: rangeStart,
      $lte: rangeEnd
    };
    const q = { business_date: dateFilter };
    const locationFilter = parseLocationFilter(locationId);
    if (locationFilter !== void 0) q.locationId = locationFilter;
    if ((groupBy === "date" || groupBy === "day") && fullDaysOnly) {
      q.hour_buckets = 24;
    }
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
    const usesBusinessDate = groupBy === "date" || groupBy === "date_location" || groupBy === "hour" || groupBy === "table" || groupBy === "worker" || groupBy === "guestAccount";
    if (resolvedSortKey === "date" && usesBusinessDate) {
      resolvedSortKey = "business_date";
    }
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    let sortObj;
    if (groupBy === "hour") {
      if (sortBy === "hour" || sortBy === "business_hour") {
        sortObj = { business_date: -1, business_hour: sortDirection };
      } else {
        sortObj = { business_date: sortDirection === 1 ? 1 : -1, business_hour: 1 };
      }
    } else if (groupBy === "product") {
      const sk = sortBy === "product_name" ? "productName" : sortBy === "unit_price" ? "unit_price" : sortBy === "total_quantity" ? "total_quantity" : "total_revenue";
      sortObj = { [sk]: sortDirection };
    } else {
      const sf = resolvedSortKey === "date" ? "business_date" : resolvedSortKey === "location_name" ? "location_name" : resolvedSortKey === "product_name" ? "product_name" : resolvedSortKey;
      sortObj = { [sf]: sortDirection };
    }
    let results = [];
    let collectionName = `bork_business_days${suffix}`;
    let totalCount = 0;
    let totals = { total_revenue: 0, total_quantity: 0, record_count: 0 };
    const excludeProducts = !includeProducts;
    if (groupBy === "date") {
      collectionName = `bork_business_days${suffix}`;
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, false);
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    } else if (groupBy === "location") {
      collectionName = `bork_business_days${suffix}`;
      const out = await aggregateLocationFromBusinessDays(db, collectionName, q, sortObj, skip, pageSize);
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    } else if (groupBy === "product") {
      collectionName = `bork_sales_by_product${suffix}`;
      const out = await aggregateSalesByProductFromV2Collection(
        db,
        collectionName,
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
    } else if (groupBy === "date_location") {
      collectionName = `bork_business_days${suffix}`;
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, false);
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    } else if (groupBy === "hour") {
      collectionName = `bork_sales_by_hour${suffix}`;
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts);
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    } else if (groupBy === "table") {
      collectionName = `bork_sales_by_table${suffix}`;
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts);
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    } else if (groupBy === "worker") {
      collectionName = `bork_sales_by_worker${suffix}`;
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts);
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    } else if (groupBy === "guestAccount") {
      collectionName = `bork_sales_by_guest_account${suffix}`;
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts);
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    } else {
      collectionName = `bork_business_days${suffix}`;
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, false);
      results = out.results;
      totalCount = out.totalCount;
      totals = out.totals;
    }
    results = mapSalesRowsForUi(groupBy, results);
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
        collection: collectionName,
        v2_suffix: suffix || null
      },
      locations
    };
  } catch (error) {
    console.error("[sales-aggregated]", error);
    throw createError({ statusCode: 500, message: "Failed to fetch sales data" });
  }
});

const salesAggregated_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: salesAggregated_get
}, Symbol.toStringTag, { value: 'Module' }));

const salesAggregatedV2_get = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: salesAggregated_get
}, Symbol.toStringTag, { value: 'Module' }));

export { salesAggregatedV2_get as a, salesAggregated_get$1 as s };
//# sourceMappingURL=sales-aggregated-v2.get.mjs.map
