import { defineEventHandler, getRouterParam, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a6 as getNotesCollection, ab as activeNotesMatch } from '../../../../nitro/nitro.mjs';
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

const BLOCK_DOC_PREFIX = '{"version":2';
function isBlockNoteContent(content) {
  const t = (content != null ? content : "").trim();
  return t.startsWith(BLOCK_DOC_PREFIX) && t.includes('"blocks"');
}
function parseBlockNoteContent(content) {
  if (!isBlockNoteContent(content)) return null;
  try {
    const doc = JSON.parse(content);
    if (doc.version === 2 && Array.isArray(doc.blocks)) {
      return doc.blocks.map((b) => ({
        ...b,
        agrees: Array.isArray(b.agrees) ? b.agrees : []
      }));
    }
  } catch {
    return null;
  }
  return null;
}

const NOTES_LIMIT = 50;
const DETAIL_SLICE = 5;
const connections_get = defineEventHandler(async (event) => {
  var _a, _b, _c;
  const id = getRouterParam(event, "id");
  if (!id || !/^[0-9a-f]{24}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid member id" });
  }
  const oid = new ObjectId(id);
  const coll = await getNotesCollection();
  const notes = await coll.find({
    is_archived: { $ne: true },
    ...activeNotesMatch(),
    $or: [{ "connected_to.member_id": oid }, { connected_member_ids: oid }]
  }).sort({ is_pinned: -1, created_at: -1 }).limit(NOTES_LIMIT).toArray();
  const notesList = notes.map((n) => {
    var _a2;
    return {
      _id: String(n._id),
      slug: n.slug,
      title: n.title || "Untitled",
      content: typeof n.content === "string" ? n.content.slice(0, 200) : "",
      created_at: (_a2 = n.created_at) != null ? _a2 : null
    };
  });
  const todosList = [];
  const decisionsList = [];
  for (const note of notes) {
    const content = note.content;
    if (!content) continue;
    const blocks = parseBlockNoteContent(content);
    if (!(blocks == null ? void 0 : blocks.length)) continue;
    const noteId = String(note._id);
    const noteSlug = note.slug;
    const noteTitle = note.title || "Untitled";
    for (const block of blocks) {
      for (const t of (_a = block.todos) != null ? _a : []) {
        todosList.push({
          _id: t.id,
          text: t.text,
          checked: (_b = t.checked) != null ? _b : false,
          noteId,
          noteSlug,
          noteTitle
        });
      }
      for (const a of (_c = block.agrees) != null ? _c : []) {
        decisionsList.push({
          _id: a.id,
          text: a.text,
          noteId,
          noteSlug,
          noteTitle
        });
      }
    }
  }
  return {
    success: true,
    data: {
      notes: notesList.length,
      todos: todosList.length,
      decisions: decisionsList.length,
      channels: 0,
      details: {
        notes: notesList.slice(0, DETAIL_SLICE),
        todos: todosList.slice(0, DETAIL_SLICE),
        decisions: decisionsList.slice(0, DETAIL_SLICE),
        channels: []
      }
    }
  };
});

export { connections_get as default };
//# sourceMappingURL=connections.get.mjs.map
