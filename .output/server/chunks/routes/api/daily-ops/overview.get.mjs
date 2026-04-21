import { d as defineEventHandler, s as setResponseHeader, p as parseDailyOpsMetricsQuery, a as getQuery, g as getDb, f as fetchRevenueByCategoryFromHourAggregates, e as fetchBorkHourAggregatesBundle, l as fetchRevenueByDate, m as fetchLaborByDate, i as buildDailyOpsSummaryDto, n as revenueByTimePeriodFromHourTotals, o as computeMostProfitableHour, V as VAT_DISCLAIMER } from '../../../nitro/nitro.mjs';
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

const overview_get = defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "private, max-age=30, stale-while-revalidate=120");
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
