export default defineEventHandler(async (event) => {
  const body = await readBody<{ endpoint?: string; locationId?: string }>(event)
  return {
    success: true,
    message: `Sync test successful for endpoint: ${body?.endpoint || 'unknown'}`,
    locationId: body?.locationId || null,
  }
})
