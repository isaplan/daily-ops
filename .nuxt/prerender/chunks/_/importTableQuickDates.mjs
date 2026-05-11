const AMS = "Europe/Amsterdam";
function ymdSvSe(d) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: AMS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}
function amsterdamTodayYmd(anchor = /* @__PURE__ */ new Date()) {
  return ymdSvSe(anchor);
}
function amsterdamYmdForOffset(offsetDays, anchor = /* @__PURE__ */ new Date()) {
  const d = new Date(anchor.getTime() + offsetDays * 24 * 60 * 60 * 1e3);
  return ymdSvSe(d);
}

export { amsterdamTodayYmd as a, amsterdamYmdForOffset as b };
//# sourceMappingURL=importTableQuickDates.mjs.map
