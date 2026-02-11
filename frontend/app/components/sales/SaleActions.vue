<script setup lang="ts">
import type { Sale } from '~/types'

const props = defineProps<{
  sale: Sale
}>()

const emit = defineEmits<{
  confirm: []
  delete: []
}>()

const { canWrite, isAdmin } = useAuth()

const canConfirm = computed(() =>
  canWrite.value && props.sale.status === 'draft'
)

const canDelete = computed(() =>
  canWrite.value && (props.sale.status === 'draft' || isAdmin.value)
)
</script>

<template>
  <div class="flex gap-2 flex-wrap">
    <button
      v-if="canConfirm"
      class="btn-primary btn-sm"
      @click="emit('confirm')"
    >
      <div class="i-mdi-check-circle-outline" /> Conferma
    </button>
    <button
      v-if="canDelete"
      class="btn-danger btn-sm"
      @click="emit('delete')"
    >
      <div class="i-mdi-delete-outline" /> Elimina
    </button>
  </div>
</template>
