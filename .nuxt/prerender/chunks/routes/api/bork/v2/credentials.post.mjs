import { defineEventHandler, readBody, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { a as getDb } from '../../../../nitro/nitro.mjs';
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

const credentials_post = defineEventHandler(async (event) => {
  const body = await readBody(event);
  const db = await getDb();
  if (body.delete) {
    if (!body._id) throw createError({ statusCode: 400, statusMessage: "_id is required for delete" });
    const deleteQuery = ObjectId.isValid(body._id) ? { _id: new ObjectId(body._id) } : { _id: body._id };
    await db.collection("api_credentials").deleteOne(deleteQuery);
    return { success: true, message: "Credential deleted" };
  }
  if (!body.locationId || !body.baseUrl) {
    throw createError({ statusCode: 400, statusMessage: "locationId and baseUrl are required" });
  }
  let locationObjectId;
  try {
    locationObjectId = new ObjectId(body.locationId);
  } catch {
    const loc2 = await db.collection("locations").findOne({
      "systemMappings.externalId": body.locationId,
      "systemMappings.system": "bork"
    });
    if (!loc2) {
      throw createError({ statusCode: 404, statusMessage: "Location not found" });
    }
    locationObjectId = loc2._id;
  }
  const hasApiKey = typeof body.apiKey === "string" && body.apiKey.trim() !== "";
  let locationName = null;
  const loc = await db.collection("locations").findOne({ _id: locationObjectId });
  if (loc && typeof loc.name === "string") locationName = loc.name;
  const update = {
    provider: "bork",
    locationId: locationObjectId,
    baseUrl: body.baseUrl.trim(),
    isActive: true,
    updatedAt: /* @__PURE__ */ new Date()
  };
  if (locationName) update.locationName = locationName;
  if (hasApiKey) update.apiKey = body.apiKey.trim();
  if (body._id) {
    const existing = await db.collection("api_credentials").findOne(
      ObjectId.isValid(body._id) ? { _id: new ObjectId(body._id) } : { _id: body._id }
    );
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: "Credential not found" });
    }
    if (!hasApiKey && !existing.apiKey) {
      throw createError({ statusCode: 400, statusMessage: "API key is required" });
    }
    await db.collection("api_credentials").updateOne(
      ObjectId.isValid(body._id) ? { _id: new ObjectId(body._id) } : { _id: body._id },
      { $set: update }
    );
    return { success: true, message: "Credential updated" };
  }
  if (!hasApiKey) {
    throw createError({ statusCode: 400, statusMessage: "API key is required when adding a new location" });
  }
  await db.collection("api_credentials").insertOne({
    ...update,
    locationName: locationName != null ? locationName : void 0,
    apiKey: body.apiKey.trim(),
    createdAt: /* @__PURE__ */ new Date()
  });
  return { success: true, message: "Credential created" };
});

export { credentials_post as default };
//# sourceMappingURL=credentials.post.mjs.map
