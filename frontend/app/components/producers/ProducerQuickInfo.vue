<script setup lang="ts">
import type { Producer } from '~/types'

const props = defineProps<{
  producer: Producer
}>()
</script>

<template>
  <EntityQuickInfo
    :company-name="props.producer.companyName"
    :vat-number="props.producer.vatNumber"
    :city="props.producer.city"
    :province="props.producer.province"
    :email="props.producer.email"
  />
</template>
