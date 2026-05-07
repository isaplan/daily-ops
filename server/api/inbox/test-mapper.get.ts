// Test endpoint to directly test mapper + upsert
export default defineEventHandler(async () => {
  try {
    const { getDb } = await import('../../utils/db')
    const { mapBasisReportXLSX } = await import('../../utils/inbox/basis-report-mapper')
    
    const db = await getDb()

    // Create mock parseResult
    const mockParseResult = {
      success: true,
      documentType: 'basis_report' as const,
      format: 'xlsx' as const,
      headers: ['Col1', 'Col2'],
      rows: [{Col1: 'test', Col2: 'data'}],
      rowCount: 1,
      metadata: {},
    }

    // Call mapper
    const basisReport = await mapBasisReportXLSX(
      mockParseResult,
      'test.xlsx',
      {
        subject: 'Daily Report Sales Yesterday Barbea - report from 04/05/2026',
        receivedAt: new Date(),
      },
      db
    )

    if (!basisReport) {
      return { error: 'Mapper returned null' }
    }

    // Try upsert
    const result = await db.collection('inbox-bork-basis-report').updateOne(
      { date: basisReport.date, location: basisReport.location },
      { $set: { ...basisReport, updated_at: new Date() } },
      { upsert: true }
    )

    return {
      mapperReturned: {date: basisReport.date, location: basisReport.location, revenue: basisReport.final_revenue_incl_vat},
      upsertResult: {matchedCount: result.matchedCount, upsertedId: result.upsertedId ? String(result.upsertedId) : null},
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})
