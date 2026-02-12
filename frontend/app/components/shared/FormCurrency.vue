<script setup lang="ts">
const props = defineProps<{
  modelValue: number | undefined
  disabled?: boolean
  error?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const display = ref(props.modelValue?.toString() || '')

watch(() => props.modelValue, (v) => {
  if (v !== undefined && v !== null) {
    display.value = v.toString()
  }
})

function onBlur() {
  const num = parseFloat(display.value.replace(',', '.'))
  if (!isNaN(num)) {
    const rounded = Math.round(num * 100) / 100
    display.value = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rounded)
    emit('update:modelValue', rounded)
  }
}

function onFocus() {
  if (props.modelValue !== undefined) {
    display.value = props.modelValue.toString()
  }
}
</script>

<template>
  <UInput
    :model-value="display"
    type="text"
    inputmode="decimal"
    :disabled="disabled"
    :color="error ? 'error' : undefined"
    :highlight="error"
    @update:model-value="display = $event as string"
    @focus="onFocus"
    @blur="onBlur"
  >
    <template #leading>
      <span class="text-muted text-sm">EUR</span>
    </template>
  </UInput>
</template>
