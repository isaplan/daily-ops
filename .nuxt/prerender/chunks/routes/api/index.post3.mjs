import { defineEventHandler, readBody } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a9 as resolveSlugsToUnifiedUserIds, a8 as collectMentionSlugsFromContent, a6 as getNotesCollection } from '../../nitro/nitro.mjs';
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

function generateSlug(title) {
  return title.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
const index_post = defineEventHandler(async (event) => {
  var _a, _b, _c, _d, _e;
  const body = await readBody(event);
  const title = (body == null ? void 0 : body.title) && String(body.title).trim() || "Untitled";
  const content = (body == null ? void 0 : body.content) != null ? String(body.content) : "";
  const slug = ((_a = body == null ? void 0 : body.slug) == null ? void 0 : _a.trim()) || generateSlug(title);
  const authorId = (_b = body == null ? void 0 : body.author_id) == null ? void 0 : _b.trim();
  const locationId = (_c = body == null ? void 0 : body.location_id) == null ? void 0 : _c.trim();
  const teamId = (_d = body == null ? void 0 : body.team_id) == null ? void 0 : _d.trim();
  const memberId = (_e = body == null ? void 0 : body.member_id) == null ? void 0 : _e.trim();
  const tags = Array.isArray(body == null ? void 0 : body.tags) ? body.tags : [];
  const isPinned = Boolean(body == null ? void 0 : body.is_pinned);
  const visibleToSameTeamName = Boolean(body == null ? void 0 : body.visible_to_same_team_name);
  const attendingIds = Array.isArray(body == null ? void 0 : body.attending_unified_user_ids) ? body.attending_unified_user_ids.filter((id) => typeof id === "string" && /^[0-9a-f]{24}$/i.test(id)) : [];
  const memberIds = Array.isArray(body == null ? void 0 : body.member_ids) ? body.member_ids.filter((id) => typeof id === "string" && /^[0-9a-f]{24}$/i.test(id)) : [];
  const now = /* @__PURE__ */ new Date();
  const connectedTo = {};
  if (locationId) connectedTo.location_id = new ObjectId(locationId);
  if (teamId) connectedTo.team_id = new ObjectId(teamId);
  if (memberId) connectedTo.member_id = new ObjectId(memberId);
  const mentioned_unified_user_ids = content ? await resolveSlugsToUnifiedUserIds(collectMentionSlugsFromContent(content)) : [];
  const doc = {
    title,
    content,
    slug,
    author_id: authorId ? new ObjectId(authorId) : null,
    connected_to: connectedTo,
    connected_members: [],
    linked_todos: [],
    mentioned_unified_user_ids,
    attending_unified_user_ids: attendingIds.map((id) => new ObjectId(id)),
    connected_member_ids: memberIds.map((id) => new ObjectId(id)),
    tags,
    visible_to_same_team_name: visibleToSameTeamName,
    is_pinned: isPinned,
    is_archived: false,
    status: "draft",
    deleted_at: null,
    created_at: now,
    updated_at: now
  };
  const coll = await getNotesCollection();
  const { insertedId } = await coll.insertOne(doc);
  const note = await coll.findOne({ _id: insertedId });
  return { success: true, data: note };
});

export { index_post as default };
//# sourceMappingURL=index.post3.mjs.map
