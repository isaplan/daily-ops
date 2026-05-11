import { defineEventHandler, getRouterParam, createError, getQuery } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a6 as getNotesCollection, a7 as getUnifiedUsersCollection } from '../../../nitro/nitro.mjs';
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
const _id__get = defineEventHandler(async (event) => {
  var _a;
  const id = getRouterParam(event, "id");
  if (!id || id.trim() === "") {
    throw createError({ statusCode: 400, message: "Invalid note identifier" });
  }
  const fromTrash = getQuery(event).fromTrash === "1" || getQuery(event).fromTrash === "true";
  const coll = await getNotesCollection();
  const filter = isMongoId(id) ? { _id: new ObjectId(id) } : { slug: id };
  const note = await coll.findOne(filter);
  if (!note) {
    throw createError({ statusCode: 404, message: "Note not found" });
  }
  const delAt = note.deleted_at;
  if (delAt != null && !fromTrash) {
    throw createError({ statusCode: 404, message: "Note not found" });
  }
  const noteObj = note;
  const usersColl = await getUnifiedUsersCollection();
  let mentioned_members = [];
  let attending_members = [];
  const mentionedIds = noteObj.mentioned_unified_user_ids;
  const attendingIds = noteObj.attending_unified_user_ids;
  const allUserIds = [...Array.isArray(mentionedIds) ? mentionedIds : [], ...Array.isArray(attendingIds) ? attendingIds : []];
  const uniqueIds = allUserIds.length ? [...new Set(allUserIds.map((id2) => id2.toString()))].map((id2) => new ObjectId(id2)) : [];
  if (uniqueIds.length > 0) {
    const users = await usersColl.find({ _id: { $in: uniqueIds } }).project({ _id: 1, canonicalName: 1 }).toArray();
    const byId = Object.fromEntries(users.map((u) => {
      var _a2;
      return [String(u._id), { _id: String(u._id), canonicalName: (_a2 = u.canonicalName) != null ? _a2 : "Unknown" }];
    }));
    if (Array.isArray(mentionedIds) && mentionedIds.length > 0) {
      mentioned_members = mentionedIds.map((id2) => byId[String(id2)]).filter(Boolean);
    }
    if (Array.isArray(attendingIds) && attendingIds.length > 0) {
      attending_members = attendingIds.map((id2) => byId[String(id2)]).filter(Boolean);
    }
  }
  const fromArray = (_a = noteObj.connected_member_ids) != null ? _a : [];
  const legacyId = noteObj.connected_to && typeof noteObj.connected_to.member_id !== "undefined" ? noteObj.connected_to.member_id : null;
  const idsSet = new Set(fromArray.map((id2) => String(id2)));
  if (legacyId) idsSet.add(String(legacyId));
  const connected_member_ids = [...idsSet];
  return {
    success: true,
    data: {
      ...noteObj,
      mentioned_members,
      attending_members,
      connected_member_ids
    }
  };
});

export { _id__get as default };
//# sourceMappingURL=_id_.get.mjs.map
