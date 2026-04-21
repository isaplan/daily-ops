import { d as defineEventHandler, C as getRouterParam, c as createError, Z as getMenusCollection } from '../../../../nitro/nitro.mjs';
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

const _id__get = defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing menu id" });
  }
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Menu not found" });
  }
  const coll = await getMenusCollection();
  const doc = await coll.findOne({ _id: oid });
  if (!doc) {
    return { success: true, data: null };
  }
  const { _id, ...rest } = doc;
  return { success: true, data: { _id: _id == null ? void 0 : _id.toString(), ...rest } };
});

export { _id__get as default };
//# sourceMappingURL=_id_.get.mjs.map
