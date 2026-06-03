/**
 * @registry-id: datalabProxy
 * @created: 2026-06-03T20:30:00.000Z
 * @last-modified: 2026-06-03T20:30:00.000Z
 * @description: Proxy endpoint to fetch Bork Datalab reports (bypass CORS)
 * 
 * @exports-to:
 * ✓ pages/daily-ops/datalab.vue
 */

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const url = query.url as string

  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing url parameter',
    })
  }

  // Validate it's a Bork Datalab URL
  if (!url.includes('borkdatalab.com')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only Bork Datalab URLs allowed',
    })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DailyOps/1.0)',
      },
    })

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: `Failed to fetch ${url}`,
      })
    }

    const html = await response.text()
    
    // Set proper headers and return HTML directly (not JSON)
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    return html
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  }
})
