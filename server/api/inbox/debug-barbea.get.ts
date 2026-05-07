// Debug endpoint to check Barbea Yesterday 0800 data
export default defineEventHandler(async () => {
  try {
    const { getDb } = await import('../../utils/db')
    const db = await getDb()
    
    // Find Barbea May 5 (yesterday) 08:00 record
    const records = await db.collection('inbox-bork-basis-report')
      .find({ 
        location: { $regex: /Barbea/i },
        date: '2026-05-05'
      })
      .toArray()
    
    return {
      found: records.length,
      records: records.map(r => ({
        date: r.date,
        location: r.location,
        business_hour: r.business_hour,
        final_revenue_incl_vat: r.final_revenue_incl_vat,
        final_revenue_ex_vat: r.final_revenue_ex_vat,
        netto_grand_total_qty: r.sections?.netto_sales?.grand_total?.quantity,
        netto_grand_total_incl: r.sections?.netto_sales?.grand_total?.price_incl_vat,
        netto_grand_total_ex: r.sections?.netto_sales?.grand_total?.price_ex_vat,
      }))
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})
