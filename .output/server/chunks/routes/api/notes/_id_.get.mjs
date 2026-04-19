import { d as defineEventHandler, C as getRouterParam, c as createError, a as getQuery, N as getNotesCollection, X as getUnifiedUsersCollection } from '../../../nitro/nitro.mjs';
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
