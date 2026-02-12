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
const status = ref('all')
const buyerId = ref('all')
const producerId = ref('all')
const startDate = ref('')
const endDate = ref('')

const statusOptions = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Invoiced', value: 'invoiced' },
  { label: 'Paid', value: 'paid' },
  { label: 'Cancelled', value: 'cancelled' },
]

const buyerOptions = computed(() => [
  { label: 'All', value: 'all' },
  ...props.buyers.map(b => ({ label: b.companyName, value: b.buyerId }))
])

const producerOptions = computed(() => [
  { label: 'All', value: 'all' },
  ...props.producers.map(p => ({ label: p.companyName, value: p.producerId }))
])

function apply() {
  emit('filter', {
    status: status.value && status.value !== 'all' ? status.value : undefined,
    buyerId: buyerId.value && buyerId.value !== 'all' ? buyerId.value : undefined,
    producerId: producerId.value && producerId.value !== 'all' ? producerId.value : undefined,
    startDate: startDate.value || undefined,
    endDate: endDate.value || undefined,
  })
}

function reset() {
  status.value = 'all'
  buyerId.value = 'all'
  producerId.value = 'all'
  startDate.value = ''
  endDate.value = ''
  apply()
}

const hasFilters = computed(() => (status.value && status.value !== 'all') || (buyerId.value && buyerId.value !== 'all') || (producerId.value && producerId.value !== 'all') || startDate.value || endDate.value)

watch([status, buyerId, producerId, startDate, endDate], () => apply())
</script>

<template>
  <div class="mb-4">
    <UButton variant="ghost" size="sm" icon="i-lucide-filter" @click="open = !open">
      Filters
      <span v-if="hasFilters" class="ml-1 w-2 h-2 rounded-full bg-primary-500" />
    </UButton>

    <div v-if="open" class="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <UFormField label="Status">
        <USelect v-model="status" :items="statusOptions" />
      </UFormField>
      <UFormField label="Buyer">
        <USelect v-model="buyerId" :items="buyerOptions" />
      </UFormField>
      <UFormField label="Producer">
        <USelect v-model="producerId" :items="producerOptions" />
      </UFormField>
      <UFormField label="Date from">
        <UInput v-model="startDate" type="date" />
      </UFormField>
      <UFormField label="Date to">
        <UInput v-model="endDate" type="date" />
      </UFormField>
    </div>

    <UButton v-if="open && hasFilters" variant="ghost" size="sm" icon="i-lucide-x" class="mt-2 text-xs" @click="reset">
      Reset filters
    </UButton>
  </div>
</template>
