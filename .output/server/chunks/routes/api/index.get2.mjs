import { d as defineEventHandler, g as getDb } from '../../nitro/nitro.mjs';
import 'mongodb';
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

const index_get = defineEventHandler(async () => {
  const db = await getDb();
  const members = await db.collection("members").find({}).sort({ name: 1 }).toArray();
  const data = members.map((m) => {
    var _a, _b, _c, _d, _e;
    const nameVal = (_e = (_d = (_c = (_b = (_a = m.name) != null ? _a : m.Name) != null ? _b : m.naam) != null ? _c : m.displayName) != null ? _d : m.full_name) != null ? _e : m.title;
    const name = typeof nameVal === "string" ? nameVal.trim() : "";
    const isActive = m.is_active !== false && m.isActive !== false;
    return {
      _id: String(m._id),
      name: name || `Member ${String(m._id).slice(-6)}`,
      email: (typeof m.email === "string" ? m.email : "") || "",
      slack_username: typeof m.slack_username === "string" ? m.slack_username : void 0,
      is_active: isActive
    };
  });
  return { success: true, data };
});

export { index_get as default };
//# sourceMappingURL=index.get2.mjs.map
