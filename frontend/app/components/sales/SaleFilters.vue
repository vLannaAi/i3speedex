<script setup lang="ts">
import type { Buyer, Producer } from '~/types'

const props = defineProps<{
  buyers: Buyer[]
  producers: Producer[]
}>()

const emit = defineEmits<{
  filter: [filters: {
    status?: string
    buyerId?: string
    producerId?: string
    startDate?: string
    endDate?: string
  }]
}>()

const open = ref(false)
const status = ref('')
const buyerId = ref('')
const producerId = ref('')
const startDate = ref('')
const endDate = ref('')

function apply() {
  emit('filter', {
    status: status.value || undefined,
    buyerId: buyerId.value || undefined,
    producerId: producerId.value || undefined,
    startDate: startDate.value || undefined,
    endDate: endDate.value || undefined,
  })
}

function reset() {
  status.value = ''
  buyerId.value = ''
  producerId.value = ''
  startDate.value = ''
  endDate.value = ''
  apply()
}

const hasFilters = computed(() => status.value || buyerId.value || producerId.value || startDate.value || endDate.value)

watch([status, buyerId, producerId, startDate, endDate], () => apply())
</script>

<template>
  <div class="mb-4">
    <button class="btn-ghost btn-sm" @click="open = !open">
      <i class="fa-solid fa-filter" />
      Filters
      <span v-if="hasFilters" class="w-2 h-2 rounded-full bg-primary-500" />
    </button>

    <div v-if="open" class="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div>
        <label class="label-base">Status</label>
        <select v-model="status" class="input-base">
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="invoiced">Invoiced</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div>
        <label class="label-base">Buyer</label>
        <select v-model="buyerId" class="input-base">
          <option value="">All</option>
          <option v-for="b in buyers" :key="b.buyerId" :value="b.buyerId">{{ b.companyName }}</option>
        </select>
      </div>
      <div>
        <label class="label-base">Producer</label>
        <select v-model="producerId" class="input-base">
          <option value="">All</option>
          <option v-for="p in producers" :key="p.producerId" :value="p.producerId">{{ p.companyName }}</option>
        </select>
      </div>
      <div>
        <label class="label-base">Date from</label>
        <input v-model="startDate" type="date" class="input-base">
      </div>
      <div>
        <label class="label-base">Date to</label>
        <input v-model="endDate" type="date" class="input-base">
      </div>
    </div>

    <button v-if="open && hasFilters" class="btn-ghost btn-sm mt-2 text-xs" @click="reset">
      <i class="fa-solid fa-xmark" /> Reset filters
    </button>
  </div>
</template>
