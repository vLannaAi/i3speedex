<script setup lang="ts">
import type { SaleStatus } from '~/types'

defineProps<{ status: SaleStatus }>()

const colorMap: Record<SaleStatus, 'neutral' | 'primary' | 'warning' | 'success' | 'error'> = {
  proforma: 'neutral',
  sent: 'warning',
  paid: 'success',
  cancelled: 'error',
}

const labelMap: Record<SaleStatus, string> = {
  proforma: 'Proforma',
  sent: 'Sent',
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
