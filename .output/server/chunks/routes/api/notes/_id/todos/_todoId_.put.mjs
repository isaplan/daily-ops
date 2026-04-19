import { d as defineEventHandler, C as getRouterParam, c as createError, r as readBody, N as getNotesCollection } from '../../../../../nitro/nitro.mjs';
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
