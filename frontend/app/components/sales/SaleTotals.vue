<script setup lang="ts">
import type { SaleLine } from '~/types'
import { calculateSaleTotals } from '~/utils/calculations'

const props = defineProps<{
  lines: SaleLine[]
}>()

const { formatCurrency } = useFormatters()

const totals = computed(() => calculateSaleTotals(props.lines))
</script>

<template>
  <div class="bg-(--ui-bg-muted) rounded-lg p-4 space-y-2">
    <div class="flex justify-between text-sm">
      <span class="text-(--ui-text-muted)">Subtotal</span>
      <span class="font-medium">{{ formatCurrency(totals.subtotal) }}</span>
    </div>
    <div class="flex justify-between text-sm">
      <span class="text-(--ui-text-muted)">VAT</span>
      <span class="font-medium">{{ formatCurrency(totals.taxAmount) }}</span>
    </div>
    <USeparator />
    <div class="flex justify-between text-base">
      <span class="font-semibold text-(--ui-text)">Total</span>
      <span class="font-bold text-(--ui-text)">{{ formatCurrency(totals.total) }}</span>
    </div>
  </div>
</template>
