<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  icon?: string
  trend?: number
  color?: 'primary' | 'success' | 'warning' | 'error'
}>()
</script>

<template>
  <UCard>
    <div class="flex items-start gap-4">
      <div
        v-if="icon"
        class="size-12 rounded-xl flex items-center justify-center shrink-0"
        :class="{
          'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400': color === 'primary' || !color,
          'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400': color === 'success',
          'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400': color === 'warning',
          'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400': color === 'error',
        }"
      >
        <UIcon :name="icon" class="size-6" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-muted truncate">{{ label }}</p>
        <p class="text-2xl font-bold mt-1">{{ value }}</p>
        <p v-if="trend !== undefined" class="text-xs mt-1" :class="trend >= 0 ? 'text-green-600' : 'text-red-600'">
          <span>{{ trend >= 0 ? '+' : '' }}{{ trend }}%</span>
          <span class="text-muted ml-1">vs prev. month</span>
        </p>
      </div>
    </div>
  </UCard>
</template>
