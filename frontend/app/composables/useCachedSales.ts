import type { Sale, CreateSaleRequest, UpdateSaleRequest, CreateSaleLineRequest, UpdateSaleLineRequest } from '~/types'
import type { PaginatedResponse } from '~/types/api'

export function useCachedSales() {
  const sales = useSales()
  const { getAllCached, invalidateAndSync, isReady } = useCache()

  async function fetchSales(params?: {
    page?: number
    pageSize?: number
    status?: string
    buyerId?: string
    producerId?: string
    search?: string
    startDate?: string
    endDate?: string
  }): Promise<PaginatedResponse<Sale> | null> {
    // Fallback to API if cache not ready
    if (!isReady.value) {
      return sales.fetchSales(params)
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 20

    let items = await getAllCached<Sale>('sales')

    // Apply filters
    if (params?.status) {
      items = items.filter(s => s.status === params.status)
    }
    if (params?.buyerId) {
      items = items.filter(s => s.buyerId === params.buyerId)
    }
    if (params?.producerId) {
      items = items.filter(s => s.producerId === params.producerId)
    }
    if (params?.startDate) {
      items = items.filter(s => (s.saleDate || '') >= params.startDate!)
    }
    if (params?.endDate) {
      items = items.filter(s => (s.saleDate || '') <= params.endDate!)
    }
    if (params?.search) {
      const q = params.search.toLowerCase()
      items = items.filter(s =>
        (s.buyerName || '').toLowerCase().includes(q)
        || (s.producerName || '').toLowerCase().includes(q)
        || String(s.saleNumber || '').includes(q)
        || (s.referenceNumber || '').toLowerCase().includes(q),
      )
    }

    // Sort by saleDate descending, then saleId descending (numeric)
    items.sort((a, b) => {
      const dateCmp = (b.saleDate || '').localeCompare(a.saleDate || '')
      if (dateCmp !== 0) return dateCmp
      const idA = parseInt(a.saleId.replace('SALE', ''), 10) || 0
      const idB = parseInt(b.saleId.replace('SALE', ''), 10) || 0
      return idB - idA
    })

    // Paginate
    const total = items.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const data = items.slice(start, start + pageSize)

    return {
      success: true,
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
      },
    }
  }

  async function createSale(data: CreateSaleRequest) {
    const res = await sales.createSale(data)
    invalidateAndSync('sales')
    return res
  }

  async function updateSale(id: string, data: UpdateSaleRequest) {
    const res = await sales.updateSale(id, data)
    invalidateAndSync('sales')
    return res
  }

  async function deleteSale(id: string) {
    const res = await sales.deleteSale(id)
    invalidateAndSync('sales')
    return res
  }

  async function confirmSale(id: string) {
    const res = await sales.confirmSale(id)
    invalidateAndSync('sales')
    return res
  }

  // Pass-through methods (not cached)
  function fetchSale(id: string) {
    return sales.fetchSale(id)
  }

  function fetchSaleLines(saleId: string) {
    return sales.fetchSaleLines(saleId)
  }

  async function createSaleLine(saleId: string, data: CreateSaleLineRequest) {
    const res = await sales.createSaleLine(saleId, data)
    invalidateAndSync('sales')
    return res
  }

  async function updateSaleLine(saleId: string, lineId: string, data: UpdateSaleLineRequest) {
    const res = await sales.updateSaleLine(saleId, lineId, data)
    invalidateAndSync('sales')
    return res
  }

  async function deleteSaleLine(saleId: string, lineId: string) {
    const res = await sales.deleteSaleLine(saleId, lineId)
    invalidateAndSync('sales')
    return res
  }

  return {
    fetchSales,
    fetchSale,
    createSale,
    updateSale,
    deleteSale,
    confirmSale,
    fetchSaleLines,
    createSaleLine,
    updateSaleLine,
    deleteSaleLine,
  }
}
