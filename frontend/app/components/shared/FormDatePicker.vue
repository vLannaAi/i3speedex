<script setup lang="ts">
const props = defineProps<{
  modelValue: string | undefined
  disabled?: boolean
  error?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Display as DD/MM/YYYY but store as ISO
const displayValue = computed(() => {
  if (!props.modelValue) return ''
  // If already in YYYY-MM-DD format, return as-is for date input
  return props.modelValue.split('T')[0]
})

function onChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update:modelValue', val)
}
</script>

<template>
  <input
    type="date"
    :value="displayValue"
    :disabled="disabled"
    class="input-base"
    :class="{ 'input-error': error }"
    @change="onChange"
  >
</template>
