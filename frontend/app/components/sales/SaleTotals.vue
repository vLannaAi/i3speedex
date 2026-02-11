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
  <div class="bg-gray-50 rounded-lg p-4 space-y-2">
    <div class="flex justify-between text-sm">
      <span class="text-gray-500">Imponibile</span>
      <span class="font-medium">{{ formatCurrency(totals.subtotal) }}</span>
    </div>
    <div class="flex justify-between text-sm">
      <span class="text-gray-500">IVA</span>
      <span class="font-medium">{{ formatCurrency(totals.taxAmount) }}</span>
    </div>
    <div class="divider" />
    <div class="flex justify-between text-base">
      <span class="font-semibold text-gray-900">Totale</span>
      <span class="font-bold text-gray-900">{{ formatCurrency(totals.total) }}</span>
    </div>
  </div>
</template>
