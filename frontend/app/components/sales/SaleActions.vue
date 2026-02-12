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
    <UButton
      v-if="canConfirm"
      size="sm"
      icon="i-lucide-check-circle"
      @click="emit('confirm')"
    >
      Confirm
    </UButton>
    <UButton
      v-if="canDelete"
      color="error"
      size="sm"
      icon="i-lucide-trash-2"
      @click="emit('delete')"
    >
      Delete
    </UButton>
  </div>
</template>
