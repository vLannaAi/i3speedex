<script setup lang="ts">
import type { Buyer } from '~/types'

defineProps<{
  buyer: Buyer
}>()
</script>

<template>
  <div class="text-sm space-y-1">
    <p class="font-medium text-gray-900">{{ buyer.companyName }}</p>
    <p v-if="buyer.vatNumber" class="text-gray-500">P.IVA: {{ buyer.vatNumber }}</p>
    <p class="text-gray-500">{{ buyer.city }}{{ buyer.province ? ` (${buyer.province})` : '' }}</p>
    <p v-if="buyer.email" class="text-gray-500">{{ buyer.email }}</p>
  </div>
</template>
