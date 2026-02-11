<script setup lang="ts">
export interface Crumb {
  label: string
  to?: string
}

defineProps<{
  items: Crumb[]
}>()
</script>

<template>
  <nav class="flex items-center gap-1.5 text-sm mb-4">
    <template v-for="(item, i) in items" :key="i">
      <span v-if="i > 0" class="text-gray-300">/</span>
      <NuxtLink
        v-if="item.to"
        :to="item.to"
        class="text-gray-500 hover:text-gray-700 transition-colors"
      >
        {{ item.label }}
      </NuxtLink>
      <span v-else class="text-gray-900 font-medium">{{ item.label }}</span>
    </template>
  </nav>
</template>
