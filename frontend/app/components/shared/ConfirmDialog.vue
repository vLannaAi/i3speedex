<script setup lang="ts">
defineProps<{
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
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/40" @click="emit('cancel')" />
      <!-- Dialog -->
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full relative z-10 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ title || 'Conferma' }}</h3>
        <p class="text-sm text-gray-600 mb-6">{{ message }}</p>
        <div class="flex justify-end gap-3">
          <button class="btn-secondary" :disabled="loading" @click="emit('cancel')">
            {{ cancelLabel || 'Annulla' }}
          </button>
          <button
            :class="variant === 'danger' ? 'btn-danger' : 'btn-primary'"
            :disabled="loading"
            @click="emit('confirm')"
          >
            <i v-if="loading" class="fa-solid fa-spinner fa-spin" />
            {{ confirmLabel || 'Conferma' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
