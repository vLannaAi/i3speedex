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

function onInput(e: Event) {
  display.value = (e.target as HTMLInputElement).value
}
</script>

<template>
  <div class="relative">
    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">EUR</span>
    <input
      :value="display"
      type="text"
      inputmode="decimal"
      :disabled="disabled"
      class="input-base pl-12"
      :class="{ 'input-error': error }"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    >
  </div>
</template>
