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
      // Mock data for visual analysis
      stats.value = {
        totalSales: 154,
        salesGrowth: 12.5,
        totalRevenue: 45250.00,
        revenueGrowth: 8.2,
        activeBuyers: 42,
        activeProducers: 15,
        proformaSales: 5,
        sentSales: 12,
        paidSales: 130,
        cancelledSales: 7
      }
    }
  }

  async function fetchTopBuyers(limit = 5) {
    try {
      const res = await get<any>('/api/dashboard/top-buyers', { limit })
      if (res.success && res.data) topBuyers.value = res.data.buyers || res.data
    } catch (e) {
      console.error('Dashboard top-buyers error:', e)
      topBuyers.value = [
        { buyerId: '1', companyName: 'Acme Corp', totalSales: 15, totalRevenue: 12500 },
        { buyerId: '2', companyName: 'Globex Inc', totalSales: 10, totalRevenue: 8500 },
        { buyerId: '3', companyName: 'Soylent Corp', totalSales: 8, totalRevenue: 6200 },
        { buyerId: '4', companyName: 'Initech', totalSales: 5, totalRevenue: 3100 },
        { buyerId: '5', companyName: 'Umbrella Corp', totalSales: 3, totalRevenue: 1500 },
      ]
    }
  }

  async function fetchRecentActivity(limit = 10) {
    try {
      const res = await get<any>('/api/dashboard/recent-activity', { limit })
      if (res.success && res.data) recentActivity.value = res.data.activities || res.data
    } catch (e) {
      console.error('Dashboard recent-activity error:', e)
      recentActivity.value = [
        { id: '1', title: 'Sale #1001 created', timestamp: new Date().toISOString(), action: 'created' },
        { id: '2', title: 'Sale #1000 confirmed', timestamp: new Date(Date.now() - 3600000).toISOString(), action: 'confirmed' },
        { id: '3', title: 'Buyer Acme Corp updated', timestamp: new Date(Date.now() - 7200000).toISOString(), action: 'updated' },
        { id: '4', title: 'Invoice generated for #999', timestamp: new Date(Date.now() - 86400000).toISOString(), action: 'invoiced' },
      ]
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
