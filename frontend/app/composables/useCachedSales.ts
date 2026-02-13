import type { Sale, CreateSaleRequest, UpdateSaleRequest, CreateSaleLineRequest, UpdateSaleLineRequest } from '~/types'
import type { PaginatedResponse } from '~/types/api'
import type { ActiveFilters } from '~/composables/useSearchQuery'

export function useCachedSales() {
  const sales = useSales()
  const { getAllCached, invalidateAndSync, isReady } = useCache()

  function getSortVal(sale: Sale, key: string): string | number {
    switch (key) {
      case 'saleId': return sale.saleId
      case 'docType': return sale.docType || ''
      case 'status': return sale.status || ''
      case 'regDate': return sale.regNumber || sale.saleDate || ''
      case 'buyerId': return sale.buyerName || ''
      case 'total': return sale.total || 0
      case 'linesCount': return sale.linesCount || 0
      default: return ''
    }
  }

  function matchesDateFilter(saleDate: string, years: string[], yearRange?: { from: string; to: string }): boolean {
    if (!saleDate) return false
    // Check year list (can be full dates like "2025-01-15" or just years like "2025")
    if (years.length > 0) {
      const saleYear = saleDate.slice(0, 4)
      const match = years.some((y) => {
        if (y.length === 4) return saleYear === y
        // Full date match (for "today" etc.)
        return saleDate === y
      })
      if (!match) return false
    }
    // Check year/date range
    if (yearRange) {
      const from = yearRange.from.length === 4 ? `${yearRange.from}-01-01` : yearRange.from
      const to = yearRange.to.length === 4 ? `${yearRange.to}-12-31` : yearRange.to
      if (saleDate < from || saleDate > to) return false
    }
    return true
  }

  async function fetchSales(params?: {
    page?: number
    pageSize?: number
    // New: structured filters from useSearchQuery
    filters?: ActiveFilters
    // Legacy: individual filter params (used by buyer/producer detail pages)
    status?: string
    docType?: string
    buyerId?: string
    producerId?: string
    search?: string
    startDate?: string
    endDate?: string
    sortKey?: string
    sortDir?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<Sale> | null> {
    // Fallback to API if cache not ready
    if (!isReady.value) {
      return sales.fetchSales(params)
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 20
    const f = params?.filters

    let items = await getAllCached<Sale>('sales')

    if (f) {
      // New structured filters
      if (f.docTypes.length > 0) {
        items = items.filter(s => f.docTypes.includes(s.docType || ''))
      }
      if (f.statuses.length > 0) {
        items = items.filter(s => f.statuses.includes(s.status))
      }
      if (f.buyerIds.length > 0) {
        items = items.filter(s => f.buyerIds.includes(s.buyerId))
      }
      if (f.years.length > 0 || f.yearRange) {
        items = items.filter(s => matchesDateFilter(s.saleDate || '', f.years, f.yearRange))
      }
      if (f.amountMin !== undefined) {
        items = items.filter(s => (s.total || 0) >= f.amountMin!)
      }
      if (f.amountMax !== undefined) {
        items = items.filter(s => (s.total || 0) <= f.amountMax!)
      }
      for (const q of f.freeText) {
        const lower = q.toLowerCase()
        if (q.startsWith('id:')) {
          const parts = q.slice(3).split('-').map(Number)
          const from = parts[0] ?? 0
          const to = parts[1] ?? 999999
          items = items.filter((s) => {
            const id = parseInt(s.saleId.replace('SALE', ''), 10) || 0
            return id >= from && id <= to
          })
        } else if (q.startsWith('producer:')) {
          const code = q.slice(9).toLowerCase()
          items = items.filter(s =>
            (s.producerName || '').toLowerCase().includes(code)
            || s.producerId.toLowerCase().includes(code),
          )
        } else {
          items = items.filter(s =>
            (s.buyerName || '').toLowerCase().includes(lower)
            || (s.producerName || '').toLowerCase().includes(lower)
            || String(s.saleNumber || '').includes(lower)
            || (s.referenceNumber || '').toLowerCase().includes(lower)
            || s.saleId.toLowerCase().includes(lower),
          )
        }
      }
    } else {
      // Legacy individual filter params
      if (params?.status) {
        items = items.filter(s => s.status === params.status)
      }
      if (params?.docType) {
        items = items.filter(s => s.docType === params.docType)
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
    }

    // Sort: use filters sort, then params sort, then default
    const sortKey = f?.sortKey || params?.sortKey
    const sortDir = f?.sortDir || params?.sortDir
    if (sortKey && sortDir) {
      const key = sortKey
      const dir = sortDir === 'desc' ? -1 : 1
      items.sort((a, b) => {
        const va = getSortVal(a, key)
        const vb = getSortVal(b, key)
        const cmp = typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb))
        return cmp * dir
      })
    } else {
      items.sort((a, b) => {
        const dateCmp = (b.saleDate || '').localeCompare(a.saleDate || '')
        if (dateCmp !== 0) return dateCmp
        const idA = parseInt(a.saleId.replace('SALE', ''), 10) || 0
        const idB = parseInt(b.saleId.replace('SALE', ''), 10) || 0
        return idB - idA
      })
    }

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
