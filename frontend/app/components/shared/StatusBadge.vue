<script setup lang="ts">
const props = defineProps<{
  status: string
  size?: 'sm' | 'md'
}>()

const colorMap: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-primary-100 text-primary-700',
  invoiced: 'bg-warning-100 text-warning-700',
  paid: 'bg-success-100 text-success-700',
  cancelled: 'bg-danger-100 text-danger-700',
  active: 'bg-success-100 text-success-700',
  inactive: 'bg-gray-100 text-gray-500',
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

const classes = computed(() => colorMap[props.status] || 'bg-gray-100 text-gray-700')
const label = computed(() => labelMap[props.status] || props.status)
</script>

<template>
  <span class="badge" :class="[classes, size === 'sm' ? 'text-[10px] px-1.5 py-0' : '']">
    {{ label }}
  </span>
</template>
