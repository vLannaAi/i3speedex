<script setup lang="ts">
import type { SaleStatus } from '~/types'

defineProps<{ status: SaleStatus }>()

const colorMap: Record<SaleStatus, 'neutral' | 'primary' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  confirmed: 'primary',
  invoiced: 'warning',
  paid: 'success',
  cancelled: 'error',
}

const labelMap: Record<SaleStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}
</script>

<template>
  <UBadge
    :label="labelMap[status]"
    :color="colorMap[status]"
    variant="subtle"
    size="sm"
  />
</template>
