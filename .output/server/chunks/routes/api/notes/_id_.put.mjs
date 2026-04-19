import { d as defineEventHandler, C as getRouterParam, c as createError, r as readBody, N as getNotesCollection, Y as collectMentionSlugsFromContent, Z as resolveSlugsToUnifiedUserIds } from '../../../nitro/nitro.mjs';
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
const _id__put = defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id || id.trim() === "") {
    throw createError({ statusCode: 400, message: "Invalid note identifier" });
  }
  const body = await readBody(event);
  if (!body || typeof body !== "object") {
    throw createError({ statusCode: 400, message: "Invalid body" });
  }
  const coll = await getNotesCollection();
  const filter = isMongoId(id) ? { _id: new ObjectId(id) } : { slug: id };
  const existingNote = await coll.findOne(filter);
  if (!existingNote) {
    throw createError({ statusCode: 404, message: "Note not found" });
  }
  if (existingNote.deleted_at != null) {
    throw createError({ statusCode: 400, message: "Cannot edit a note in trash. Restore it first." });
  }
  const update = { updated_at: /* @__PURE__ */ new Date() };
  if (body.title !== void 0) update.title = String(body.title).trim() || "Untitled";
  if (body.content !== void 0) {
    update.content = String(body.content);
    const slugs = collectMentionSlugsFromContent(body.content);
    update.mentioned_unified_user_ids = await resolveSlugsToUnifiedUserIds(slugs);
  }
  if (body.slug !== void 0) update.slug = String(body.slug).trim();
  if (body.location_id !== void 0 || body.team_id !== void 0 || body.member_id !== void 0) {
    const existing = existingNote;
    const existingCt = (existing == null ? void 0 : existing.connected_to) || {};
    update.connected_to = {
      ...existingCt,
      ...body.location_id !== void 0 && {
        location_id: body.location_id ? new ObjectId(body.location_id) : null
      },
      ...body.team_id !== void 0 && {
        team_id: body.team_id ? new ObjectId(body.team_id) : null
      },
      ...body.member_id !== void 0 && {
        member_id: body.member_id ? new ObjectId(body.member_id) : null
      }
    };
  }
  if (body.tags !== void 0) update.tags = Array.isArray(body.tags) ? body.tags : [];
  if (body.status !== void 0) {
    if (body.status !== "draft" && body.status !== "published") {
      throw createError({ statusCode: 400, message: 'status must be "draft" or "published"' });
    }
    update.status = body.status;
  }
  if (body.is_pinned !== void 0) update.is_pinned = Boolean(body.is_pinned);
  if (body.is_archived !== void 0) update.is_archived = Boolean(body.is_archived);
  const result = await coll.findOneAndUpdate(
    filter,
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) {
    throw createError({ statusCode: 404, message: "Note not found" });
  }
  return { success: true, data: result };
});

export { _id__put as default };
//# sourceMappingURL=_id_.put.mjs.map
