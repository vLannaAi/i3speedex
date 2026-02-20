<script setup lang="ts">
import type { Buyer } from '~/types'

const props = defineProps<{
  buyer: Buyer
}>()
</script>

<template>
  <EntityQuickInfo
    :company-name="props.buyer.companyName"
    :vat-number="props.buyer.vatNumber"
    :city="props.buyer.city"
    :province="props.buyer.province"
    :email="props.buyer.email"
  />
</template>
