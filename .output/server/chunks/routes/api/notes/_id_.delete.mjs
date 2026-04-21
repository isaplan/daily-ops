import { d as defineEventHandler, C as getRouterParam, c as createError, S as getNotesCollection } from '../../../nitro/nitro.mjs';
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

function isMongoId(str) {
  return /^[0-9a-f]{24}$/i.test(str);
}
const _id__delete = defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id || id.trim() === "") {
    throw createError({ statusCode: 400, message: "Invalid note identifier" });
  }
  const coll = await getNotesCollection();
  const filter = isMongoId(id) ? { _id: new ObjectId(id) } : { slug: id };
  const existing = await coll.findOne(filter);
  if (!existing) {
    throw createError({ statusCode: 404, message: "Note not found" });
  }
  const del = existing.deleted_at;
  if (del != null) {
    throw createError({ statusCode: 400, message: "Note is already in trash" });
  }
  const now = /* @__PURE__ */ new Date();
  const updated = await coll.findOneAndUpdate(
    filter,
    { $set: { deleted_at: now, updated_at: now } },
    { returnDocument: "after" }
  );
  if (!updated) {
    throw createError({ statusCode: 404, message: "Note not found" });
  }
  return { success: true, data: updated };
});

export { _id__delete as default };
//# sourceMappingURL=_id_.delete.mjs.map
