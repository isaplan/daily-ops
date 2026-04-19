import { d as defineEventHandler, C as getRouterParam, c as createError, r as readBody, T as getMenusCollection } from '../../../../../../nitro/nitro.mjs';
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
