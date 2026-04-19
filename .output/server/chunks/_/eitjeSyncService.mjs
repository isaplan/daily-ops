import { createHash } from 'node:crypto';
import { request as request$1 } from 'node:http';
import { request } from 'node:https';
import { E as EITJE_HOURS_ADD_FIELDS, t as findEitjeCredentialDocument, v as documentToEitjeStoredCredentials, w as eitjeFetchJson, x as getMongoDatabaseName, y as normalizeEitjeBaseUrl, z as legacyEitjeV2Headers } from '../nitro/nitro.mjs';

function dayStartUtc(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y != null ? y : 0, (m != null ? m : 1) - 1, d != null ? d : 1, 0, 0, 0, 0));
}
function dayEndUtc(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y != null ? y : 0, (m != null ? m : 1) - 1, d != null ? d : 1, 23, 59, 59, 999));
}
async function rebuildEitjeTimeRegistrationAggregation(db, startDate, endDate) {
  const collAgg = db.collection("eitje_time_registration_aggregation");
  const del = await collAgg.deleteMany({
    period_type: "day",
    period: { $gte: startDate, $lte: endDate }
  });
  const startD = dayStartUtc(startDate);
  const endD = dayEndUtc(endDate);
  const pipeline = [
    {
      $match: {
        endpoint: "time_registration_shifts",
        date: { $gte: startD, $lte: endD }
      }
    },
    {
      $addFields: {
        ...EITJE_HOURS_ADD_FIELDS,
        period: {
          $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "UTC" }
        },
        userId: { $ifNull: ["$extracted.userId", "$rawApiResponse.user_id"] },
        teamId: { $ifNull: ["$extracted.teamId", "$rawApiResponse.team_id"] },
        environmentId: {
          $ifNull: [
            "$environmentId",
            "$extracted.environmentId",
            "$rawApiResponse.environment_id",
            "$rawApiResponse.environmentId",
            "$rawApiResponse.environment.id"
          ]
        }
      }
    },
    {
      $lookup: {
        from: "unified_location",
        let: { eid: "$environmentId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ["$$eid", null] },
                  { $in: ["$$eid", { $ifNull: ["$eitjeIds", []] }] }
                ]
              }
            }
          },
          { $limit: 1 },
          { $project: { primaryId: 1, primaryName: 1 } }
        ],
        as: "loc"
      }
    },
    {
      $addFields: {
        locationId: {
          $ifNull: [
            { $arrayElemAt: ["$loc.primaryId", 0] },
            { $toString: { $ifNull: ["$environmentId", "unknown"] } }
          ]
        },
        location_name: {
          $ifNull: [
            { $arrayElemAt: ["$loc.primaryName", 0] },
            {
              $ifNull: [
                "$extracted.locationName",
                { $ifNull: ["$rawApiResponse.location_name", "$rawApiResponse.environment_name"] },
                { $ifNull: ["$rawApiResponse.environment.name", null] }
              ]
            }
          ]
        }
      }
    },
    {
      $match: {
        userId: { $nin: [null, ""] },
        teamId: { $nin: [null, ""] }
      }
    },
    {
      $lookup: {
        from: "members",
        let: { uid: "$userId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$eitje_id", "$$uid"] },
                  { $in: ["$$uid", { $ifNull: ["$eitje_ids", []] }] }
                ]
              }
            }
          },
          { $limit: 1 },
          { $project: { hourly_rate: 1 } }
        ],
        as: "memberDoc"
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
          { $project: { primaryName: 1, hourly_rate: 1 } }
        ],
        as: "u"
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
          { $project: { primaryName: 1, canonicalName: 1 } }
        ],
        as: "t"
      }
    },
    {
      $addFields: {
        user_name: {
          $ifNull: [
            { $arrayElemAt: ["$u.primaryName", 0] },
            {
              $ifNull: [
                "$rawApiResponse.user.name",
                { $ifNull: ["$rawApiResponse.employee_name", "Unknown"] }
              ]
            }
          ]
        },
        hourly_rate: {
          $ifNull: [
            { $arrayElemAt: ["$memberDoc.hourly_rate", 0] },
            { $arrayElemAt: ["$u.hourly_rate", 0] }
          ]
        },
        cost: {
          $cond: [
            { $and: [{ $ne: ["$hours", null] }, { $ne: [{ $ifNull: [{ $arrayElemAt: ["$memberDoc.hourly_rate", 0] }, { $arrayElemAt: ["$u.hourly_rate", 0] }] }, null] }] },
            { $multiply: ["$hours", { $ifNull: [{ $arrayElemAt: ["$memberDoc.hourly_rate", 0] }, { $arrayElemAt: ["$u.hourly_rate", 0] }] }] },
            {
              $ifNull: [
                { $divide: [{ $toDouble: "$extracted.amountInCents" }, 100] },
                { $ifNull: [{ $divide: [{ $toDouble: "$rawApiResponse.amt_in_cents" }, 100] }, 0] }
              ]
            }
          ]
        },
        team_name: {
          $ifNull: [
            { $arrayElemAt: ["$t.canonicalName", 0] },
            {
              $ifNull: [
                { $arrayElemAt: ["$t.primaryName", 0] },
                { $ifNull: ["$rawApiResponse.team.name", "Unknown"] }
              ]
            }
          ]
        }
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
        location_name: { $first: "$location_name" },
        user_name: { $first: "$user_name" },
        team_name: { $first: "$team_name" },
        hourly_rate: { $first: "$hourly_rate" },
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
        hourly_rate: 1,
        total_hours: 1,
        total_cost: 1,
        record_count: 1
      }
    }
  ];
  const docs = await db.collection("eitje_raw_data").aggregate(pipeline).toArray();
  if (docs.length > 0) {
    await collAgg.insertMany(docs);
  }
  return { deletedPeriods: del.deletedCount, inserted: docs.length };
}

var _a;
function envInt(name, fallback) {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
async function loadActiveEitjeCredentials(db) {
  const row = await findEitjeCredentialDocument(db);
  if (!row) return null;
  return documentToEitjeStoredCredentials(row);
}
function eitjeCredentialsHintMessage() {
  const dbn = getMongoDatabaseName();
  return `No usable Eitje row in api_credentials (database "${dbn}"). Open Settings \u2192 Eitje API \u2192 save all four fields, or align MONGODB_DB_NAME / MONGODB_URI in .env.local with the DB where you store credentials.`;
}
function extractRecords(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data;
    for (const v of Object.values(o)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null) {
        return v;
      }
    }
  }
  return [];
}
function nextPageUrl(data, currentUrl) {
  var _a2, _b, _c;
  if (!data || typeof data !== "object") return null;
  const o = data;
  const links = (_a2 = o.links) != null ? _a2 : o._links;
  if (links && typeof links === "object") {
    const l = links;
    const n = (_b = l.next) != null ? _b : l.Next;
    if (typeof n === "string" && n.startsWith("http")) return n;
  }
  const meta = o.meta;
  if (meta && typeof meta === "object") {
    const m = meta;
    const n = (_c = m.next_page_url) != null ? _c : m.next;
    if (typeof n === "string" && n.startsWith("http")) return n;
  }
  return null;
}
function stableDedupKey(endpoint, raw) {
  var _a2, _b;
  const id = (_b = (_a2 = raw.id) != null ? _a2 : raw.shift_id) != null ? _b : raw.uuid;
  if (id != null && String(id).length > 0) return `${endpoint}:${String(id)}`;
  const h = createHash("sha256").update(
    JSON.stringify([
      raw.user_id,
      raw.userId,
      raw.date,
      raw.start,
      raw.start_time,
      raw.end,
      raw.end_time,
      raw.environment_id,
      raw.environmentId
    ])
  ).digest("hex");
  return `${endpoint}:h:${h.slice(0, 32)}`;
}
function toDate(v) {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}
function num(v) {
  if (v == null) return void 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : void 0;
}
function buildRawShiftDoc(raw, endpoint) {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
  const start = (_c = (_b = (_a2 = raw.start) != null ? _a2 : raw.start_time) != null ? _b : raw.started_at) != null ? _c : raw.from;
  const dateRaw = (_g = (_f = (_e = (_d = raw.date) != null ? _d : raw.work_date) != null ? _e : raw.day) != null ? _f : raw.worked_on) != null ? _g : typeof start === "string" ? start.slice(0, 10) : null;
  let date = toDate(dateRaw);
  if (!date && start != null) date = toDate(start);
  if (!date) date = /* @__PURE__ */ new Date();
  const userObj = raw.user && typeof raw.user === "object" ? raw.user : null;
  const teamObj = raw.team && typeof raw.team === "object" ? raw.team : null;
  const userId = (_i = (_h = raw.user_id) != null ? _h : raw.userId) != null ? _i : userObj == null ? void 0 : userObj.id;
  const supportId = (_k = (_j = raw.support_id) != null ? _j : raw.supportId) != null ? _k : userObj == null ? void 0 : userObj.support_id;
  const teamId = (_m = (_l = raw.team_id) != null ? _l : raw.teamId) != null ? _m : teamObj == null ? void 0 : teamObj.id;
  const environmentId = (_p = (_o = (_n = num(raw.environment_id)) != null ? _n : num(raw.environmentId)) != null ? _o : num(raw.location_id)) != null ? _p : num(raw.venue_id);
  const hoursPre = (_s = (_r = (_q = num(raw.hours)) != null ? _q : num(raw.hours_worked)) != null ? _r : num(raw.hoursWorked)) != null ? _s : void 0;
  const extracted = {
    userId,
    supportId,
    teamId,
    environmentId,
    locationName: (_t = raw.location_name) != null ? _t : raw.environment_name,
    environmentName: (_u = raw.environment_name) != null ? _u : raw.location_name,
    hours: hoursPre,
    amountInCents: (_v = num(raw.amt_in_cents)) != null ? _v : num(raw.amount_in_cents)
  };
  const syncDedupKey = stableDedupKey(endpoint, raw);
  const now = /* @__PURE__ */ new Date();
  return {
    endpoint,
    date,
    environmentId: environmentId != null ? environmentId : void 0,
    extracted,
    rawApiResponse: raw,
    syncDedupKey,
    updatedAt: now,
    createdAt: now
  };
}
function buildListEntityDoc(raw, endpoint) {
  var _a2, _b, _c;
  const id = (_b = (_a2 = raw.id) != null ? _a2 : raw.uuid) != null ? _b : raw.slug;
  const syncDedupKey = id != null ? `${endpoint}:${String(id)}` : stableDedupKey(endpoint, raw);
  const now = /* @__PURE__ */ new Date();
  return {
    endpoint,
    date: now,
    extracted: { id: raw.id, name: (_c = raw.name) != null ? _c : raw.title },
    rawApiResponse: raw,
    syncDedupKey,
    updatedAt: now,
    createdAt: now
  };
}
async function fetchAllList(creds, path, query) {
  const out = [];
  let url = path;
  let lastStatus = 0;
  let lastError = "";
  const maxPages = envInt("EITJE_SYNC_MAX_PAGES", 200);
  for (let page = 0; page < maxPages && url; page++) {
    const res = await eitjeFetchJson(creds, url, page === 0 ? { query } : void 0);
    lastStatus = res.status;
    if (!res.ok) {
      lastError = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      return { records: out, lastError, lastStatus };
    }
    const batch = extractRecords(res.data);
    out.push(...batch);
    const next = nextPageUrl(res.data, res.url);
    url = next;
    if (!next) break;
  }
  return { records: out, lastStatus };
}
const TR_PATH = (_a = process.env.EITJE_PATH_TIME_REGISTRATION_SHIFTS) != null ? _a : "time_registration_shifts";
function splitDateRangeForEitje(startDate, endDate, maxDays) {
  var _a2, _b;
  const start = /* @__PURE__ */ new Date(`${startDate}T00:00:00.000Z`);
  const end = /* @__PURE__ */ new Date(`${endDate}T00:00:00.000Z`);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24));
  if (totalDays <= maxDays) {
    return [{ startDate, endDate }];
  }
  const chunks = [];
  let currentStart = new Date(start);
  while (currentStart < end) {
    const currentEnd = new Date(currentStart);
    currentEnd.setUTCDate(currentEnd.getUTCDate() + maxDays - 1);
    if (currentEnd > end) {
      currentEnd.setTime(end.getTime());
    }
    chunks.push({
      startDate: (_a2 = currentStart.toISOString().split("T")[0]) != null ? _a2 : startDate,
      endDate: (_b = currentEnd.toISOString().split("T")[0]) != null ? _b : endDate
    });
    currentStart = new Date(currentEnd);
    currentStart.setUTCDate(currentStart.getUTCDate() + 1);
  }
  return chunks;
}
async function persistRawTimeRegistrationShifts(db, records) {
  if (records.length === 0) return 0;
  const coll = db.collection("eitje_raw_data");
  let upserted = 0;
  const chunk = 200;
  for (let i = 0; i < records.length; i += chunk) {
    const slice = records.slice(i, i + chunk);
    const ops = slice.map((raw) => {
      const doc = buildRawShiftDoc(raw, "time_registration_shifts");
      return {
        updateOne: {
          filter: { endpoint: "time_registration_shifts", syncDedupKey: doc.syncDedupKey },
          update: {
            $set: {
              endpoint: doc.endpoint,
              date: doc.date,
              environmentId: doc.environmentId,
              extracted: doc.extracted,
              rawApiResponse: doc.rawApiResponse,
              updatedAt: doc.updatedAt
            },
            $setOnInsert: { createdAt: doc.createdAt }
          },
          upsert: true
        }
      };
    });
    const res = await coll.bulkWrite(ops, { ordered: false });
    upserted += res.upsertedCount + res.modifiedCount;
  }
  return upserted;
}
async function syncTimeRegistrationShiftsWindow(db, creds, startDate, endDate) {
  const tryLegacyGetWithBody = async () => {
    const base = normalizeEitjeBaseUrl(creds.baseUrl).replace(/\/$/, "");
    const rawUrl = `${base}/time_registration_shifts`;
    const body = JSON.stringify({
      filters: {
        start_date: startDate,
        end_date: endDate,
        date_filter_type: "resource_date"
      }
    });
    try {
      const url = new URL(rawUrl);
      const transport = url.protocol === "https:" ? request : request$1;
      const headers = {
        ...legacyEitjeV2Headers(creds),
        "Content-Length": String(Buffer.byteLength(body, "utf8"))
      };
      const response = await new Promise((resolve, reject) => {
        const req = transport(
          url,
          {
            method: "GET",
            headers,
            timeout: 3e4
          },
          (res) => {
            let text = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
              text += chunk;
            });
            res.on("end", () => {
              var _a2;
              return resolve({ status: (_a2 = res.statusCode) != null ? _a2 : 0, text });
            });
          }
        );
        req.on("timeout", () => req.destroy(new Error("request timeout")));
        req.on("error", reject);
        req.write(body);
        req.end();
      });
      let parsed = response.text;
      try {
        parsed = response.text ? JSON.parse(response.text) : null;
      } catch {
      }
      if (response.status >= 200 && response.status < 300) {
        return { records: extractRecords(parsed), lastStatus: response.status };
      }
      const err2 = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
      return { records: [], lastStatus: response.status, lastError: err2 };
    } catch (e) {
      return { records: [], lastStatus: 0, lastError: e instanceof Error ? e.message : String(e) };
    }
  };
  const legacyBodyResult = await tryLegacyGetWithBody();
  if (legacyBodyResult.records.length > 0) {
    const upserted2 = await persistRawTimeRegistrationShifts(db, legacyBodyResult.records);
    return { upserted: upserted2, fetched: legacyBodyResult.records.length };
  }
  const queryAttempts = [
    { from: startDate, to: endDate },
    { start_date: startDate, end_date: endDate },
    { date_from: startDate, date_to: endDate }
  ];
  let records = [];
  let err = "";
  let status = 0;
  const pathCandidates = [
    TR_PATH,
    `v1/${TR_PATH}`,
    "time-registrations",
    "time_registrations"
  ];
  outer: for (const path of pathCandidates) {
    for (const q of queryAttempts) {
      const r = await fetchAllList(creds, path, q);
      status = r.lastStatus;
      if (r.records.length > 0) {
        records = r.records;
        err = "";
        break outer;
      }
      if (r.lastError) err = r.lastError;
    }
  }
  if (records.length === 0 && err) {
    const legacyErr = legacyBodyResult.lastError ? `; legacy-body: ${legacyBodyResult.lastError.slice(0, 200)}` : "";
    return { upserted: 0, fetched: 0, error: `HTTP ${status}: ${err.slice(0, 400)}${legacyErr}` };
  }
  const upserted = await persistRawTimeRegistrationShifts(db, records);
  return { upserted, fetched: records.length };
}
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function syncTimeRegistrationShifts(db, creds, startDate, endDate) {
  const maxDays = envInt("EITJE_TIME_REGISTRATION_MAX_DAYS", 7);
  const chunkDelayMs = envInt("EITJE_BACKFILL_CHUNK_DELAY_MS", 0);
  const chunks = splitDateRangeForEitje(startDate, endDate, maxDays);
  let upserted = 0;
  let fetched = 0;
  let i = 0;
  for (const ch of chunks) {
    i++;
    const r = await syncTimeRegistrationShiftsWindow(db, creds, ch.startDate, ch.endDate);
    if (r.error) {
      return {
        upserted,
        fetched,
        error: `${r.error} (window ${ch.startDate}\u2013${ch.endDate})`
      };
    }
    upserted += r.upserted;
    fetched += r.fetched;
    if (chunkDelayMs > 0 && i < chunks.length) await sleepMs(chunkDelayMs);
  }
  return { upserted, fetched };
}
async function syncListEndpoint(db, creds, endpoint, pathCandidates) {
  let records = [];
  let err = "";
  let status = 0;
  for (const path of pathCandidates) {
    const r = await fetchAllList(creds, path, {});
    status = r.lastStatus;
    if (r.records.length > 0) {
      records = r.records;
      err = "";
      break;
    }
    if (r.lastError) err = r.lastError;
  }
  if (records.length === 0) {
    return { upserted: 0, fetched: 0, error: err ? `HTTP ${status}: ${err.slice(0, 200)}` : "empty response" };
  }
  const coll = db.collection("eitje_raw_data");
  let upserted = 0;
  const chunk = 200;
  for (let i = 0; i < records.length; i += chunk) {
    const slice = records.slice(i, i + chunk);
    const ops = slice.map((raw) => {
      const doc = buildListEntityDoc(raw, endpoint);
      return {
        updateOne: {
          filter: { endpoint, syncDedupKey: doc.syncDedupKey },
          update: {
            $set: {
              endpoint: doc.endpoint,
              date: doc.date,
              extracted: doc.extracted,
              rawApiResponse: doc.rawApiResponse,
              updatedAt: doc.updatedAt
            },
            $setOnInsert: { createdAt: doc.createdAt }
          },
          upsert: true
        }
      };
    });
    const res = await coll.bulkWrite(ops, { ordered: false });
    upserted += res.upsertedCount + res.modifiedCount;
  }
  return { upserted, fetched: records.length };
}
function dateRangeDays(days) {
  const end = /* @__PURE__ */ new Date();
  const start = /* @__PURE__ */ new Date();
  start.setUTCDate(start.getUTCDate() - days);
  const fmt = (d) => {
    var _a2;
    return (_a2 = d.toISOString().split("T")[0]) != null ? _a2 : "";
  };
  return { start: fmt(start), end: fmt(end) };
}
async function pingEitjeApi(creds) {
  var _a2;
  const paths = ["environments", "v1/environments", "locations", "v1/locations"];
  for (const p of paths) {
    const res = await eitjeFetchJson(creds, p, {});
    if (res.ok) {
      const n = extractRecords(res.data).length;
      return { ok: true, message: `OK (${p}${n ? `, ${n} rows` : ""})` };
    }
  }
  const last = await eitjeFetchJson(creds, (_a2 = paths[0]) != null ? _a2 : "environments", {});
  const msg = typeof last.data === "string" ? last.data : JSON.stringify(last.data);
  const base = `HTTP ${last.status} ${msg.slice(0, 240)} (last auth: ${last.authAttempt})`;
  if (msg.includes("not all required auth keys present")) {
    return {
      ok: false,
      message: `${base} \u2014 Eitje returns this for missing and for rejected credentials. Confirm base URL (often .../open_api), Partner vs API username/password are the ones from Eitje Open API (not your web login), and re-save in Settings.`
    };
  }
  return { ok: false, message: base };
}
async function executeEitjeJob(db, jobType) {
  var _a2, _b;
  const creds = await loadActiveEitjeCredentials(db);
  if (!creds) {
    return {
      ok: false,
      jobType,
      message: eitjeCredentialsHintMessage()
    };
  }
  if (jobType === "master-data") {
    const endpoints = [
      { name: "environments", paths: ["environments", "v1/environments", "locations"] },
      { name: "teams", paths: ["teams", "v1/teams"] },
      { name: "users", paths: ["users", "v1/users", "employees"] }
    ];
    const master = { endpoints: [] };
    for (const e of endpoints) {
      const r = await syncListEndpoint(db, creds, e.name, e.paths);
      master.endpoints.push({ name: e.name, upserted: r.upserted, fetched: r.fetched, error: r.error });
    }
    const ok2 = master.endpoints.some((x) => x.fetched > 0);
    if (ok2) {
      try {
        await syncUnifiedMasterDataFromRaw(db);
      } catch (e) {
        console.error("[syncUnifiedMasterDataFromRaw]", e);
      }
    }
    return {
      ok: ok2,
      jobType,
      message: ok2 ? "Master data sync finished" : "Master data sync returned no rows (check API paths / credentials)",
      master
    };
  }
  const dailyDays = envInt("EITJE_DAILY_SYNC_DAYS", 14);
  const histDays = envInt("EITJE_HISTORICAL_SYNC_DAYS", 30);
  const days = jobType === "historical-data" ? histDays : dailyDays;
  const { start, end } = dateRangeDays(days);
  const tr = await syncTimeRegistrationShifts(db, creds, start, end);
  let agg;
  try {
    agg = await rebuildEitjeTimeRegistrationAggregation(db, start, end);
    await syncUnifiedCollectionsFromRawData(db);
  } catch (e) {
    agg = {
      deletedPeriods: 0,
      inserted: 0,
      error: e instanceof Error ? e.message : String(e)
    };
  }
  const ok = !tr.error && (tr.fetched > 0 || tr.upserted > 0 || ((_a2 = agg == null ? void 0 : agg.inserted) != null ? _a2 : 0) > 0);
  return {
    ok,
    jobType,
    message: tr.error ? `Time registration: ${tr.error}` : `Synced ${tr.fetched} shifts (${tr.upserted} writes), aggregation +${(_b = agg == null ? void 0 : agg.inserted) != null ? _b : 0} rows`,
    timeRegistration: tr,
    aggregation: agg
  };
}
async function syncUnifiedMasterDataFromRaw(db) {
  try {
    let locationsUpdated = 0;
    let teamsUpdated = 0;
    let usersUpdated = 0;
    const envDocs = await db.collection("eitje_raw_data").find({ endpoint: "environments" }).toArray();
    const uniqueEnvs = /* @__PURE__ */ new Map();
    envDocs.forEach((doc) => {
      const extracted = doc.extracted;
      const id = extracted == null ? void 0 : extracted.id;
      const name = extracted == null ? void 0 : extracted.name;
      if (id && name) uniqueEnvs.set(id, String(name));
    });
    for (const [id, name] of uniqueEnvs) {
      const result = await db.collection("unified_location").updateOne(
        { $or: [{ eitjeIds: id }, { allIdValues: id }] },
        {
          $set: {
            eitjeIds: [id],
            allIdValues: [id],
            primaryName: name,
            name,
            updatedAt: /* @__PURE__ */ new Date()
          },
          $setOnInsert: { createdAt: /* @__PURE__ */ new Date() }
        },
        { upsert: true }
      );
      locationsUpdated += result.upsertedCount + result.modifiedCount;
    }
    const teamDocs = await db.collection("eitje_raw_data").find({ endpoint: "teams" }).toArray();
    const uniqueTeams = /* @__PURE__ */ new Map();
    teamDocs.forEach((doc) => {
      const extracted = doc.extracted;
      const id = extracted == null ? void 0 : extracted.id;
      const name = extracted == null ? void 0 : extracted.name;
      if (id && name) uniqueTeams.set(id, String(name));
    });
    for (const [id, name] of uniqueTeams) {
      const result = await db.collection("unified_team").updateOne(
        { $or: [{ eitjeIds: id }, { allIdValues: id }] },
        {
          $set: {
            eitjeIds: [id],
            allIdValues: [id],
            primaryName: name,
            canonicalName: name,
            updatedAt: /* @__PURE__ */ new Date()
          },
          $setOnInsert: { createdAt: /* @__PURE__ */ new Date() }
        },
        { upsert: true }
      );
      teamsUpdated += result.upsertedCount + result.modifiedCount;
    }
    const userDocs = await db.collection("eitje_raw_data").find({ endpoint: "users" }).toArray();
    const uniqueUsers = /* @__PURE__ */ new Map();
    userDocs.forEach((doc) => {
      const extracted = doc.extracted;
      const id = extracted == null ? void 0 : extracted.id;
      const raw = doc.rawApiResponse;
      const firstName = (raw == null ? void 0 : raw.first_name) ? String(raw.first_name) : "";
      const lastName = (raw == null ? void 0 : raw.last_name) ? String(raw.last_name) : "";
      const email = (raw == null ? void 0 : raw.email) ? String(raw.email) : "";
      const name = firstName && lastName ? `${firstName} ${lastName}` : email || String(id);
      if (id) uniqueUsers.set(id, name);
    });
    for (const [id, name] of uniqueUsers) {
      const result = await db.collection("unified_user").updateOne(
        { $or: [{ eitjeIds: id }, { allIdValues: id }] },
        {
          $set: {
            eitjeIds: [id],
            allIdValues: [id],
            primaryName: name,
            canonicalName: name,
            updatedAt: /* @__PURE__ */ new Date()
          },
          $setOnInsert: { createdAt: /* @__PURE__ */ new Date() }
        },
        { upsert: true }
      );
      usersUpdated += result.upsertedCount + result.modifiedCount;
    }
    return { locationsUpdated, teamsUpdated, usersUpdated };
  } catch (e) {
    return {
      locationsUpdated: 0,
      teamsUpdated: 0,
      usersUpdated: 0,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}
async function syncUnifiedCollectionsFromRawData(db) {
  try {
    let usersUpdated = 0;
    let teamsUpdated = 0;
    const userAgg = await db.collection("eitje_raw_data").aggregate([
      { $match: { endpoint: "time_registration_shifts" } },
      { $addFields: { userId: { $ifNull: ["$extracted.userId", "$rawApiResponse.user_id"] } } },
      { $group: { _id: "$userId", userName: { $first: "$rawApiResponse.user.name" } } },
      { $match: { _id: { $nin: [null, ""] } } }
    ]).toArray();
    for (const user of userAgg) {
      const result = await db.collection("unified_user").updateOne(
        { eitjeIds: user._id },
        {
          $addToSet: {
            eitjeIds: user._id,
            allIdValues: user._id
          },
          $set: { updatedAt: /* @__PURE__ */ new Date() },
          $setOnInsert: {
            primaryName: user.userName,
            canonicalName: user.userName,
            createdAt: /* @__PURE__ */ new Date()
          }
        },
        { upsert: true }
      );
      usersUpdated += result.upsertedCount + result.modifiedCount;
    }
    const teamAgg = await db.collection("eitje_raw_data").aggregate([
      { $match: { endpoint: "time_registration_shifts" } },
      { $addFields: { teamId: { $ifNull: ["$extracted.teamId", "$rawApiResponse.team_id"] } } },
      { $group: { _id: "$teamId", teamName: { $first: "$rawApiResponse.team.name" } } },
      { $match: { _id: { $nin: [null, ""] } } }
    ]).toArray();
    for (const team of teamAgg) {
      const result = await db.collection("unified_team").updateOne(
        { eitjeIds: team._id },
        {
          $addToSet: {
            eitjeIds: team._id,
            allIdValues: team._id
          },
          $set: { updatedAt: /* @__PURE__ */ new Date() },
          $setOnInsert: {
            primaryName: team.teamName,
            canonicalName: team.teamName,
            createdAt: /* @__PURE__ */ new Date()
          }
        },
        { upsert: true }
      );
      teamsUpdated += result.upsertedCount + result.modifiedCount;
    }
    return { usersUpdated, teamsUpdated };
  } catch (e) {
    return {
      usersUpdated: 0,
      teamsUpdated: 0,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}
async function syncEitjeByRequest(db, body) {
  var _a2, _b, _c, _d, _e;
  const creds = await loadActiveEitjeCredentials(db);
  if (!creds) {
    return { ok: false, jobType: "manual", message: eitjeCredentialsHintMessage() };
  }
  const ep = body.endpoint || "environments";
  if (ep === "environments" || ep === "locations") {
    const ping = await pingEitjeApi(creds);
    return { ok: ping.ok, jobType: "manual", message: ping.message };
  }
  if (ep === "time_registration_shifts") {
    const dr = dateRangeDays(envInt("EITJE_DAILY_SYNC_DAYS", 14));
    const end = (_a2 = body.endDate) != null ? _a2 : dr.end;
    const start = (_b = body.startDate) != null ? _b : dr.start;
    const tr = await syncTimeRegistrationShifts(db, creds, start, end);
    let agg;
    try {
      agg = await rebuildEitjeTimeRegistrationAggregation(db, start, end);
      await syncUnifiedCollectionsFromRawData(db);
    } catch (e) {
      agg = { deletedPeriods: 0, inserted: 0, error: e instanceof Error ? e.message : String(e) };
    }
    return {
      ok: !tr.error,
      jobType: "manual",
      message: (_d = tr.error) != null ? _d : `OK: ${tr.fetched} fetched, agg +${(_c = agg == null ? void 0 : agg.inserted) != null ? _c : 0}`,
      timeRegistration: tr,
      aggregation: agg
    };
  }
  const r = await syncListEndpoint(db, creds, ep, [ep, `v1/${ep}`]);
  return {
    ok: !r.error && r.fetched > 0,
    jobType: "manual",
    message: (_e = r.error) != null ? _e : `OK: ${r.fetched} rows`,
    master: { endpoints: [{ name: ep, ...r }] }
  };
}

export { eitjeCredentialsHintMessage as a, executeEitjeJob as e, loadActiveEitjeCredentials as l, pingEitjeApi as p, syncEitjeByRequest as s };
//# sourceMappingURL=eitjeSyncService.mjs.map
