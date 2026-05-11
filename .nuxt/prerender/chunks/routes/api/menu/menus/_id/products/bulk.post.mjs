import { defineEventHandler, getRouterParam, createError, readBody } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a3 as getMenusCollection } from '../../../../../../nitro/nitro.mjs';
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

function ensureObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid menu id" });
  }
}
const bulk_post = defineEventHandler(async (event) => {
  var _a, _b, _c;
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing menu id" });
  const oid = ensureObjectId(id);
  const body = await readBody(event);
  const sectionId = body == null ? void 0 : body.sectionId;
  const subsectionId = body == null ? void 0 : body.subsectionId;
  const productIds = Array.isArray(body == null ? void 0 : body.productIds) ? body.productIds.filter((x) => typeof x === "string") : [];
  if (!sectionId || productIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "sectionId and non-empty productIds required" });
  }
  const coll = await getMenusCollection();
  const menu = await coll.findOne({ _id: oid });
  if (!menu) throw createError({ statusCode: 404, statusMessage: "Menu not found" });
  const updates = { updatedAt: /* @__PURE__ */ new Date() };
  if ((_a = menu.menuSectionsV2) == null ? void 0 : _a.length) {
    const sections = JSON.parse(JSON.stringify(menu.menuSectionsV2));
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) throw createError({ statusCode: 400, statusMessage: "Section not found" });
    if (subsectionId) {
      const sub = (_b = sec.subsections) == null ? void 0 : _b.find((s) => s.id === subsectionId);
      if (!sub) throw createError({ statusCode: 400, statusMessage: "Subsection not found" });
      const set = new Set(sub.productIds || []);
      for (const pid of productIds) set.add(pid);
      sub.productIds = Array.from(set);
    } else {
      const firstSub = (_c = sec.subsections) == null ? void 0 : _c[0];
      if (firstSub) {
        const set = new Set(firstSub.productIds || []);
        for (const pid of productIds) set.add(pid);
        firstSub.productIds = Array.from(set);
      } else {
        sec.subsections = [{ id: `sub-${Date.now()}`, name: sec.name, productIds: [...productIds] }];
      }
    }
    updates.menuSectionsV2 = sections;
  } else {
    const sections = JSON.parse(JSON.stringify(menu.menuSections || []));
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) throw createError({ statusCode: 400, statusMessage: "Section not found" });
    const set = new Set(sec.productIds || []);
    for (const pid of productIds) set.add(pid);
    sec.productIds = Array.from(set);
    updates.menuSections = sections;
  }
  await coll.updateOne({ _id: oid }, { $set: updates });
  return { success: true, added: productIds.length };
});

export { bulk_post as default };
//# sourceMappingURL=bulk.post.mjs.map
