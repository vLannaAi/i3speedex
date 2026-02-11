<script setup lang="ts">
import type { SaleStatus } from '~/types'

defineProps<{ status: SaleStatus }>()

const colorMap: Record<SaleStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-primary-100 text-primary-700',
  invoiced: 'bg-warning-100 text-warning-700',
  paid: 'bg-success-100 text-success-700',
  cancelled: 'bg-danger-100 text-danger-700',
}

const labelMap: Record<SaleStatus, string> = {
  draft: 'Bozza',
  confirmed: 'Confermata',
  invoiced: 'Fatturata',
  paid: 'Pagata',
  cancelled: 'Annullata',
}
</script>

<template>
  <span class="badge" :class="colorMap[status]">{{ labelMap[status] }}</span>
</template>
