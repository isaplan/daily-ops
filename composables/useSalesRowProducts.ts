import { ref } from 'vue'

export type SalesProductLine = {
  productId: string
  productName: string
  revenue: number
  quantity: number
}

export type SalesRowDetailState = { loading: boolean; items: SalesProductLine[]; error?: string }

export function useSalesRowProducts() {
  const detailByKey = ref<Record<string, SalesRowDetailState>>({})

  function rowKey(groupBy: string, row: Record<string, unknown>) {
    const d = String(row.date ?? '').slice(0, 10)
    const h = Number(row.hour ?? 0)
    const loc = String(row.locationId ?? '')
    if (groupBy === 'table') return `table:${d}:${h}:${loc}:${row.tableNumber ?? ''}`
    if (groupBy === 'worker') return `worker:${d}:${h}:${loc}:${row.workerId ?? 'unknown'}`
    if (groupBy === 'guestAccount') return `guest:${d}:${h}:${loc}:${row.accountName ?? ''}`
    return `hour:${d}:${h}:${loc}`
  }

  function resetDetails() {
    detailByKey.value = {}
  }

  async function ensureProducts(groupBy: string, row: Record<string, unknown>) {
    const key = rowKey(groupBy, row)
    const cur = detailByKey.value[key]
    if (cur?.items?.length || cur?.loading) return
    detailByKey.value = { ...detailByKey.value, [key]: { loading: true, items: [] } }
    try {
      const params = new URLSearchParams({
        groupBy,
        date: String(row.date ?? '').slice(0, 10),
        hour: String(row.hour ?? 0),
        locationId: String(row.locationId ?? ''),
      })
      if (groupBy === 'table') params.set('tableNumber', String(row.tableNumber ?? ''))
      if (groupBy === 'worker') params.set('workerId', String(row.workerId ?? 'unknown'))
      if (groupBy === 'guestAccount') params.set('accountName', String(row.accountName ?? ''))
      const res = await $fetch<{ success: boolean; products?: SalesProductLine[] }>(`/api/sales-aggregated-products?${params}`)
      detailByKey.value = { ...detailByKey.value, [key]: { loading: false, items: res.products ?? [] } }
    } catch (e: unknown) {
      detailByKey.value = {
        ...detailByKey.value,
        [key]: {
          loading: false,
          items: [],
          error: e instanceof Error ? e.message : 'Failed to load products',
        },
      }
    }
  }

  return { detailByKey, rowKey, ensureProducts, resetDetails }
}
