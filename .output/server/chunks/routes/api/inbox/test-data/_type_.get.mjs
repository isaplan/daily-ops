import { d as defineEventHandler, C as getRouterParam, c as createError, a as getQuery, g as getDb } from '../../../../nitro/nitro.mjs';
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

function getCollectionName(type) {
  switch (type) {
    case "sales":
      return "test-bork-sales";
    case "product_mix":
      return "test-bork-product-mix";
    case "food_beverage":
      return "test-bork-food-beverage";
    case "basis_report":
      return "test-basis-report";
    case "product_sales_per_hour":
      return "test-bork-basis-rapport";
    case "hours":
      return "test-eitje-hours";
    case "contracts":
      return "test-eitje-contracts";
    case "finance":
      return "test-eitje-finance";
    case "bi":
      return "power_bi_exports";
    default:
      return "unknown";
  }
}
const _type__get = defineEventHandler(async (event) => {
  try {
    const type = getRouterParam(event, "type");
    const validTypes = [
      "sales",
      "product_mix",
      "food_beverage",
      "basis_report",
      "product_sales_per_hour",
      "hours",
      "contracts",
      "finance",
      "bi"
    ];
    if (!validTypes.includes(type)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid data type. Valid types: ${validTypes.join(", ")}`
      });
    }
    const q = getQuery(event);
    const page = Math.max(1, parseInt(String(q.page || "1"), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(q.limit || "50"), 10)));
    const skip = (page - 1) * limit;
    const filters = {};
    const sourceEmailId = q.sourceEmailId ? String(q.sourceEmailId) : null;
    if (sourceEmailId) {
      try {
        filters.sourceEmailId = new ObjectId(sourceEmailId);
      } catch {
        throw createError({ statusCode: 400, statusMessage: "Invalid sourceEmailId format" });
      }
    }
    const dateFrom = q.dateFrom ? String(q.dateFrom) : null;
    const dateTo = q.dateTo ? String(q.dateTo) : null;
    if (dateFrom || dateTo) {
      filters.parsedAt = {};
      if (dateFrom) {
        filters.parsedAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filters.parsedAt.$lte = new Date(dateTo);
      }
    }
    const db = await getDb();
    const collectionName = getCollectionName(type);
    const collection = db.collection(collectionName);
    const [data, total] = await Promise.all([
      collection.find(filters).sort({ parsedAt: -1, created_at: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filters)
    ]);
    const allColumns = /* @__PURE__ */ new Set();
    data.forEach((doc) => {
      Object.keys(doc).forEach((key) => {
        if (!["_id", "sourceEmailId", "sourceAttachmentId", "sourceFileName", "fileFormat", "parsedAt", "created_at", "updated_at", "__v"].includes(
          key
        )) {
          allColumns.add(key);
        }
      });
    });
    return {
      success: true,
      data: {
        type,
        collectionName,
        rows: data,
        columns: Array.from(allColumns).sort(),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + limit < total
        }
      }
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to fetch test data"
    });
  }
});

export { _type__get as default };
//# sourceMappingURL=_type_.get.mjs.map
