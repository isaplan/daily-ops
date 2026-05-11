import { defineEventHandler, getQuery, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a as getDb, I as INBOX_COLLECTIONS, ac as mapBasisReportXLSX } from '../../../nitro/nitro.mjs';
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

const STALE_LOCATIONS = ["Unknown", "Unspecified", "UNKNOWN"];
async function backfillBasisReportsFromParsedData(options = {}) {
  var _a, _b, _c, _d;
  const dryRun = Boolean(options.dryRun);
  const cleanupStaleLegacy = options.cleanupStaleLegacy !== false;
  const db = await getDb();
  const parsedCol = db.collection(INBOX_COLLECTIONS.parsedData);
  const grouped = await parsedCol.aggregate([
    { $match: { documentType: "basis_report" } },
    { $sort: { extractedAt: -1, _id: -1 } },
    {
      $group: {
        _id: "$attachmentId",
        doc: { $first: "$$ROOT" }
      }
    }
  ]).toArray();
  let processed = 0;
  let upserted = 0;
  let skipped = 0;
  const errors = [];
  for (const g of grouped) {
    const doc = g.doc;
    const rawAtt = (_a = doc == null ? void 0 : doc.attachmentId) != null ? _a : g._id;
    if (rawAtt == null || rawAtt === "") {
      skipped++;
      continue;
    }
    const attachmentIdStr = String(rawAtt);
    processed++;
    try {
      const attOid = rawAtt instanceof ObjectId ? rawAtt : new ObjectId(attachmentIdStr);
      const attachment = await db.collection(INBOX_COLLECTIONS.emailAttachment).findOne({ _id: attOid });
      const emailOidRaw = (_b = doc == null ? void 0 : doc.emailId) != null ? _b : attachment == null ? void 0 : attachment.emailId;
      const emailOid = emailOidRaw instanceof ObjectId ? emailOidRaw : emailOidRaw ? new ObjectId(String(emailOidRaw)) : null;
      const email = emailOid ? await db.collection(INBOX_COLLECTIONS.inboxEmail).findOne({ _id: emailOid }) : null;
      const data = doc == null ? void 0 : doc.data;
      const headers = Array.isArray(data == null ? void 0 : data.headers) ? data.headers : [];
      const rows = Array.isArray(data == null ? void 0 : data.rows) ? data.rows : [];
      const rowCount = rows.length;
      const parseResult = {
        success: true,
        format: (doc == null ? void 0 : doc.format) || "xlsx",
        headers,
        rows,
        rowCount,
        metadata: (_c = data == null ? void 0 : data.metadata) != null ? _c : {}
      };
      const fileName = (attachment == null ? void 0 : attachment.fileName) != null ? String(attachment.fileName) : "basis.xlsx";
      const basisReport = await mapBasisReportXLSX(
        parseResult,
        fileName,
        {
          subject: (email == null ? void 0 : email.subject) != null ? String(email.subject) : void 0,
          receivedAt: (email == null ? void 0 : email.receivedAt) instanceof Date ? email.receivedAt : (email == null ? void 0 : email.receivedAt) != null ? new Date(String(email.receivedAt)) : void 0,
          emailId: emailOid ? String(emailOid) : void 0,
          attachmentId: attachmentIdStr
        },
        db
      );
      if (!basisReport) {
        errors.push({ attachmentId: attachmentIdStr, message: "Mapper returned null (empty or invalid rows)" });
        continue;
      }
      if (!dryRun) {
        await db.collection("inbox-bork-basis-report").updateOne(
          { "metadata.source_attachment_id": attachmentIdStr },
          { $set: { ...basisReport, updated_at: /* @__PURE__ */ new Date() } },
          { upsert: true }
        );
      }
      upserted++;
    } catch (e) {
      errors.push({
        attachmentId: attachmentIdStr,
        message: e instanceof Error ? e.message : String(e)
      });
    }
  }
  let staleLegacyRemoved = 0;
  if (!dryRun && cleanupStaleLegacy) {
    const r = await db.collection("inbox-bork-basis-report").deleteMany({
      location: { $in: [...STALE_LOCATIONS] },
      "metadata.source_attachment_id": { $exists: false }
    });
    staleLegacyRemoved = (_d = r.deletedCount) != null ? _d : 0;
  }
  return {
    parsedGroups: grouped.length,
    processed,
    upserted,
    skipped,
    staleLegacyRemoved,
    errors
  };
}

const backfillBasisReports_post = defineEventHandler(async (event) => {
  try {
    const q = getQuery(event);
    const dryRun = q.dryRun === "true" || q.dryRun === "1";
    const cleanupStaleLegacy = !(q.cleanupStaleLegacy === "false" || q.cleanupStaleLegacy === "0");
    const result = await backfillBasisReportsFromParsedData({ dryRun, cleanupStaleLegacy });
    return {
      success: true,
      dryRun,
      cleanupStaleLegacy,
      ...result
    };
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : "Basis report backfill failed"
    });
  }
});

export { backfillBasisReports_post as default };
//# sourceMappingURL=backfill-basis-reports.post.mjs.map
