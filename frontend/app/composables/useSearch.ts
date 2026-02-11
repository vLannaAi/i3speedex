import type { Sale, Buyer, Producer } from '~/types'

export function useSearch() {
  const { get } = useApi()

  async function searchAll(query: string) {
    if (!query || query.length < 2) return { sales: [], buyers: [], producers: [] }

    const [salesRes, buyersRes, producersRes] = await Promise.all([
      get<any>('/api/search/sales', { q: query, pageSize: 5 }).catch(() => null),
      get<any>('/api/search/buyers', { q: query, pageSize: 5 }).catch(() => null),
      get<any>('/api/search/producers', { q: query, pageSize: 5 }).catch(() => null),
    ])

    return {
      sales: (salesRes?.data?.sales || []) as Sale[],
      buyers: (buyersRes?.data?.buyers || []) as Buyer[],
      producers: (producersRes?.data?.producers || []) as Producer[],
    }
  }

  return { searchAll }
}
