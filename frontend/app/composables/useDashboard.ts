export function useDashboard() {
  const { get } = useApi()

  const stats = ref<any>(null)
  const topBuyers = ref<any[]>([])
  const recentActivity = ref<any[]>([])
  const salesByDate = ref<any[]>([])
  const loading = ref(false)

  async function fetchStats() {
    const res = await get<any>('/api/dashboard/stats')
    // Response: { data: { stats: {...}, period: {...} } }
    if (res.success && res.data) stats.value = res.data.stats || res.data
  }

  async function fetchTopBuyers(limit = 5) {
    const res = await get<any>('/api/dashboard/top-buyers', { limit })
    // Response: { data: { buyers: [...], summary: {...} } }
    if (res.success && res.data) topBuyers.value = res.data.buyers || res.data
  }

  async function fetchRecentActivity(limit = 10) {
    const res = await get<any>('/api/dashboard/recent-activity', { limit })
    // Response: { data: { activities: [...], count: N } }
    if (res.success && res.data) recentActivity.value = res.data.activities || res.data
  }

  async function fetchSalesByDate(startDate?: string, endDate?: string) {
    // Default to current year if no dates provided
    const now = new Date()
    const start = startDate || `${now.getFullYear()}-01-01`
    const end = endDate || now.toISOString().split('T')[0]
    const res = await get<any>('/api/dashboard/sales-by-date', { startDate: start, endDate: end })
    if (res.success && res.data) salesByDate.value = res.data.salesByDate || res.data
  }

  async function fetchAll() {
    loading.value = true
    try {
      await Promise.all([
        fetchStats(),
        fetchTopBuyers(),
        fetchRecentActivity(),
        fetchSalesByDate(),
      ])
    } finally {
      loading.value = false
    }
  }

  return {
    stats,
    topBuyers,
    recentActivity,
    salesByDate,
    loading,
    fetchStats,
    fetchTopBuyers,
    fetchRecentActivity,
    fetchSalesByDate,
    fetchAll,
  }
}
