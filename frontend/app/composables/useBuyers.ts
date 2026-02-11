import type { Buyer, CreateBuyerRequest, UpdateBuyerRequest } from '~/types'

export function useBuyers() {
  const { get, getList, post, put, del } = useApi()

  async function fetchBuyers(params?: {
    page?: number
    pageSize?: number
    status?: string
    search?: string
  }) {
    return getList<Buyer>('/api/buyers', params as Record<string, string | number | undefined>)
  }

  async function fetchBuyer(id: string) {
    return get<Buyer>(`/api/buyers/${id}`)
  }

  async function createBuyer(data: CreateBuyerRequest) {
    return post<Buyer>('/api/buyers', data)
  }

  async function updateBuyer(id: string, data: UpdateBuyerRequest) {
    return put<Buyer>(`/api/buyers/${id}`, data)
  }

  async function deleteBuyer(id: string) {
    return del<void>(`/api/buyers/${id}`)
  }

  return { fetchBuyers, fetchBuyer, createBuyer, updateBuyer, deleteBuyer }
}
