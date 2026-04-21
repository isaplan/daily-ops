import { d as defineEventHandler, r as readBody, c as createError, g as getDb } from '../../../../nitro/nitro.mjs';
import 'mongodb';
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

const credentials_post = defineEventHandler(async (event) => {
  var _a;
  const body = await readBody(event);
  if (!((_a = body == null ? void 0 : body.additionalConfig) == null ? void 0 : _a.partner_username) || !body.additionalConfig.partner_password || !body.additionalConfig.api_username || !body.additionalConfig.api_password) {
    throw createError({ statusCode: 400, statusMessage: "All credentials are required" });
  }
  const db = await getDb();
  await db.collection("api_credentials").updateMany(
    { provider: "eitje" },
    { $set: { isActive: false, updatedAt: /* @__PURE__ */ new Date() } }
  );
  const newCred = {
    provider: "eitje",
    isActive: true,
    baseUrl: body.baseUrl || "https://open-api.eitje.app/open_api",
    additionalConfig: {
      partner_username: body.additionalConfig.partner_username,
      partner_password: body.additionalConfig.partner_password,
      api_username: body.additionalConfig.api_username,
      api_password: body.additionalConfig.api_password
    },
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  };
  await db.collection("api_credentials").insertOne(newCred);
  return { success: true, message: "Credentials saved successfully" };
});

export { credentials_post as default };
//# sourceMappingURL=credentials.post.mjs.map
