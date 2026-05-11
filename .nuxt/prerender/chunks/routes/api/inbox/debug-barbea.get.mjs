import { defineEventHandler } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';

const debugBarbea_get = defineEventHandler(async () => {
  try {
    const { getDb } = await import('../../../nitro/nitro.mjs').then(function (n) { return n.ar; });
    const db = await getDb();
    const records = await db.collection("inbox-bork-basis-report").find({
      location: { $regex: /Barbea/i },
      date: "2026-05-05"
    }).toArray();
    return {
      found: records.length,
      records: records.map((r) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i;
        return {
          date: r.date,
          location: r.location,
          business_hour: r.business_hour,
          final_revenue_incl_vat: r.final_revenue_incl_vat,
          final_revenue_ex_vat: r.final_revenue_ex_vat,
          netto_grand_total_qty: (_c = (_b = (_a = r.sections) == null ? void 0 : _a.netto_sales) == null ? void 0 : _b.grand_total) == null ? void 0 : _c.quantity,
          netto_grand_total_incl: (_f = (_e = (_d = r.sections) == null ? void 0 : _d.netto_sales) == null ? void 0 : _e.grand_total) == null ? void 0 : _f.price_incl_vat,
          netto_grand_total_ex: (_i = (_h = (_g = r.sections) == null ? void 0 : _g.netto_sales) == null ? void 0 : _h.grand_total) == null ? void 0 : _i.price_ex_vat
        };
      })
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

export { debugBarbea_get as default };
//# sourceMappingURL=debug-barbea.get.mjs.map
