import type { Producer, CreateProducerRequest, UpdateProducerRequest } from '~/types'
import type { PaginatedResponse } from '~/types/api'

export function useCachedProducers() {
  const producers = useProducers()
  const { getAllCached, invalidateAndSync, isReady } = useCache()

  async function fetchProducers(params?: {
    page?: number
    pageSize?: number
    status?: string
    search?: string
  }): Promise<PaginatedResponse<Producer> | null> {
    // Fallback to API if cache not ready
    if (!isReady.value) {
      return producers.fetchProducers(params)
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 20

    let items = await getAllCached<Producer>('producers')

    // Apply filters
    if (params?.status) {
      items = items.filter(p => p.status === params.status)
    }
    if (params?.search) {
      const q = params.search.toLowerCase()
      items = items.filter(p => (p.companyName || '').toLowerCase().includes(q))
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

  async function createProducer(data: CreateProducerRequest) {
    const res = await producers.createProducer(data)
    invalidateAndSync('producers')
    return res
  }

  async function updateProducer(id: string, data: UpdateProducerRequest) {
    const res = await producers.updateProducer(id, data)
    invalidateAndSync('producers')
    return res
  }

  async function deleteProducer(id: string) {
    const res = await producers.deleteProducer(id)
    invalidateAndSync('producers')
    return res
  }

  // Pass-through method (not cached)
  function fetchProducer(id: string) {
    return producers.fetchProducer(id)
  }

  return { fetchProducers, fetchProducer, createProducer, updateProducer, deleteProducer }
}
