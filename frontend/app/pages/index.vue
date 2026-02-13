<script setup lang="ts">
const { stats, topBuyers, recentActivity, loading, fetchAll } = useDashboard()
const { formatCurrency, formatDate, formatDateTime } = useFormatters()

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
  updated: 'text-gray-500',
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
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <UCard v-for="i in 4" :key="i">
        <LoadingSkeleton :lines="2" height="24px" />
      </UCard>
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Total Sales"
        :value="stats?.totalSales ?? 0"
        icon="i-lucide-receipt"
        color="primary"
        :trend="stats?.salesGrowth"
      />
      <StatCard
        label="Revenue"
        :value="formatCurrency(stats?.totalRevenue ?? 0)"
        icon="i-lucide-banknote"
        color="success"
        :trend="stats?.revenueGrowth"
      />
      <StatCard
        label="Active Buyers"
        :value="stats?.activeBuyers ?? 0"
        icon="i-lucide-users"
        color="warning"
      />
      <StatCard
        label="Active Producers"
        :value="stats?.activeProducers ?? 0"
        icon="i-lucide-factory"
        color="error"
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
          <p class="text-2xl font-bold text-gray-900">{{ count }}</p>
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
        <div v-else-if="topBuyers.length === 0" class="text-center text-sm text-gray-500">No data</div>
        <table v-else class="w-full">
          <thead>
            <tr class="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
              <th class="px-2 py-2.5">Buyer</th>
              <th class="px-2 py-2.5 text-right">Sales</th>
              <th class="px-2 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="buyer in topBuyers"
              :key="buyer.buyerId"
              class="border-b border-gray-50 last:border-0"
            >
              <td class="px-2 py-3 text-sm font-medium text-gray-900">{{ buyer.buyerName || buyer.companyName }}</td>
              <td class="px-2 py-3 text-sm text-gray-600 text-right">{{ buyer.totalSales }}</td>
              <td class="px-2 py-3 text-sm font-medium text-gray-900 text-right">{{ formatCurrency(buyer.totalRevenue) }}</td>
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
        <div v-else-if="recentActivity.length === 0" class="text-center text-sm text-gray-500">No recent activity</div>
        <ul v-else class="divide-y divide-gray-50">
          <li
            v-for="item in recentActivity"
            :key="`${item.id}-${item.timestamp}`"
            class="py-3 flex items-center gap-3"
          >
            <UIcon
              :name="actionIcon[item.action] || 'i-lucide-circle'"
              class="text-lg shrink-0"
              :class="actionColor[item.action] || 'text-gray-400'"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-900 truncate">{{ item.title }}</p>
              <p class="text-xs text-gray-400">{{ formatDateTime(item.timestamp) }}</p>
            </div>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
