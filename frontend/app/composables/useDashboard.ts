export function useDashboard() {
  const { get } = useApi()

  const stats = ref<any>(null)
  const topBuyers = ref<any[]>([])
  const recentActivity = ref<any[]>([])
  const salesByDate = ref<any[]>([])
  const loading = ref(false)

  async function fetchStats() {
    try {
      const res = await get<any>('/api/dashboard/stats')
      if (res.success && res.data) stats.value = res.data.stats || res.data
    } catch (e) {
      console.error('Dashboard stats error:', e)
    }
  }

  async function fetchTopBuyers(limit = 5) {
    try {
      const res = await get<any>('/api/dashboard/top-buyers', { limit })
      if (res.success && res.data) topBuyers.value = res.data.buyers || res.data
    } catch (e) {
      console.error('Dashboard top-buyers error:', e)
    }
  }

  async function fetchRecentActivity(limit = 10) {
    try {
      const res = await get<any>('/api/dashboard/recent-activity', { limit })
      if (res.success && res.data) recentActivity.value = res.data.activities || res.data
    } catch (e) {
      console.error('Dashboard recent-activity error:', e)
    }
  }

  async function fetchSalesByDate(startDate?: string, endDate?: string) {
    try {
      const now = new Date()
      const start = startDate || `${now.getFullYear()}-01-01`
      const end = endDate || now.toISOString().split('T')[0]
      const res = await get<any>('/api/dashboard/sales-by-date', { startDate: start, endDate: end })
      if (res.success && res.data) salesByDate.value = res.data.salesByDate || res.data
    } catch (e) {
      console.error('Dashboard sales-by-date error:', e)
    }
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
