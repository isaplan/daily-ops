import { defineEventHandler, setResponseHeader, getQuery } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { p as parseDailyOpsMetricsQuery, a as getDb, f as fetchRevenueByCategoryFromHourAggregates, h as fetchBorkHourAggregatesBundle, q as fetchRevenueByDate, t as fetchLaborByDate, m as buildDailyOpsSummaryDto, u as revenueByTimePeriodFromHourTotals, v as computeMostProfitableHour, V as VAT_DISCLAIMER } from '../../../nitro/nitro.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ufo/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
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

const overview_get = defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "no-store");
  const ctx = parseDailyOpsMetricsQuery(getQuery(event));
  const db = await getDb();
  const [cat, hourBundle, revenueByDate, laborByDate] = await Promise.all([
    fetchRevenueByCategoryFromHourAggregates(db, ctx),
    fetchBorkHourAggregatesBundle(db, ctx),
    fetchRevenueByDate(db, ctx),
    fetchLaborByDate(db, ctx)
  ]);
  const summaryDto = buildDailyOpsSummaryDto(ctx, revenueByDate, laborByDate);
  const totalRevenue = summaryDto.summary.totalRevenue;
  const totalLaborCost = summaryDto.summary.totalLaborCost;
  const profit = summaryDto.summary.profit;
  const profitMarginPct = summaryDto.summary.profitMarginPct;
  const tp = revenueByTimePeriodFromHourTotals(hourBundle.byHourOnly);
  const best = computeMostProfitableHour(hourBundle.byDayHour, revenueByDate, laborByDate);
  const revenueByCategory = [
    { key: "drinks", label: "Drinks", amount: Math.round(cat.drinks * 100) / 100 },
    { key: "food", label: "Food", amount: Math.round(cat.food * 100) / 100 }
  ];
  const revenueByTimePeriod = [
    { key: "lunch", label: "Lunch", amount: Math.round(tp.lunch * 100) / 100 },
    { key: "pre_drinks", label: "Pre Drinks", amount: Math.round(tp.pre_drinks * 100) / 100 },
    { key: "dinner", label: "Dinner", amount: Math.round(tp.dinner * 100) / 100 },
    { key: "after_drinks", label: "After Drinks", amount: Math.round(tp.after_drinks * 100) / 100 }
  ];
  if (tp.other > 0) {
    revenueByTimePeriod.push({
      key: "other",
      label: "Other hours",
      amount: Math.round(tp.other * 100) / 100
    });
  }
  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate
    },
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalLaborCost: Math.round(totalLaborCost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitMarginPct: Math.round(profitMarginPct * 10) / 10
    },
    revenueByCategory,
    revenueByTimePeriod,
    mostProfitableHour: {
      hourLabel: best.hourLabel,
      date: best.date,
      revenue: Math.round(best.revenue * 100) / 100,
      laborCost: Math.round(best.laborCost * 100) / 100,
      profit: Math.round(best.profit * 100) / 100
    },
    vatDisclaimer: VAT_DISCLAIMER
  };
});

export { overview_get as default };
//# sourceMappingURL=overview.get.mjs.map
