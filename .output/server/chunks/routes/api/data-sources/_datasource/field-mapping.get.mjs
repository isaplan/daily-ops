import { d as defineEventHandler, c as createError, g as getDb } from '../../../../nitro/nitro.mjs';
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

const fieldMapping_get = defineEventHandler(async (event) => {
  var _a;
  const dataSource = (((_a = event.context.params) == null ? void 0 : _a.datasource) || "").toLowerCase();
  if (dataSource !== "eitje" && dataSource !== "bork") {
    throw createError({ statusCode: 400, statusMessage: "Invalid datasource" });
  }
  const db = await getDb();
  const rows = await db.collection("data_source_mappings").find({ dataSource }).sort({ sourceField: 1 }).toArray();
  return {
    success: true,
    mappings: rows.map((row) => ({
      sourceField: row.sourceField,
      targetField: row.targetField,
      dataType: row.dataType,
      transformation: row.transformation,
      isRequired: Boolean(row.isRequired)
    }))
  };
});

export { fieldMapping_get as default };
//# sourceMappingURL=field-mapping.get.mjs.map
