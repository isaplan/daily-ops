import { defineEventHandler, getQuery } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { aa as trashedNotesMatch, ab as activeNotesMatch, a6 as getNotesCollection } from '../../nitro/nitro.mjs';
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

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const index_get = defineEventHandler(async (event) => {
  const query = getQuery(event);
  const archived = query.archived === "true";
  const teamId = query.team_id;
  const locationId = query.location_id;
  const memberId = query.member_id;
  const scope = query.scope;
  query.tag;
  const skip = Math.max(0, Number(query.skip) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
  const scopeTrash = scope === "trash";
  const filter = { is_archived: archived };
  if (scopeTrash) {
    Object.assign(filter, trashedNotesMatch());
  } else {
    Object.assign(filter, activeNotesMatch());
  }
  if (teamId) filter["connected_to.team_id"] = new ObjectId(teamId);
  if (locationId) filter["connected_to.location_id"] = new ObjectId(locationId);
  if (memberId && /^[0-9a-f]{24}$/i.test(memberId)) {
    const oid = new ObjectId(memberId);
    filter.$or = [
      { "connected_to.member_id": oid },
      { connected_member_ids: oid }
    ];
  }
  if (!scopeTrash && scope === "private") {
    filter.$or = [
      { connected_to: { $exists: false } },
      { connected_to: null },
      { "connected_to.team_id": null, "connected_to.location_id": null }
    ];
  } else if (!scopeTrash && scope === "public") {
    filter.$or = [
      { "connected_to.team_id": { $exists: true, $nin: [null, ""] } },
      { "connected_to.location_id": { $exists: true, $nin: [null, ""] } }
    ];
  } else if (!scopeTrash && scope === "drafts") {
    filter.$or = [
      { status: { $exists: false } },
      { status: null },
      { status: "draft" },
      { status: { $ne: "published" } }
    ];
  } else if (!scopeTrash && scope === "published") {
    filter.status = "published";
  }
  const coll = await getNotesCollection();
  const notes = await coll.find(filter).sort({ is_pinned: -1, created_at: -1 }).skip(skip).limit(limit).toArray();
  return { success: true, data: notes };
});

export { index_get as default };
//# sourceMappingURL=index.get3.mjs.map
