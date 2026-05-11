import { defineEventHandler, getRouterParam, createError, readBody } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a6 as getNotesCollection } from '../../../../../nitro/nitro.mjs';
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
const _todoId__put = defineEventHandler(async (event) => {
  var _a, _b;
  const id = getRouterParam(event, "id");
  const todoId = getRouterParam(event, "todoId");
  if (!(id == null ? void 0 : id.trim()) || !(todoId == null ? void 0 : todoId.trim())) {
    throw createError({ statusCode: 400, message: "Invalid note or todo id" });
  }
  const body = await readBody(event);
  if (!body || typeof body.checked !== "boolean") {
    throw createError({ statusCode: 400, message: "Body must include checked: boolean" });
  }
  const coll = await getNotesCollection();
  const filter = isMongoId(id) ? { _id: new ObjectId(id) } : { slug: id };
  const note = await coll.findOne(filter);
  if (!note) throw createError({ statusCode: 404, message: "Note not found" });
  if (note.deleted_at != null) {
    throw createError({ statusCode: 400, message: "Cannot update todos for a note in trash" });
  }
  const raw = ((_a = note.content) != null ? _a : "").trim();
  if (!raw.startsWith('{"version":2') || !raw.includes('"blocks"')) {
    throw createError({ statusCode: 400, message: "Note content is not block format" });
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    throw createError({ statusCode: 400, message: "Invalid note content JSON" });
  }
  if (doc.version !== 2 || !Array.isArray(doc.blocks)) {
    throw createError({ statusCode: 400, message: "Invalid block document" });
  }
  let found = false;
  for (const block of doc.blocks) {
    const todos = (_b = block.todos) != null ? _b : [];
    for (let i = 0; i < todos.length; i++) {
      if (todos[i].id === todoId) {
        found = true;
        todos[i].checked = body.checked;
        if (body.checked) {
          todos[i].doneBy = typeof body.doneBy === "string" ? body.doneBy.trim() : void 0;
          todos[i].doneAt = typeof body.doneAt === "string" ? body.doneAt : (/* @__PURE__ */ new Date()).toISOString();
        } else {
          todos[i].doneBy = void 0;
          todos[i].doneAt = void 0;
        }
        break;
      }
    }
    if (found) break;
  }
  if (!found) throw createError({ statusCode: 404, message: "Todo not found in note" });
  const newContent = JSON.stringify(doc);
  await coll.updateOne(filter, { $set: { content: newContent, updated_at: /* @__PURE__ */ new Date() } });
  return { success: true };
});

export { _todoId__put as default };
//# sourceMappingURL=_todoId_.put.mjs.map
