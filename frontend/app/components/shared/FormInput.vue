<script setup lang="ts">
defineProps<{
  modelValue: string | number | undefined
  type?: string
  placeholder?: string
  disabled?: boolean
  error?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string | number]
}>()
</script>

<template>
  <input
    :value="modelValue"
    :type="type || 'text'"
    :placeholder="placeholder"
    :disabled="disabled"
    class="input-base"
    :class="{ 'input-error': error }"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  >
</template>
