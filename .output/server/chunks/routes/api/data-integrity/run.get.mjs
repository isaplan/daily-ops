import { d as defineEventHandler, a as getQuery, c as createError } from '../../../nitro/nitro.mjs';
import { a as runIntegrityChecks } from '../../../_/dataIntegrityService.mjs';
import 'mongodb';
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

const VALID_CHECKS = ["duplicates_raw", "duplicates_aggregation", "normalization", "sums"];
const run_get = defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const startDate = query.startDate;
    const endDate = query.endDate;
    const checksParam = query.checks;
    const endpoint = query.endpoint || "time_registration_shifts";
    const duplicateLimit = query.duplicateLimit != null ? Number(query.duplicateLimit) : 50;
    const sumsTolerance = query.sumsTolerance != null ? Number(query.sumsTolerance) : 0.02;
    let checks;
    if (checksParam) {
      const requested = checksParam.split(",").map((c) => c.trim()).filter(Boolean);
      const valid = requested.filter((c) => VALID_CHECKS.includes(c));
      if (valid.length > 0) checks = valid;
    }
    const report = await runIntegrityChecks({
      startDate,
      endDate,
      endpoint,
      checks,
      duplicateLimit,
      sumsTolerance
    });
    return { success: true, report };
  } catch (error) {
    console.error("[data-integrity/run]", error);
    throw createError({
      statusCode: 500,
      message: "Integrity check failed"
    });
  }
});

export { run_get as default };
//# sourceMappingURL=run.get.mjs.map
