import { ae as defineTask } from '../nitro/nitro.mjs';
import { r as runInboxGmailSync } from '../_/inboxSyncService.mjs';
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
import '../_/inboxProcessService.mjs';
import '../_/documentParserService.mjs';
import '../_/rawDataStorageService.mjs';
import '../_/inboxRepository.mjs';

const gmailSync = defineTask({
  meta: {
    name: "inbox:gmail-sync",
    description: "Scheduled Gmail inbox fetch (same as POST /api/inbox/sync)"
  },
  async run() {
    const maxResults = parseInt(process.env.INBOX_SYNC_MAX_RESULTS || "100", 10);
    const capped = Number.isFinite(maxResults) ? Math.min(500, Math.max(1, maxResults)) : 100;
    try {
      const result = await runInboxGmailSync({ maxResults: capped });
      return { result: result.data };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { result: { ok: false, error: message } };
    }
  }
});

export { gmailSync as default };
//# sourceMappingURL=gmail-sync.mjs.map
