<script setup lang="ts">
defineProps<{
  modelValue: string | number | undefined
  options: readonly { value: string | number; label: string }[]
  placeholder?: string
  disabled?: boolean
  error?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <select
    :value="modelValue"
    :disabled="disabled"
    class="input-base"
    :class="{ 'input-error': error }"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-if="placeholder" value="">{{ placeholder }}</option>
    <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
  </select>
</template>
