import { d as defineEventHandler, r as readBody, c as createError, Z as getMenusCollection } from '../../../nitro/nitro.mjs';
import { ObjectId } from 'mongodb';
import 'papaparse';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'fs';
import 'stream';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'path';
import 'googleapis';
import 'node:url';
import '@iconify/utils';
import 'consola';
import 'node:module';

const menus_post = defineEventHandler(async (event) => {
  const body = await readBody(event);
  const name = typeof (body == null ? void 0 : body.name) === "string" ? body.name.trim() : "";
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "Name is required" });
  }
  const now = /* @__PURE__ */ new Date();
  const startDate = typeof (body == null ? void 0 : body.startDate) === "string" ? body.startDate.trim() || void 0 : void 0;
  const location = typeof (body == null ? void 0 : body.location) === "string" ? body.location.trim() || void 0 : void 0;
  const coll = await getMenusCollection();
  const doc = {
    _id: new ObjectId(),
    name,
    startDate,
    location,
    menuSections: [],
    createdAt: now,
    updatedAt: now
  };
  await coll.insertOne(doc);
  return {
    success: true,
    data: {
      _id: doc._id.toString(),
      name: doc.name,
      startDate: doc.startDate,
      location: doc.location,
      menuSections: doc.menuSections,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }
  };
});

export { menus_post as default };
//# sourceMappingURL=menus.post.mjs.map
