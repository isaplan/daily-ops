import { ObjectId } from 'mongodb';

function borkDateToISO(borkDate) {
  const s = String(borkDate).padStart(8, "0");
  const year = s.slice(0, 4);
  const month = s.slice(4, 6);
  const day = s.slice(6, 8);
  return `${year}-${month}-${day}`;
}
function extractHour(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/^(\d{1,2}):/);
  return match ? parseInt(match[1], 10) : 0;
}
function addCalendarDaysISO(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function calendarToBusinessDay(calendarDateStr, calendarHour) {
  if (calendarHour >= 6 && calendarHour <= 23) {
    return { businessDate: calendarDateStr, businessHour: calendarHour - 6 };
  }
  return {
    businessDate: addCalendarDaysISO(calendarDateStr, -1),
    businessHour: calendarHour + 18
  };
}
async function rebuildBorkSalesAggregation(db, startDate, endDate, collectionSuffix = "", cronTime = /* @__PURE__ */ new Date()) {
  const result = {
    byCron: 0,
    byHour: 0,
    byTable: 0,
    byWorker: 0,
    byGuestAccount: 0,
    productsMaster: 0
  };
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const startBorkDate = startYear * 1e4 + startMonth * 100 + startDay;
  const endBorkDate = endYear * 1e4 + endMonth * 100 + endDay;
  const locMappings = await db.collection("bork_unified_location_mapping").find({}).toArray();
  const userMappings = await db.collection("bork_unified_user_mapping").find({}).toArray();
  const locMap = new Map(locMappings.map((l) => [String(l.borkLocationId), { unifiedId: l.unifiedLocationId, name: l.unifiedLocationName }]));
  const userMap = new Map(userMappings.map((u) => [u.borkUserId || u.borkUserName, { unifiedId: u.unifiedUserId, name: u.unifiedUserName }]));
  const cursor = db.collection("bork_raw_data").find({ endpoint: "bork_daily" }).batchSize(32);
  const byCronMap = /* @__PURE__ */ new Map();
  const byHourMap = /* @__PURE__ */ new Map();
  const byTableMap = /* @__PURE__ */ new Map();
  const byWorkerMap = /* @__PURE__ */ new Map();
  const byGuestAccountMap = /* @__PURE__ */ new Map();
  const productsMasterMap = /* @__PURE__ */ new Map();
  try {
    for await (const rawDoc of cursor) {
      const borkLocationId = rawDoc.locationId;
      const locMapping = locMap.get(String(borkLocationId));
      if (!locMapping) {
        console.warn(`No unified location mapping for Bork location ${borkLocationId}`);
        continue;
      }
      const unifiedLocationId = locMapping.unifiedId;
      const unifiedLocationName = locMapping.name;
      const tickets = Array.isArray(rawDoc.rawApiResponse) ? rawDoc.rawApiResponse : [rawDoc.rawApiResponse];
      for (const ticket of tickets) {
        if (!ticket || typeof ticket !== "object") continue;
        const borkWorkerName = ticket.UserName || "Unknown";
        const userMapping = userMap.get(borkWorkerName) || userMap.get(ticket.UserId);
        const unifiedWorkerId = (userMapping == null ? void 0 : userMapping.unifiedId) || "unknown";
        const unifiedWorkerName = (userMapping == null ? void 0 : userMapping.name) || borkWorkerName;
        const orders = Array.isArray(ticket.Orders) ? ticket.Orders : [];
        for (const order of orders) {
          if (!order || typeof order !== "object") continue;
          const orderDate = String(order.Date || order.ActualDate || "").padStart(8, "0");
          if (!orderDate || orderDate === "00000000") continue;
          const orderBorkDate = parseInt(orderDate, 10);
          if (orderBorkDate < startBorkDate || orderBorkDate > endBorkDate) continue;
          const dateStr = borkDateToISO(orderBorkDate);
          const tableNumber = String(order.TableNr || "").trim();
          const hasTable = tableNumber.length > 0;
          const lines = Array.isArray(order.Lines) ? order.Lines : [];
          for (const line of lines) {
            if (!line || typeof line !== "object") continue;
            const price = Number(line.Price || 0);
            const qty = Number(line.Qty || 0);
            const totalPrice = price * qty;
            const productName = line.ProductName || "Unknown";
            const productKey = line.ProductKey || "unknown";
            const hour = extractHour(ticket.Time);
            const { businessDate, businessHour } = calendarToBusinessDay(dateStr, hour);
            const cronKey = `${unifiedLocationId}:${dateStr}`;
            if (!byCronMap.has(cronKey)) {
              byCronMap.set(cronKey, {
                cronTime,
                locationId: unifiedLocationId,
                locationName: unifiedLocationName,
                date: dateStr,
                total_revenue: 0,
                total_quantity: 0,
                record_count: 0
              });
            }
            const cronEntry = byCronMap.get(cronKey);
            cronEntry.total_revenue = cronEntry.total_revenue + totalPrice;
            cronEntry.total_quantity = cronEntry.total_quantity + qty;
            cronEntry.record_count = cronEntry.record_count + 1;
            const hourKey = `${unifiedLocationId}:${dateStr}:${hour}`;
            if (!byHourMap.has(hourKey)) {
              byHourMap.set(hourKey, {
                date: dateStr,
                hour,
                business_date: businessDate,
                business_hour: businessHour,
                locationId: unifiedLocationId,
                locationName: unifiedLocationName,
                total_revenue: 0,
                total_quantity: 0,
                record_count: 0,
                products: /* @__PURE__ */ new Map()
              });
            }
            const hourEntry = byHourMap.get(hourKey);
            hourEntry.total_revenue = hourEntry.total_revenue + totalPrice;
            hourEntry.total_quantity = hourEntry.total_quantity + qty;
            hourEntry.record_count = hourEntry.record_count + 1;
            if (!hourEntry.products.has(productKey)) {
              hourEntry.products.set(productKey, {
                productId: productKey,
                productName,
                revenue: 0,
                quantity: 0
              });
            }
            const prod = hourEntry.products.get(productKey);
            prod.revenue += totalPrice;
            prod.quantity += qty;
            if (hasTable) {
              const tableKey = `${unifiedLocationId}:${dateStr}:${hour}:${tableNumber}`;
              if (!byTableMap.has(tableKey)) {
                byTableMap.set(tableKey, {
                  date: dateStr,
                  hour,
                  business_date: businessDate,
                  business_hour: businessHour,
                  locationId: unifiedLocationId,
                  locationName: unifiedLocationName,
                  tableNumber,
                  total_revenue: 0,
                  total_quantity: 0,
                  products: /* @__PURE__ */ new Map()
                });
              }
              const tableEntry = byTableMap.get(tableKey);
              tableEntry.total_revenue = tableEntry.total_revenue + totalPrice;
              tableEntry.total_quantity = tableEntry.total_quantity + qty;
              if (!tableEntry.products.has(productKey)) {
                tableEntry.products.set(productKey, {
                  productId: productKey,
                  productName,
                  revenue: 0,
                  quantity: 0
                });
              }
              const tableProd = tableEntry.products.get(productKey);
              tableProd.revenue += totalPrice;
              tableProd.quantity += qty;
            }
            const workerKey = `${unifiedLocationId}:${dateStr}:${hour}:${unifiedWorkerId}`;
            if (!byWorkerMap.has(workerKey)) {
              byWorkerMap.set(workerKey, {
                date: dateStr,
                hour,
                business_date: businessDate,
                business_hour: businessHour,
                locationId: unifiedLocationId,
                locationName: unifiedLocationName,
                workerId: unifiedWorkerId,
                workerName: unifiedWorkerName,
                total_revenue: 0,
                total_quantity: 0,
                record_count: 0,
                products: /* @__PURE__ */ new Map()
              });
            }
            const workerEntry = byWorkerMap.get(workerKey);
            workerEntry.total_revenue = workerEntry.total_revenue + totalPrice;
            workerEntry.total_quantity = workerEntry.total_quantity + qty;
            workerEntry.record_count = workerEntry.record_count + 1;
            if (!workerEntry.products.has(productKey)) {
              workerEntry.products.set(productKey, {
                productId: productKey,
                productName,
                revenue: 0,
                quantity: 0
              });
            }
            const workerProd = workerEntry.products.get(productKey);
            workerProd.revenue += totalPrice;
            workerProd.quantity += qty;
            if (!hasTable) {
              const guestAccountName = ticket.AccountName || "Unknown Account";
              const guestKey = `${unifiedLocationId}:${dateStr}:${hour}:${guestAccountName}`;
              if (!byGuestAccountMap.has(guestKey)) {
                byGuestAccountMap.set(guestKey, {
                  date: dateStr,
                  hour,
                  business_date: businessDate,
                  business_hour: businessHour,
                  locationId: unifiedLocationId,
                  locationName: unifiedLocationName,
                  accountName: guestAccountName,
                  workerId: unifiedWorkerId,
                  workerName: unifiedWorkerName,
                  total_revenue: 0,
                  total_quantity: 0,
                  products: /* @__PURE__ */ new Map()
                });
              }
              const guestEntry = byGuestAccountMap.get(guestKey);
              guestEntry.total_revenue = guestEntry.total_revenue + totalPrice;
              guestEntry.total_quantity = guestEntry.total_quantity + qty;
              if (!guestEntry.products.has(productKey)) {
                guestEntry.products.set(productKey, {
                  productId: productKey,
                  productName,
                  revenue: 0,
                  quantity: 0
                });
              }
              const guestProd = guestEntry.products.get(productKey);
              guestProd.revenue += totalPrice;
              guestProd.quantity += qty;
            }
            if (!productsMasterMap.has(productKey)) {
              productsMasterMap.set(productKey, {
                productId: productKey,
                productName,
                locationIds: /* @__PURE__ */ new Set(),
                createdAt: /* @__PURE__ */ new Date(),
                updatedAt: /* @__PURE__ */ new Date()
              });
            }
            const prodMaster = productsMasterMap.get(productKey);
            prodMaster.locationIds.add(String(unifiedLocationId));
            prodMaster.updatedAt = /* @__PURE__ */ new Date();
          }
        }
      }
    }
  } finally {
    await cursor.close();
  }
  const cronDocs = Array.from(byCronMap.values());
  const hourDocs = Array.from(byHourMap.values()).map((doc) => ({
    ...doc,
    products: Array.from(doc.products.values())
  }));
  const tableDocs = Array.from(byTableMap.values()).map((doc) => ({
    ...doc,
    products: Array.from(doc.products.values())
  }));
  const workerDocs = Array.from(byWorkerMap.values()).map((doc) => ({
    ...doc,
    products: Array.from(doc.products.values())
  }));
  const guestAccountDocs = Array.from(byGuestAccountMap.values()).map((doc) => ({
    ...doc,
    products: Array.from(doc.products.values())
  }));
  const productDocs = Array.from(productsMasterMap.values()).map((doc) => ({
    ...doc,
    locationIds: Array.from(doc.locationIds)
  }));
  const clearStartDate = borkDateToISO(startBorkDate);
  const clearEndDate = borkDateToISO(endBorkDate);
  console.log(`[rebuildBorkSalesAggregation] Clearing existing aggregations for ${clearStartDate} to ${clearEndDate}...`);
  await db.collection(`bork_sales_by_cron${collectionSuffix}`).deleteMany({ date: { $gte: clearStartDate, $lte: clearEndDate } });
  await db.collection(`bork_sales_by_hour${collectionSuffix}`).deleteMany({ date: { $gte: clearStartDate, $lte: clearEndDate } });
  await db.collection(`bork_sales_by_table${collectionSuffix}`).deleteMany({ date: { $gte: clearStartDate, $lte: clearEndDate } });
  await db.collection(`bork_sales_by_worker${collectionSuffix}`).deleteMany({ date: { $gte: clearStartDate, $lte: clearEndDate } });
  await db.collection(`bork_sales_by_guest_account${collectionSuffix}`).deleteMany({ date: { $gte: clearStartDate, $lte: clearEndDate } });
  if (cronDocs.length > 0) {
    await db.collection(`bork_sales_by_cron${collectionSuffix}`).insertMany(cronDocs);
    result.byCron = cronDocs.length;
  }
  if (hourDocs.length > 0) {
    await db.collection(`bork_sales_by_hour${collectionSuffix}`).insertMany(hourDocs);
    result.byHour = hourDocs.length;
  }
  if (tableDocs.length > 0) {
    await db.collection(`bork_sales_by_table${collectionSuffix}`).insertMany(tableDocs);
    result.byTable = tableDocs.length;
  }
  if (workerDocs.length > 0) {
    await db.collection(`bork_sales_by_worker${collectionSuffix}`).insertMany(workerDocs);
    result.byWorker = workerDocs.length;
  }
  if (guestAccountDocs.length > 0) {
    await db.collection(`bork_sales_by_guest_account${collectionSuffix}`).insertMany(guestAccountDocs);
    result.byGuestAccount = guestAccountDocs.length;
  }
  for (const prodDoc of productDocs) {
    await db.collection("bork_products_master").updateOne(
      { productId: prodDoc.productId },
      {
        $set: {
          productId: prodDoc.productId,
          productName: prodDoc.productName,
          updatedAt: prodDoc.updatedAt
        },
        $addToSet: { locationIds: { $each: prodDoc.locationIds } },
        $setOnInsert: { createdAt: prodDoc.createdAt }
      },
      { upsert: true }
    );
  }
  result.productsMaster = productDocs.length;
  return result;
}

function getDateRangeForJobType(jobType) {
  if (jobType === "historical-data") return { days: 30 };
  return { days: 1 };
}
async function tryFetchBorkTicketData(baseUrl, apiKey, dateStr) {
  const base = baseUrl.replace(/\/$/, "");
  const url = `${base}/ticket/day.json/${dateStr}?appid=${apiKey}&IncOpen=True&IncInternal=True`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    const text = await res.text();
    let data = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
    }
    if (res.ok) return { ok: true, status: res.status, data };
    return { ok: false, status: res.status, data: null, error: `HTTP ${res.status}` };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, data: null, error };
  }
}
async function syncLocationDates(db, cred, jobType) {
  const locationId = cred.locationId;
  const lid = locationId != null ? String(locationId) : "unknown";
  const apiKey = typeof cred.apiKey === "string" ? cred.apiKey : "";
  const baseUrl = typeof cred.baseUrl === "string" ? cred.baseUrl : "";
  if (!apiKey || !baseUrl) {
    return { locationId: lid, ok: false, error: "missing baseUrl or apiKey on credential row" };
  }
  const config = getDateRangeForJobType(jobType);
  const now = /* @__PURE__ */ new Date();
  const dates = [];
  for (let i = 0; i < config.days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}${month}${day}`);
  }
  let lastError = "";
  let successCount = 0;
  for (const dateStr of dates) {
    const r = await tryFetchBorkTicketData(baseUrl, apiKey, dateStr);
    if (!r.ok) {
      lastError = r.error || `HTTP ${r.status || "?"}`;
      continue;
    }
    let records = [];
    if (Array.isArray(r.data)) {
      records = r.data;
    } else if (r.data && typeof r.data === "object") {
      const obj = r.data;
      for (const v of Object.values(obj)) {
        if (Array.isArray(v)) {
          records = v;
          break;
        }
      }
    }
    if (records.length === 0) {
      continue;
    }
    const syncDedupKey = `${lid}:bork_daily:${dateStr}`;
    const upsertDate = /* @__PURE__ */ new Date();
    await db.collection("bork_raw_data").updateOne(
      { syncDedupKey },
      {
        $set: {
          endpoint: "bork_daily",
          locationId: cred.locationId,
          date: upsertDate,
          rawApiResponse: records,
          syncDedupKey,
          recordCount: records.length,
          updatedAt: upsertDate
        },
        $setOnInsert: { createdAt: upsertDate }
      },
      { upsert: true }
    );
    successCount++;
  }
  if (successCount > 0) {
    return { locationId: lid, ok: true, path: `/ticket/day.json/{date}` };
  }
  return { locationId: lid, ok: false, error: lastError || "no data returned for any date" };
}
async function loadBorkCredentials(db) {
  return db.collection("api_credentials").find({
    provider: { $in: ["bork", "Bork"] },
    $nor: [{ isActive: false }]
  }).sort({ updatedAt: -1, createdAt: -1 }).toArray();
}
async function executeBorkJob(db, jobType) {
  const creds = await loadBorkCredentials(db);
  if (creds.length === 0) {
    return {
      ok: false,
      jobType,
      message: "No Bork rows in api_credentials (provider bork, with apiKey)."
    };
  }
  const locations = [];
  for (const c of creds) {
    const r = await syncLocationDates(db, c, jobType);
    locations.push(r);
  }
  const okCount = locations.filter((x) => x.ok).length;
  const syncOk = okCount > 0;
  const message = syncOk ? `Synced ${okCount}/${creds.length} location(s) into bork_raw_data` : `0/${creds.length} locations succeeded \u2014 check Bork API credentials and network access`;
  let aggregationResult = {};
  if (syncOk && jobType === "daily-data") {
    try {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      aggregationResult = await rebuildBorkSalesAggregation(db, today, today);
    } catch (e) {
      console.error("[borkSyncService] Aggregation error:", e);
    }
  }
  const finalMessage = aggregationResult.byCron ? `${message}; Aggregated: ${aggregationResult.byCron} cron snapshots, ${aggregationResult.byHour} hours, ${aggregationResult.byTable} tables, ${aggregationResult.byWorker} workers` : message;
  return {
    ok: syncOk,
    jobType,
    message: finalMessage,
    locations
  };
}
async function syncBorkSingleLocation(db, locationId, mode) {
  var _a, _b;
  const orLoc = [{ locationId }];
  try {
    orLoc.push({ locationId: new ObjectId(locationId) });
  } catch {
  }
  const cred = await db.collection("api_credentials").findOne({
    provider: { $in: ["bork", "Bork"] },
    $or: orLoc,
    $nor: [{ isActive: false }]
  });
  if (!cred) {
    return { ok: false, jobType: mode, message: "No Bork credential for this locationId" };
  }
  const r = await syncLocationDates(db, cred, mode === "ping" ? "daily-data" : mode === "master" ? "master-data" : "daily-data");
  return {
    ok: r.ok,
    jobType: mode,
    message: r.ok ? `OK via ${(_a = r.path) != null ? _a : "?"}` : (_b = r.error) != null ? _b : "failed",
    locations: [r]
  };
}

export { executeBorkJob as e, syncBorkSingleLocation as s };
//# sourceMappingURL=borkSyncService.mjs.map
