<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
  actionLabel?: string
  actionTo?: string
}>()

defineEmits<{ action: [] }>()
</script>

<template>
  <div class="text-center py-12">
    <UIcon v-if="icon" :name="icon" class="size-10 text-muted mx-auto mb-3" />
    <h3 class="text-base font-medium">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted mt-1 max-w-sm mx-auto">{{ description }}</p>
    <div v-if="actionLabel" class="mt-4">
      <UButton v-if="actionTo" :to="actionTo" size="sm">{{ actionLabel }}</UButton>
      <UButton v-else size="sm" @click="$emit('action')">{{ actionLabel }}</UButton>
    </div>
  </div>
</template>
