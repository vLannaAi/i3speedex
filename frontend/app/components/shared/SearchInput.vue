<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const local = ref(props.modelValue)
let timer: ReturnType<typeof setTimeout>

watch(() => props.modelValue, (v) => { local.value = v })

function onInput(e: Event) {
  local.value = (e.target as HTMLInputElement).value
  clearTimeout(timer)
  timer = setTimeout(() => emit('update:modelValue', local.value), 300)
}

function clear() {
  local.value = ''
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="relative">
    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
    <input
      :value="local"
      type="text"
      :placeholder="placeholder || 'Cerca...'"
      class="input-base pl-10 pr-8"
      @input="onInput"
    >
    <button
      v-if="local"
      class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
      @click="clear"
    ><i class="fa-solid fa-circle-xmark" /></button>
  </div>
</template>
