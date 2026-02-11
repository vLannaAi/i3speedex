<script setup lang="ts">
defineProps<{
  label: string
  error?: string
  required?: boolean
  hint?: string
}>()
</script>

<template>
  <div>
    <label class="label-base">
      {{ label }}
      <span v-if="required" class="text-danger-500">*</span>
    </label>
    <slot />
    <p v-if="error" class="text-xs text-danger-600 mt-1">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-gray-400 mt-1">{{ hint }}</p>
  </div>
</template>
