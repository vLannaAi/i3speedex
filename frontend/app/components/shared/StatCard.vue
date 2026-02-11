<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  icon?: string
  trend?: number
  color?: 'primary' | 'success' | 'warning' | 'danger'
}>()
</script>

<template>
  <div class="card card-body flex items-start gap-4">
    <div
      v-if="icon"
      class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
      :class="{
        'bg-primary-100 text-primary-600': color === 'primary' || !color,
        'bg-success-100 text-success-600': color === 'success',
        'bg-warning-100 text-warning-600': color === 'warning',
        'bg-danger-100 text-danger-600': color === 'danger',
      }"
    >
      <div :class="icon" class="text-2xl" />
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm text-gray-500 truncate">{{ label }}</p>
      <p class="text-2xl font-bold text-gray-900 mt-1">{{ value }}</p>
      <p v-if="trend !== undefined" class="text-xs mt-1" :class="trend >= 0 ? 'text-success-600' : 'text-danger-600'">
        <span>{{ trend >= 0 ? '+' : '' }}{{ trend }}%</span>
        <span class="text-gray-400 ml-1">vs mese prec.</span>
      </p>
    </div>
  </div>
</template>
