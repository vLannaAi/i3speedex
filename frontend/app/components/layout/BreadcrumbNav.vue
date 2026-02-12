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
  <UBreadcrumb :items="items" class="mb-4" />
</template>
