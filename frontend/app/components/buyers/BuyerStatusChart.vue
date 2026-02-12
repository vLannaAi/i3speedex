<script setup lang="ts">
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { Sale, SaleStatus } from '~/types'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  sales: Sale[]
}>()

const statusColors: Record<SaleStatus, string> = {
  draft: 'rgb(156, 163, 175)',
  confirmed: 'rgb(59, 130, 246)',
  invoiced: 'rgb(245, 158, 11)',
  paid: 'rgb(34, 197, 94)',
  cancelled: 'rgb(239, 68, 68)',
}

const statusLabels: Record<SaleStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

const chartData = computed(() => {
  const counts: Record<string, number> = {}
  for (const sale of props.sales) {
    counts[sale.status] = (counts[sale.status] || 0) + 1
  }

  const statuses = Object.keys(counts) as SaleStatus[]

  return {
    labels: statuses.map(s => statusLabels[s] || s),
    datasets: [
      {
        data: statuses.map(s => counts[s]),
        backgroundColor: statuses.map(s => statusColors[s] || 'rgb(156, 163, 175)'),
        borderWidth: 0,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '60%',
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        padding: 16,
      },
    },
  },
}
</script>

<template>
  <div class="h-64">
    <Doughnut v-if="sales.length > 0" :data="chartData" :options="chartOptions" />
    <div v-else class="flex items-center justify-center h-full text-sm text-gray-400">
      No data available
    </div>
  </div>
</template>
