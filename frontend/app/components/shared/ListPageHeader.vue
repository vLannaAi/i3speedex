<script setup lang="ts">
defineProps<{
  title: string
  newTo?: string
  canWrite?: boolean
}>()
</script>

<template>
  <div class="px-9 flex items-center gap-3 mb-4 mt-4">
    <h1 class="text-2xl font-bold shrink-0">{{ title }}</h1>
    <NuxtLink v-if="canWrite && newTo" :to="newTo">
      <UButton
        icon="i-lucide-plus"
        label="New"
        variant="outline"
        color="primary"
        class="bg-(--ui-bg) ring-primary text-primary hover:bg-(--ui-bg-accented)"
      />
    </NuxtLink>
    <div class="ml-auto flex items-center gap-2">
      <slot />
    </div>
  </div>
</template>
