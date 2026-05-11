import { defineEventHandler, getRouterParam, createError, readBody } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a6 as getNotesCollection, a8 as collectMentionSlugsFromContent, a9 as resolveSlugsToUnifiedUserIds } from '../../../nitro/nitro.mjs';
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
