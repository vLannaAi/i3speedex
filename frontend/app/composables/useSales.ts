import type { Sale, SaleLine, CreateSaleRequest, UpdateSaleRequest, CreateSaleLineRequest, UpdateSaleLineRequest } from '~/types'
import type { PaginatedResponse, ApiResponse } from '~/types/api'

export function useSales() {
  const { get, getList, post, put, del } = useApi()

  // Sales
  async function fetchSales(params?: {
    page?: number
    pageSize?: number
    status?: string
    buyerId?: string
    producerId?: string
    search?: string
    startDate?: string
    endDate?: string
  }) {
    return getList<Sale>('/api/sales', params as Record<string, string | number | undefined>)
  }

  async function fetchSale(id: string) {
    return get<Sale>(`/api/sales/${id}`)
  }

  async function createSale(data: CreateSaleRequest) {
    return post<Sale>('/api/sales', data)
  }

  async function updateSale(id: string, data: UpdateSaleRequest) {
    return put<Sale>(`/api/sales/${id}`, data)
  }

  async function deleteSale(id: string) {
    return del<void>(`/api/sales/${id}`)
  }

  async function confirmSale(id: string) {
    return post<Sale>(`/api/sales/${id}/confirm`)
  }

  // Sale Lines
  async function fetchSaleLines(saleId: string) {
    return get<SaleLine[]>(`/api/sales/${saleId}/lines`)
  }

  async function createSaleLine(saleId: string, data: CreateSaleLineRequest) {
    return post<SaleLine>(`/api/sales/${saleId}/lines`, data)
  }

  async function updateSaleLine(saleId: string, lineId: string, data: UpdateSaleLineRequest) {
    return put<SaleLine>(`/api/sales/${saleId}/lines/${lineId}`, data)
  }

  async function deleteSaleLine(saleId: string, lineId: string) {
    return del<void>(`/api/sales/${saleId}/lines/${lineId}`)
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
