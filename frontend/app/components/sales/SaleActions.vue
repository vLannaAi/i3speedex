<script setup lang="ts">
import type { Sale } from '~/types'

const props = defineProps<{
  sale: Sale
}>()

const emit = defineEmits<{
  confirm: []
}>()

const { canWrite } = useAuth()

const canConfirm = computed(() =>
  canWrite.value && props.sale.status === 'proforma'
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
  </div>
</template>
