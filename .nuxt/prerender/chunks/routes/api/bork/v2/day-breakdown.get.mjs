import { defineEventHandler, getQuery, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a as getDb, c as listBorkAggReadSuffixCandidates, l as loadUnifiedLocationGroupResolver } from '../../../../nitro/nitro.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ufo/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
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

const BASIS_VS_API_TOLERANCE_EUR = 0.02;
function registerBusinessDateForInstant(d) {
  var _a, _b;
  const AMSTERDAM_TZ = "Europe/Amsterdam";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: AMSTERDAM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);
  const g = (t) => {
    var _a2, _b2;
    return (_b2 = (_a2 = p.find((x) => x.type === t)) == null ? void 0 : _a2.value) != null ? _b2 : "";
  };
  const cal = `${g("year")}-${g("month")}-${g("day")}`;
  const hour = parseInt(
    (_b = (_a = new Intl.DateTimeFormat("en-GB", {
      timeZone: AMSTERDAM_TZ,
      hour: "2-digit",
      hour12: false
    }).formatToParts(d).find((x) => x.type === "hour")) == null ? void 0 : _a.value) != null ? _b : "0",
    10
  );
  if (hour < 8) return addCalendarDaysISO(cal, -1);
  return cal;
}
function isCompletedRegisterBusinessDate(dateStr, now = /* @__PURE__ */ new Date()) {
  return dateStr < registerBusinessDateForInstant(now);
}
function normalizeLocationLabel(s) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
function sumHourlyRevenueByLocation(rows, locationFilter) {
  var _a, _b, _c;
  const m = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const loc = String((_a = r.locationName) != null ? _a : "").trim();
    if (!loc) continue;
    if (locationFilter !== "all" && loc !== locationFilter) continue;
    const rev = Number((_b = r.total_revenue) != null ? _b : 0);
    m.set(loc, ((_c = m.get(loc)) != null ? _c : 0) + rev);
  }
  return m;
}
function betterBasisReport(a, b) {
  var _a, _b;
  const ra = (_a = a.final_revenue_incl_vat) != null ? _a : 0;
  const rb = (_b = b.final_revenue_incl_vat) != null ? _b : 0;
  if (ra > 0.02 && rb <= 0.02) return a;
  if (rb > 0.02 && ra <= 0.02) return b;
  if (Math.abs(ra - rb) > 0.02) return ra >= rb ? a : b;
  const ta = a.received_at ? new Date(a.received_at).getTime() : 0;
  const tb = b.received_at ? new Date(b.received_at).getTime() : 0;
  return ta >= tb ? a : b;
}
function basisReportGroupKey(r, resolver) {
  var _a, _b, _c;
  const idKey = resolver.groupKeyFromBasisLocationId(r.location_id);
  if (idKey) return idKey;
  return (_c = (_b = resolver.resolveGroupKey(r.location)) != null ? _b : resolver.resolveGroupKey((_a = r.location_raw) != null ? _a : "")) != null ? _c : `legacy:${normalizeLocationLabel(r.location)}`;
}
function pickBasisReportsPerLocation(reports, resolver) {
  const sorted = [...reports].sort((a, b) => {
    var _a, _b, _c, _d;
    const bh = ((_a = b.business_hour) != null ? _a : -1) - ((_b = a.business_hour) != null ? _b : -1);
    if (bh !== 0) return bh;
    const ch = ((_c = b.cron_hour) != null ? _c : -1) - ((_d = a.cron_hour) != null ? _d : -1);
    if (ch !== 0) return ch;
    const ra = a.received_at ? new Date(a.received_at).getTime() : 0;
    const rb = b.received_at ? new Date(b.received_at).getTime() : 0;
    return rb - ra;
  });
  const byGroup = /* @__PURE__ */ new Map();
  for (const r of sorted) {
    const key = basisReportGroupKey(r, resolver);
    const existing = byGroup.get(key);
    byGroup.set(key, existing ? betterBasisReport(r, existing) : r);
  }
  return byGroup;
}
function mapGroupKeyToApiLocation(apiLocations, resolver) {
  const m = /* @__PURE__ */ new Map();
  for (const loc of apiLocations) {
    const g = resolver.resolveGroupKey(loc);
    if (g && !m.has(g)) m.set(g, loc);
  }
  return m;
}
function matchApiLocationForBasisReport(report, apiByGroup, resolver) {
  var _a;
  const g = basisReportGroupKey(report, resolver);
  return (_a = apiByGroup.get(g)) != null ? _a : null;
}
function addCalendarDaysISO(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function ticketDateHourForBusinessSlot(businessDate, businessHour) {
  const hour = (businessHour + 8) % 24;
  if (businessHour <= 15) return { date: businessDate, hour };
  return { date: addCalendarDaysISO(businessDate, 1), hour };
}
function padHourlyFullRegisterDay(rows, businessDate, location) {
  var _a;
  const locations = location === "all" ? [...new Set(rows.map((r) => {
    var _a2;
    return String((_a2 = r.locationName) != null ? _a2 : "");
  }).filter(Boolean))].sort() : [location];
  if (locations.length === 0) return rows;
  const key = (loc, bh) => `${loc}	${bh}`;
  const map = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const loc = String((_a = r.locationName) != null ? _a : "");
    const bh = r.business_hour;
    if (!loc || typeof bh !== "number") continue;
    map.set(key(loc, bh), r);
  }
  const out = [];
  for (const loc of locations) {
    for (let bh = 0; bh < 24; bh++) {
      const k = key(loc, bh);
      if (map.has(k)) {
        out.push(map.get(k));
        continue;
      }
      const { date: tDate, hour: tHour } = ticketDateHourForBusinessSlot(businessDate, bh);
      out.push({
        _id: `synthetic-hour-${businessDate}-${loc}-${bh}`,
        business_date: businessDate,
        business_hour: bh,
        locationName: loc,
        date: tDate,
        hour: tHour,
        total_revenue: 0,
        total_quantity: 0,
        record_count: 0,
        products: []
      });
    }
  }
  return out;
}
function matchBusinessDayFilter(dateStr, locationQuery) {
  const dayOrLegacy = {
    $or: [{ business_date: dateStr }, { business_date: { $exists: false }, date: dateStr }]
  };
  if (Object.keys(locationQuery).length === 0) return dayOrLegacy;
  return { $and: [dayOrLegacy, locationQuery] };
}
const dayBreakdown_get = defineEventHandler(async (event) => {
  var _a, _b, _c;
  const query = getQuery(event);
  const dateStr = query.date;
  const location = query.location || "all";
  if (!dateStr) {
    throw createError({ statusCode: 400, statusMessage: "date parameter required (YYYY-MM-DD)" });
  }
  const db = await getDb();
  const suffixCandidates = listBorkAggReadSuffixCandidates();
  try {
    const locationQuery = location === "all" ? {} : { locationName: location };
    const dayMatch = matchBusinessDayFilter(dateStr, locationQuery);
    let suffix = (_a = suffixCandidates[0]) != null ? _a : "";
    let pickedViaFallback = false;
    for (let i = 0; i < suffixCandidates.length; i++) {
      const sfx = (_b = suffixCandidates[i]) != null ? _b : "";
      const probe = await db.collection(`bork_sales_by_hour${sfx}`).findOne(dayMatch);
      if (probe) {
        suffix = sfx;
        pickedViaFallback = i > 0;
        break;
      }
    }
    const hourlyColl = `bork_sales_by_hour${suffix}`;
    const workerColl = `bork_sales_by_worker${suffix}`;
    const tableColl = `bork_sales_by_table${suffix}`;
    const guestColl = `bork_sales_by_guest_account${suffix}`;
    const productColl = `bork_sales_by_product${suffix}`;
    const hourlyRaw = await db.collection(hourlyColl).find(dayMatch).sort({ business_hour: 1, locationName: 1 }).toArray();
    const hourly = padHourlyFullRegisterDay(hourlyRaw, dateStr, location);
    const worker = await db.collection(workerColl).find(dayMatch).sort({ business_hour: 1, locationName: 1, total_revenue: -1 }).toArray();
    const table = await db.collection(tableColl).find(dayMatch).sort({ business_hour: 1, locationName: 1, total_revenue: -1 }).toArray();
    const guest = await db.collection(guestColl).find(dayMatch).sort({ business_hour: 1, locationName: 1, total_revenue: -1 }).toArray();
    const product = await db.collection(productColl).find(dayMatch).sort({ total_revenue: -1 }).toArray();
    const apiByLoc = sumHourlyRevenueByLocation(hourlyRaw, location === "all" ? "all" : location);
    const dataHealth = {
      aggregateSuffixUsed: suffix,
      aggregateSuffixCandidatesTried: suffixCandidates,
      pickedViaFallback,
      hourlyRawCount: hourlyRaw.length,
      hourlyCollection: hourlyColl,
      emptyAggregatesMessage: hourlyRaw.length === 0 ? `No documents matched hourly aggregates for this business_date after trying suffixes ${suffixCandidates.map((s) => `"${s || "(none)"}"`).join(", ")} (last read: ${hourlyColl}). Align BORK_AGG_VERSION_SUFFIX with your Mongo collection names or run the V2 rebuild for this date range.` : void 0,
      fallbackNotice: pickedViaFallback && hourlyRaw.length > 0 ? `Data was loaded from ${hourlyColl}. Consider setting BORK_AGG_VERSION_SUFFIX so the primary suffix matches your DB.` : void 0
    };
    let basisReference;
    if (!isCompletedRegisterBusinessDate(dateStr)) {
      basisReference = {
        eligible: false,
        reason: "Basis comparison runs only for completed register days (business_date strictly before today\u2019s open register day)."
      };
    } else {
      const basisDocs = await db.collection("inbox-bork-basis-report").find({ date: dateStr }).toArray();
      const resolver = await loadUnifiedLocationGroupResolver(db);
      const perLoc = pickBasisReportsPerLocation(basisDocs, resolver);
      const apiLocKeys = [...apiByLoc.keys()].sort((a, b) => a.localeCompare(b, "nl"));
      const apiByGroup = mapGroupKeyToApiLocation(apiLocKeys, resolver);
      const rows = [];
      const usedApi = /* @__PURE__ */ new Set();
      let basisGrandTotal = 0;
      let apiGrandTotal = 0;
      for (const report of perLoc.values()) {
        if (location !== "all") {
          const want = resolver.resolveGroupKey(location);
          if (!want || basisReportGroupKey(report, resolver) !== want) continue;
        }
        const basisRev = report.final_revenue_incl_vat;
        const apiLoc = matchApiLocationForBasisReport(report, apiByGroup, resolver);
        const apiRev = apiLoc != null ? (_c = apiByLoc.get(apiLoc)) != null ? _c : null : null;
        if (apiLoc) usedApi.add(apiLoc);
        const apiNum = apiRev != null ? apiRev : 0;
        const diff = Math.abs(basisRev - apiNum);
        const match = diff < BASIS_VS_API_TOLERANCE_EUR;
        basisGrandTotal += basisRev;
        apiGrandTotal += apiNum;
        rows.push({
          basisLocationLabel: report.location_raw || report.location,
          matchedApiLocation: apiLoc,
          basisInclVat: basisRev,
          apiInclVat: apiRev,
          diff,
          match
        });
      }
      for (const [apiLoc, rev] of apiByLoc.entries()) {
        if (usedApi.has(apiLoc)) continue;
        rows.push({
          basisLocationLabel: "\u2014",
          matchedApiLocation: apiLoc,
          basisInclVat: null,
          apiInclVat: rev,
          diff: rev,
          match: false
        });
        apiGrandTotal += rev;
      }
      rows.sort(
        (a, b) => {
          var _a2, _b2;
          return ((_a2 = a.matchedApiLocation) != null ? _a2 : a.basisLocationLabel).localeCompare((_b2 = b.matchedApiLocation) != null ? _b2 : b.basisLocationLabel, "nl");
        }
      );
      let note;
      if (perLoc.size === 0) {
        note = "No rows in inbox-bork-basis-report for this date \u2014 ingest Basis Report emails first.";
      }
      if (hourlyRaw.length === 0 && perLoc.size > 0) {
        const extra = "Hourly API aggregates are empty for this date (\u03A3 API = \u20AC0). Fix aggregate collections / rebuild V2 for this business_date before trusting Basis vs API.";
        note = note ? `${note} ${extra}` : extra;
      }
      const overallMatch = rows.length > 0 && rows.every((r) => r.match) && Math.abs(basisGrandTotal - apiGrandTotal) < BASIS_VS_API_TOLERANCE_EUR;
      basisReference = {
        eligible: true,
        collectionSuffix: suffix || null,
        basisSource: "inbox-bork-basis-report.final_revenue_incl_vat (Netto Sales grand total, incl. VAT)",
        rows,
        basisGrandTotal,
        apiGrandTotal,
        overallMatch,
        ...note ? { note } : {}
      };
    }
    return {
      businessDate: dateStr,
      dateRange: {
        startDate: dateStr,
        endDate: dateStr,
        note: "Register day = business_date: 08:00 day D through 07:59 morning D+1 (BH0\u2013BH23). Rebuild aggregates after changing the boundary."
      },
      collectionSuffix: suffix || null,
      aggregateCollections: {
        hourly: hourlyColl,
        worker: workerColl,
        table: tableColl,
        guest: guestColl,
        product: productColl
      },
      dataHealth,
      location,
      hourly,
      worker,
      table,
      guest,
      product,
      basisReference
    };
  } catch (e) {
    console.error("[borkDayBreakdownApi]", e);
    throw createError({ statusCode: 500, statusMessage: String(e) });
  }
});

export { dayBreakdown_get as default };
//# sourceMappingURL=day-breakdown.get.mjs.map
