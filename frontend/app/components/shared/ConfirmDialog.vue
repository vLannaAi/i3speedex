<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v) => { if (!v) emit('cancel') },
})
</script>

<template>
  <UModal v-model:open="isOpen" :title="title || 'Confirm'">
    <template #body>
      <p class="text-sm text-muted">{{ message }}</p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="outline" :disabled="loading" @click="emit('cancel')">
          {{ cancelLabel || 'Cancel' }}
        </UButton>
        <UButton
          :color="variant === 'danger' ? 'error' : 'primary'"
          :loading="loading"
          @click="emit('confirm')"
        >
          {{ confirmLabel || 'Confirm' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
