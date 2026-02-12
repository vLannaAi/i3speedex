import type { Buyer, CreateBuyerRequest, UpdateBuyerRequest } from '~/types'
import type { PaginatedResponse } from '~/types/api'

export function useCachedBuyers() {
  const buyers = useBuyers()
  const { getAllCached, invalidateAndSync, isReady } = useCache()

  async function fetchBuyers(params?: {
    page?: number
    pageSize?: number
    status?: string
    search?: string
  }): Promise<PaginatedResponse<Buyer> | null> {
    // Fallback to API if cache not ready
    if (!isReady.value) {
      return buyers.fetchBuyers(params)
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 20

    let items = await getAllCached<Buyer>('buyers')

    // Apply filters
    if (params?.status) {
      items = items.filter(b => b.status === params.status)
    }
    if (params?.search) {
      const q = params.search.toLowerCase()
      items = items.filter(b => (b.companyName || '').toLowerCase().includes(q))
    }

    // Sort by companyName ascending
    items.sort((a, b) => a.companyName.localeCompare(b.companyName))

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

  async function createBuyer(data: CreateBuyerRequest) {
    const res = await buyers.createBuyer(data)
    invalidateAndSync('buyers')
    return res
  }

  async function updateBuyer(id: string, data: UpdateBuyerRequest) {
    const res = await buyers.updateBuyer(id, data)
    invalidateAndSync('buyers')
    return res
  }

  async function deleteBuyer(id: string) {
    const res = await buyers.deleteBuyer(id)
    invalidateAndSync('buyers')
    return res
  }

  // Pass-through method (not cached)
  function fetchBuyer(id: string) {
    return buyers.fetchBuyer(id)
  }

  return { fetchBuyers, fetchBuyer, createBuyer, updateBuyer, deleteBuyer }
}
