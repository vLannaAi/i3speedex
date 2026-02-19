<script setup lang="ts">
import type { Sale } from '~/types'

const { stats, topBuyers, recentActivity, loading, fetchAll } = useDashboard()
const { getAllCached, isReady } = useCache()
const { formatCurrency, formatDate, formatDateTime } = useFormatters()

// YTD stats computed from cached sales
const ytdSalesCount = ref(0)
const ytdActiveBuyers = ref(0)

async function loadYtdStats() {
  const currentYear = new Date().getFullYear()
  const yearStart = `${currentYear}-01-01`
  const sales = await getAllCached<Sale>('sales')
  const buyerIds = new Set<string>()
  let count = 0
  for (const s of sales) {
    if (s.status === 'cancelled') continue
    if (s.saleDate >= yearStart) {
      count++
      if (s.buyerId) buyerIds.add(s.buyerId)
    }
  }
  ytdSalesCount.value = count
  ytdActiveBuyers.value = buyerIds.size
}

// Load YTD stats once cache is ready
watch(isReady, (ready) => {
  if (ready) loadYtdStats()
}, { immediate: true })

onMounted(() => fetchAll())

// Construct status breakdown from individual stats fields
const statusBreakdown = computed(() => {
  if (!stats.value) return null
  const breakdown: Record<string, number> = {}
  if (stats.value.proformaSales) breakdown['proforma'] = stats.value.proformaSales
  if (stats.value.sentSales) breakdown['sent'] = stats.value.sentSales
  if (stats.value.paidSales) breakdown['paid'] = stats.value.paidSales
  if (stats.value.cancelledSales) breakdown['cancelled'] = stats.value.cancelledSales
  return Object.keys(breakdown).length > 0 ? breakdown : null
})

// Map activity action to a displayable status
const actionIcon: Record<string, string> = {
  created: 'i-lucide-circle-plus',
  updated: 'i-lucide-pencil',
  confirmed: 'i-lucide-circle-check',
  invoiced: 'i-lucide-file-text',
}
const actionColor: Record<string, string> = {
  created: 'text-primary-500',
  updated: 'text-(--ui-text-muted)',
  confirmed: 'text-success-500',
  invoiced: 'text-warning-500',
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <p class="text-sm text-muted mt-1">Sales overview</p>
    </div>

    <!-- Stat cards -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <UCard v-for="i in 2" :key="i">
        <LoadingSkeleton :lines="2" height="24px" />
      </UCard>
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <StatCard
        label="YTD Sales"
        :value="ytdSalesCount"
        icon="i-lucide-receipt"
        color="primary"
      />
      <StatCard
        label="Active Buyers"
        :value="ytdActiveBuyers"
        icon="i-lucide-users"
        color="warning"
      />
    </div>

    <!-- Status breakdown -->
    <div v-if="statusBreakdown" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      <UCard
        v-for="(count, status) in statusBreakdown"
        :key="status"
      >
        <div class="text-center">
          <StatusBadge :status="String(status)" class="mb-2" />
          <p class="text-2xl font-bold">{{ count }}</p>
        </div>
      </UCard>
    </div>

    <!-- Bottom row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Top Buyers -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Top 5 Buyers</h3>
        </template>

        <div v-if="loading"><LoadingSkeleton :lines="5" /></div>
        <div v-else-if="topBuyers.length === 0" class="text-center text-sm text-(--ui-text-muted)">No data</div>
        <table v-else class="w-full">
          <thead>
            <tr class="border-b border-(--ui-border) text-left text-xs text-(--ui-text-muted) uppercase">
              <th class="px-2 py-2.5">Buyer</th>
              <th class="px-2 py-2.5 text-right">Sales</th>
              <th class="px-2 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="buyer in topBuyers"
              :key="buyer.buyerId"
              class="border-b border-(--ui-border-muted) last:border-0"
            >
              <td class="px-2 py-3 text-sm font-medium">{{ buyer.buyerName || buyer.companyName }}</td>
              <td class="px-2 py-3 text-sm text-(--ui-text-muted) text-right">{{ buyer.totalSales }}</td>
              <td class="px-2 py-3 text-sm font-medium text-right">{{ formatCurrency(buyer.totalRevenue) }}</td>
            </tr>
          </tbody>
        </table>
      </UCard>

      <!-- Recent Activity -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Recent Activity</h3>
        </template>

        <div v-if="loading"><LoadingSkeleton :lines="5" /></div>
        <div v-else-if="recentActivity.length === 0" class="text-center text-sm text-(--ui-text-muted)">No recent activity</div>
        <ul v-else class="divide-y divide-(--ui-border-muted)">
          <li
            v-for="item in recentActivity"
            :key="`${item.id}-${item.timestamp}`"
            class="py-3 flex items-center gap-3"
          >
            <UIcon
              :name="actionIcon[item.action] || 'i-lucide-circle'"
              class="text-lg shrink-0"
              :class="actionColor[item.action] || 'text-(--ui-text-dimmed)'"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm truncate">{{ item.title }}</p>
              <p class="text-xs text-(--ui-text-dimmed)">{{ formatDateTime(item.timestamp) }}</p>
            </div>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
