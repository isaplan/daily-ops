import { d as defineEventHandler, r as readBody, g as getDb, c as createError } from '../../../../nitro/nitro.mjs';
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
