<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { Sale } from '~/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps<{
  sales: Sale[]
}>()

const { formatCurrency } = useFormatters()

const chartData = computed(() => {
  const now = new Date()
  const months: string[] = []
  const revenues: number[] = []

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }))
    revenues.push(0)

    for (const sale of props.sales) {
      const saleMonth = sale.saleDate?.slice(0, 7)
      if (saleMonth === key) {
        revenues[revenues.length - 1] += sale.total || 0
      }
    }
  }

  return {
    labels: months,
    datasets: [
      {
        label: 'Revenue',
        data: revenues,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: any) => formatCurrency(ctx.parsed.y),
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value: any) => {
          if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
          return value
        },
      },
    },
  },
}
</script>

<template>
  <div class="h-64">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
