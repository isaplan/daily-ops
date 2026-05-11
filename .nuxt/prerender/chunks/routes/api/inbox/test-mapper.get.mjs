import { defineEventHandler } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';

const testMapper_get = defineEventHandler(async () => {
  try {
    const { getDb } = await import('../../../nitro/nitro.mjs').then(function (n) { return n.ar; });
    const { mapBasisReportXLSX } = await import('../../../nitro/nitro.mjs').then(function (n) { return n.at; });
    const db = await getDb();
    const mockParseResult = {
      success: true,
      documentType: "basis_report",
      format: "xlsx",
      headers: ["Col1", "Col2"],
      rows: [{ Col1: "test", Col2: "data" }],
      rowCount: 1,
      metadata: {}
    };
    const basisReport = await mapBasisReportXLSX(
      mockParseResult,
      "test.xlsx",
      {
        subject: "Daily Report Sales Yesterday Barbea - report from 04/05/2026",
        receivedAt: /* @__PURE__ */ new Date()
      },
      db
    );
    if (!basisReport) {
      return { error: "Mapper returned null" };
    }
    const result = await db.collection("inbox-bork-basis-report").updateOne(
      { date: basisReport.date, location: basisReport.location },
      { $set: { ...basisReport, updated_at: /* @__PURE__ */ new Date() } },
      { upsert: true }
    );
    return {
      mapperReturned: { date: basisReport.date, location: basisReport.location, revenue: basisReport.final_revenue_incl_vat },
      upsertResult: { matchedCount: result.matchedCount, upsertedId: result.upsertedId ? String(result.upsertedId) : null }
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

export { testMapper_get as default };
//# sourceMappingURL=test-mapper.get.mjs.map
