import { d as defineEventHandler, g as getDb, t as findEitjeCredentialDocument, u as documentToCredentialsApiShape } from '../../../../nitro/nitro.mjs';
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

const credentials_get = defineEventHandler(async () => {
  const db = await getDb();
  const row = await findEitjeCredentialDocument(db);
  const credentials = row ? documentToCredentialsApiShape(row) : null;
  return {
    success: true,
    credentials
  };
});

export { credentials_get as default };
//# sourceMappingURL=credentials.get.mjs.map
