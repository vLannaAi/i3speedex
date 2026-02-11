<script setup lang="ts">
const { stats, topBuyers, recentActivity, loading, fetchAll } = useDashboard()
const { formatCurrency, formatDate, formatDateTime } = useFormatters()

onMounted(() => fetchAll())

// Construct status breakdown from individual stats fields
const statusBreakdown = computed(() => {
  if (!stats.value) return null
  const breakdown: Record<string, number> = {}
  if (stats.value.draftSales) breakdown['draft'] = stats.value.draftSales
  if (stats.value.confirmedSales) breakdown['confirmed'] = stats.value.confirmedSales
  if (stats.value.invoicedSales) breakdown['invoiced'] = stats.value.invoicedSales
  if (stats.value.paidSales) breakdown['paid'] = stats.value.paidSales
  if (stats.value.cancelledSales) breakdown['cancelled'] = stats.value.cancelledSales
  return Object.keys(breakdown).length > 0 ? breakdown : null
})

// Map activity action to a displayable status
const actionIcon: Record<string, string> = {
  created: 'i-mdi-plus-circle-outline',
  updated: 'i-mdi-pencil-outline',
  confirmed: 'i-mdi-check-circle-outline',
  invoiced: 'i-mdi-file-document-outline',
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
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">Panoramica delle vendite</p>
    </div>

    <!-- Stat cards -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div v-for="i in 4" :key="i" class="card card-body">
        <LoadingSkeleton :lines="2" height="24px" />
      </div>
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Vendite Totali"
        :value="stats?.totalSales ?? 0"
        icon="i-mdi-receipt-text-outline"
        color="primary"
        :trend="stats?.salesGrowth"
      />
      <StatCard
        label="Ricavi"
        :value="formatCurrency(stats?.totalRevenue ?? 0)"
        icon="i-mdi-cash-multiple"
        color="success"
        :trend="stats?.revenueGrowth"
      />
      <StatCard
        label="Acquirenti Attivi"
        :value="stats?.activeBuyers ?? 0"
        icon="i-mdi-account-group-outline"
        color="warning"
      />
      <StatCard
        label="Produttori Attivi"
        :value="stats?.activeProducers ?? 0"
        icon="i-mdi-factory"
        color="danger"
      />
    </div>

    <!-- Status breakdown -->
    <div v-if="statusBreakdown" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      <div
        v-for="(count, status) in statusBreakdown"
        :key="status"
        class="card card-body text-center"
      >
        <StatusBadge :status="String(status)" class="mb-2" />
        <p class="text-2xl font-bold text-gray-900">{{ count }}</p>
      </div>
    </div>

    <!-- Bottom row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Top Buyers -->
      <div class="card">
        <div class="px-5 py-4 border-b border-gray-100">
          <h3 class="section-title">Top 5 Acquirenti</h3>
        </div>
        <div v-if="loading" class="p-5"><LoadingSkeleton :lines="5" /></div>
        <div v-else-if="topBuyers.length === 0" class="p-5 text-center text-sm text-gray-500">Nessun dato</div>
        <table v-else class="w-full">
          <thead>
            <tr class="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
              <th class="px-5 py-2.5">Acquirente</th>
              <th class="px-5 py-2.5 text-right">Vendite</th>
              <th class="px-5 py-2.5 text-right">Totale</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="buyer in topBuyers"
              :key="buyer.buyerId"
              class="border-b border-gray-50 last:border-0"
            >
              <td class="px-5 py-3 text-sm font-medium text-gray-900">{{ buyer.buyerName || buyer.companyName }}</td>
              <td class="px-5 py-3 text-sm text-gray-600 text-right">{{ buyer.totalSales }}</td>
              <td class="px-5 py-3 text-sm font-medium text-gray-900 text-right">{{ formatCurrency(buyer.totalRevenue) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Recent Activity -->
      <div class="card">
        <div class="px-5 py-4 border-b border-gray-100">
          <h3 class="section-title">Attività Recente</h3>
        </div>
        <div v-if="loading" class="p-5"><LoadingSkeleton :lines="5" /></div>
        <div v-else-if="recentActivity.length === 0" class="p-5 text-center text-sm text-gray-500">Nessuna attività recente</div>
        <ul v-else class="divide-y divide-gray-50">
          <li
            v-for="item in recentActivity"
            :key="`${item.id}-${item.timestamp}`"
            class="px-5 py-3 flex items-center gap-3"
          >
            <div
              class="text-lg shrink-0"
              :class="[actionIcon[item.action] || 'i-mdi-circle-outline', actionColor[item.action] || 'text-gray-400']"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-900 truncate">{{ item.title }}</p>
              <p class="text-xs text-gray-400">{{ formatDateTime(item.timestamp) }}</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
