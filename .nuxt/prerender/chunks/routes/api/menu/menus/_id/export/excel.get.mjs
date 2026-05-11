import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a3 as getMenusCollection, $ as getMenuItemsCollection, a4 as xlsxExports } from '../../../../../../nitro/nitro.mjs';
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

const SECTION_LABELS = {
  drinks: "Drinks",
  diner: "Diner",
  snacks: "Snacks",
  dessert: "Dessert",
  coursesMenu: "Courses"
};
function getSectionsForExport(menu) {
  var _a;
  if ((_a = menu.menuSections) == null ? void 0 : _a.length) {
    return menu.menuSections.map((s) => ({ name: s.name, productIds: s.productIds || [] }));
  }
  const leg = menu.sections;
  if (!leg) return [];
  return Object.keys(SECTION_LABELS).map((key) => ({
    name: SECTION_LABELS[key],
    productIds: leg[key] || []
  }));
}
function productDisplayName(item) {
  var _a;
  if (!item) return "\u2013";
  const d = item.data;
  if (d && typeof d === "object") {
    const keys = ["Product Kinsbergen", "Product", "Name", "name"];
    for (const k of keys) {
      const v = d[k];
      if (v !== void 0 && v !== null && String(v).trim()) return String(v).trim();
    }
    const first = Object.values(d).find((v) => v != null && String(v).trim());
    if (first != null) return String(first).trim().slice(0, 100);
  }
  return (_a = item.name) != null ? _a : "\u2013";
}
const excel_get = defineEventHandler(async (event) => {
  var _a;
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing menu id" });
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Menu not found" });
  }
  const menusColl = await getMenusCollection();
  const menu = await menusColl.findOne({ _id: oid });
  if (!menu) throw createError({ statusCode: 404, statusMessage: "Menu not found" });
  const itemsColl = await getMenuItemsCollection();
  const sectionsForExport = getSectionsForExport(menu);
  const allIds = /* @__PURE__ */ new Set();
  for (const s of sectionsForExport) {
    for (const id2 of s.productIds) allIds.add(id2);
  }
  const itemsList = allIds.size ? await itemsColl.find({ _id: { $in: Array.from(allIds).map((id2) => new ObjectId(id2)) } }).toArray() : [];
  const itemsById = {};
  for (const doc of itemsList) {
    const sid = (_a = doc._id) == null ? void 0 : _a.toString();
    if (sid) itemsById[sid] = doc;
  }
  const rows = [["Section", "Product"]];
  for (const s of sectionsForExport) {
    for (const productId of s.productIds) {
      const name = productDisplayName(itemsById[productId] || {});
      rows.push([s.name, name]);
    }
  }
  const ws = xlsxExports.utils.aoa_to_sheet(rows);
  const wb = xlsxExports.utils.book_new();
  const sheetName = String(menu.name || "Menu").slice(0, 31);
  xlsxExports.utils.book_append_sheet(wb, ws, sheetName);
  const buf = xlsxExports.write(wb, { type: "buffer", bookType: "xlsx" });
  setResponseHeader(event, "Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  setResponseHeader(
    event,
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(String(menu.name || "menu"))}.xlsx"`
  );
  return buf;
});

export { excel_get as default };
//# sourceMappingURL=excel.get.mjs.map
