<script setup lang="ts">
defineProps<{
  companyName: string
  vatNumber?: string
  city?: string
  province?: string
  email?: string
}>()
</script>

<template>
  <div class="text-sm space-y-1">
    <p class="font-medium text-gray-900">{{ companyName }}</p>
    <p v-if="vatNumber" class="text-gray-500">VAT: {{ vatNumber }}</p>
    <p class="text-gray-500">{{ city }}{{ province ? ` (${province})` : '' }}</p>
    <p v-if="email" class="text-gray-500">{{ email }}</p>
  </div>
</template>
