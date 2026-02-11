<script setup lang="ts">
const props = defineProps<{
  modelValue: string | undefined
  placeholder?: string
  disabled?: boolean
  rows?: number
  maxLength?: number
  error?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const charCount = computed(() => props.modelValue?.length || 0)
</script>

<template>
  <div>
    <textarea
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows || 3"
      :maxlength="maxLength"
      class="input-base resize-y"
      :class="{ 'input-error': error }"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <p v-if="maxLength" class="text-xs text-gray-400 text-right mt-0.5">
      {{ charCount }}/{{ maxLength }}
    </p>
  </div>
</template>
