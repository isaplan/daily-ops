import { d as defineEventHandler, C as getRouterParam, c as createError, g as getDb } from '../../../nitro/nitro.mjs';
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

const _id__delete = defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Member not found" });
  }
  const db = await getDb();
  const result = await db.collection("members").updateOne(
    { _id: oid },
    { $set: { is_active: false, updated_at: /* @__PURE__ */ new Date() } }
  );
  if (result.matchedCount === 0) {
    throw createError({ statusCode: 404, statusMessage: "Member not found" });
  }
  return { success: true, message: "Member deactivated" };
});

export { _id__delete as default };
//# sourceMappingURL=_id_.delete.mjs.map
