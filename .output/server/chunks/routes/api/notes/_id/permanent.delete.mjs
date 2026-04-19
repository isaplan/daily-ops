import { d as defineEventHandler, C as getRouterParam, c as createError, N as getNotesCollection } from '../../../../nitro/nitro.mjs';
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

function isMongoId(str) {
  return /^[0-9a-f]{24}$/i.test(str);
}
const permanent_delete = defineEventHandler(async (event) => {
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
  if (del == null) {
    throw createError({
      statusCode: 400,
      message: "Move the note to trash before deleting permanently"
    });
  }
  const result = await coll.deleteOne(filter);
  if (result.deletedCount === 0) {
    throw createError({ statusCode: 404, message: "Note not found" });
  }
  return { success: true, message: "Note permanently deleted" };
});

export { permanent_delete as default };
//# sourceMappingURL=permanent.delete.mjs.map
