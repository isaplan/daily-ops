<template>
  <DailyOpsInboxImportTableView
    api-path="/api/inbox/bork/sales"
    title="Bork — Sales"
    description="Trivec-style Sales files are flattened: each category / product / amount line becomes one row in inbox-bork-sales, so one report can be thousands of rows while the PDF header shows one date range. Filter by report date below."
  />
</template>
