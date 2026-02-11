<script setup lang="ts">
const open = ref(false)

defineProps<{
  hasFilters?: boolean
}>()
</script>

<template>
  <div>
    <button class="btn-ghost btn-sm" @click="open = !open">
      <div class="i-mdi-filter-variant" />
      Filtri
      <span v-if="hasFilters" class="w-2 h-2 rounded-full bg-primary-500" />
      <div :class="open ? 'i-mdi-chevron-up' : 'i-mdi-chevron-down'" class="text-xs" />
    </button>
    <div v-if="open" class="mt-3">
      <slot />
    </div>
  </div>
</template>
