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
    <div v-if="icon" :class="icon" class="text-4xl text-gray-300 mx-auto mb-3" />
    <h3 class="text-base font-medium text-gray-900">{{ title }}</h3>
    <p v-if="description" class="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{{ description }}</p>
    <div class="mt-4">
      <NuxtLink v-if="actionTo" :to="actionTo" class="btn-primary btn-sm">{{ actionLabel }}</NuxtLink>
      <button v-else-if="actionLabel" class="btn-primary btn-sm" @click="$emit('action')">{{ actionLabel }}</button>
    </div>
  </div>
</template>
