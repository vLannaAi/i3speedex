import type { Producer, CreateProducerRequest, UpdateProducerRequest } from '~/types'

export function useProducers() {
  const { get, getList, post, put, del } = useApi()

  async function fetchProducers(params?: {
    page?: number
    pageSize?: number
    status?: string
    search?: string
  }) {
    return getList<Producer>('/api/producers', params as Record<string, string | number | undefined>)
  }

  async function fetchProducer(id: string) {
    return get<Producer>(`/api/producers/${id}`)
  }

  async function createProducer(data: CreateProducerRequest) {
    return post<Producer>('/api/producers', data)
  }

  async function updateProducer(id: string, data: UpdateProducerRequest) {
    return put<Producer>(`/api/producers/${id}`, data)
  }

  async function deleteProducer(id: string) {
    return del<void>(`/api/producers/${id}`)
  }

  return { fetchProducers, fetchProducer, createProducer, updateProducer, deleteProducer }
}
