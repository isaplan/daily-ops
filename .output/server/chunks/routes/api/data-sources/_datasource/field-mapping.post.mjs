import { d as defineEventHandler, c as createError, r as readBody, g as getDb } from '../../../../nitro/nitro.mjs';
import 'mongodb';
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

const fieldMapping_post = defineEventHandler(async (event) => {
  var _a, _b, _c, _d, _e;
  const dataSource = (((_a = event.context.params) == null ? void 0 : _a.datasource) || "").toLowerCase();
  if (dataSource !== "eitje" && dataSource !== "bork") {
    throw createError({ statusCode: 400, statusMessage: "Invalid datasource" });
  }
  const body = await readBody(event);
  if (!((_b = body == null ? void 0 : body.sourceField) == null ? void 0 : _b.trim())) {
    throw createError({ statusCode: 400, statusMessage: "sourceField is required" });
  }
  const db = await getDb();
  const collection = db.collection("data_source_mappings");
  if (body.delete) {
    await collection.deleteOne({
      dataSource,
      sourceField: body.sourceField.trim()
    });
    return { success: true, message: "Mapping deleted" };
  }
  if (!((_c = body.targetField) == null ? void 0 : _c.trim())) {
    throw createError({ statusCode: 400, statusMessage: "targetField is required" });
  }
  const now = /* @__PURE__ */ new Date();
  await collection.updateOne(
    {
      dataSource,
      sourceField: body.sourceField.trim()
    },
    {
      $set: {
        targetField: body.targetField.trim(),
        dataType: (_d = body.dataType) != null ? _d : "string",
        transformation: ((_e = body.transformation) == null ? void 0 : _e.trim()) || null,
        isRequired: Boolean(body.isRequired),
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true }
  );
  return { success: true, message: "Mapping saved" };
});

export { fieldMapping_post as default };
//# sourceMappingURL=field-mapping.post.mjs.map
