<script setup lang="ts">
const props = defineProps<{
  status: string
  size?: 'sm' | 'md'
}>()

const colorMap: Record<string, 'neutral' | 'primary' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  confirmed: 'primary',
  invoiced: 'warning',
  paid: 'success',
  cancelled: 'error',
  active: 'success',
  inactive: 'neutral',
}

const labelMap: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
  active: 'Active',
  inactive: 'Inactive',
}
</script>

<template>
  <UBadge
    :label="labelMap[status] || status"
    :color="colorMap[status] || 'neutral'"
    variant="subtle"
    :size="size === 'sm' ? 'xs' : 'sm'"
  />
</template>
