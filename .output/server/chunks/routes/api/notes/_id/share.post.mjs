import { d as defineEventHandler, C as getRouterParam, c as createError, S as getNotesCollection, a0 as getUnifiedUsersCollection } from '../../../../nitro/nitro.mjs';
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
