<script setup lang="ts">
const open = ref(false)

defineProps<{
  hasFilters?: boolean
}>()
</script>

<template>
  <div>
    <button class="btn-ghost btn-sm" @click="open = !open">
      <i class="fa-solid fa-filter" />
      Filters
      <span v-if="hasFilters" class="w-2 h-2 rounded-full bg-primary-500" />
      <i :class="open ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" class="text-xs" />
    </button>
    <div v-if="open" class="mt-3">
      <slot />
    </div>
  </div>
</template>
