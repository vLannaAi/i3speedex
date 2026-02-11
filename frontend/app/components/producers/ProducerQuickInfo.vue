<script setup lang="ts">
import type { Producer } from '~/types'

defineProps<{
  producer: Producer
}>()
</script>

<template>
  <div class="text-sm space-y-1">
    <p class="font-medium text-gray-900">{{ producer.companyName }}</p>
    <p v-if="producer.vatNumber" class="text-gray-500">VAT: {{ producer.vatNumber }}</p>
    <p class="text-gray-500">{{ producer.city }}{{ producer.province ? ` (${producer.province})` : '' }}</p>
    <p v-if="producer.email" class="text-gray-500">{{ producer.email }}</p>
  </div>
</template>
