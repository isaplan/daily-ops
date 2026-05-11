import { defineEventHandler, getRouterParam, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a6 as getNotesCollection, a7 as getUnifiedUsersCollection } from '../../../../nitro/nitro.mjs';
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

function isMongoId(str) {
  return /^[0-9a-f]{24}$/i.test(str);
}
const share_post = defineEventHandler(async (event) => {
  var _a, _b;
  const id = getRouterParam(event, "id");
  if (!id || id.trim() === "") {
    throw createError({ statusCode: 400, message: "Invalid note identifier" });
  }
  const coll = await getNotesCollection();
  const filter = isMongoId(id) ? { _id: new ObjectId(id) } : { slug: id };
  const note = await coll.findOne(filter);
  if (!note) {
    throw createError({ statusCode: 404, message: "Note not found" });
  }
  if (note.deleted_at != null) {
    throw createError({ statusCode: 400, message: "Cannot share a note that is in trash" });
  }
  const noteObj = note;
  const mentionedIds = (_a = noteObj.mentioned_unified_user_ids) != null ? _a : [];
  const attendingIds = (_b = noteObj.attending_unified_user_ids) != null ? _b : [];
  const allIds = [...new Set([...mentionedIds, ...attendingIds].map((x) => x.toString()))].map((x) => new ObjectId(x));
  if (allIds.length === 0) {
    return { success: true, data: { recipients: [], noteTitle: noteObj.title } };
  }
  const usersColl = await getUnifiedUsersCollection();
  const users = await usersColl.find({ _id: { $in: allIds } }).project({ _id: 1, canonicalName: 1, primaryEmail: 1 }).toArray();
  const recipients = users.filter((u) => typeof u.primaryEmail === "string" && u.primaryEmail.trim() !== "").map((u) => {
    var _a2;
    return { _id: String(u._id), name: (_a2 = u.canonicalName) != null ? _a2 : "", email: u.primaryEmail.trim() };
  });
  return {
    success: true,
    data: {
      recipients,
      noteTitle: noteObj.title,
      noteId: id
    }
  };
});

export { share_post as default };
//# sourceMappingURL=share.post.mjs.map
