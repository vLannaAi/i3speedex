<script setup lang="ts">
const { stats, topBuyers, recentActivity, loading, fetchAll } = useDashboard()
const { formatCurrency, formatDate } = useFormatters()

onMounted(() => fetchAll())
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
    <div v-if="stats?.statusBreakdown" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      <div
        v-for="(count, status) in stats.statusBreakdown"
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
            :key="item.saleId"
            class="px-5 py-3 flex items-center gap-3"
          >
            <StatusBadge :status="item.status" size="sm" />
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-900 truncate">
                Vendita #{{ item.saleNumber }} — {{ item.buyerName }}
              </p>
              <p class="text-xs text-gray-400">{{ formatDate(item.updatedAt || item.createdAt) }}</p>
            </div>
            <span class="text-sm font-medium text-gray-900 whitespace-nowrap">{{ formatCurrency(item.total) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
