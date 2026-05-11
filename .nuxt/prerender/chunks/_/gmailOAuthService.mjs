import { a as getDb, I as INBOX_COLLECTIONS } from '../nitro/nitro.mjs';

const ACCOUNT_ID = "default";
async function saveGmailRefreshToken(refreshToken) {
  const db = await getDb();
  const col = db.collection(INBOX_COLLECTIONS.gmailOAuthToken);
  await col.updateOne(
    { accountId: ACCOUNT_ID },
    {
      $set: {
        refreshToken,
        updatedAt: /* @__PURE__ */ new Date()
      },
      $setOnInsert: {
        accountId: ACCOUNT_ID,
        createdAt: /* @__PURE__ */ new Date()
      }
    },
    { upsert: true }
  );
}
async function getGmailRefreshToken() {
  var _a;
  const db = await getDb();
  const col = db.collection(INBOX_COLLECTIONS.gmailOAuthToken);
  const doc = await col.findOne({ accountId: ACCOUNT_ID });
  const token = (_a = doc == null ? void 0 : doc.refreshToken) != null ? _a : null;
  console.log("[gmailOAuthService] getGmailRefreshToken found:", !!token, token ? `${token.substring(0, 20)}...` : "null");
  return token;
}
async function isGmailConnected() {
  const token = await getGmailRefreshToken();
  return token !== null && token.length > 0;
}

export { getGmailRefreshToken as g, isGmailConnected as i, saveGmailRefreshToken as s };
//# sourceMappingURL=gmailOAuthService.mjs.map
