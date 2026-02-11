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
      <div class="i-mdi-filter-variant" />
      Filtri
      <span v-if="hasFilters" class="w-2 h-2 rounded-full bg-primary-500" />
    </button>

    <div v-if="open" class="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div>
        <label class="label-base">Stato</label>
        <select v-model="status" class="input-base">
          <option value="">Tutti</option>
          <option value="draft">Bozza</option>
          <option value="confirmed">Confermata</option>
          <option value="invoiced">Fatturata</option>
          <option value="paid">Pagata</option>
          <option value="cancelled">Annullata</option>
        </select>
      </div>
      <div>
        <label class="label-base">Acquirente</label>
        <select v-model="buyerId" class="input-base">
          <option value="">Tutti</option>
          <option v-for="b in buyers" :key="b.buyerId" :value="b.buyerId">{{ b.companyName }}</option>
        </select>
      </div>
      <div>
        <label class="label-base">Produttore</label>
        <select v-model="producerId" class="input-base">
          <option value="">Tutti</option>
          <option v-for="p in producers" :key="p.producerId" :value="p.producerId">{{ p.companyName }}</option>
        </select>
      </div>
      <div>
        <label class="label-base">Data da</label>
        <input v-model="startDate" type="date" class="input-base">
      </div>
      <div>
        <label class="label-base">Data a</label>
        <input v-model="endDate" type="date" class="input-base">
      </div>
    </div>

    <button v-if="open && hasFilters" class="btn-ghost btn-sm mt-2 text-xs" @click="reset">
      <div class="i-mdi-close" /> Resetta filtri
    </button>
  </div>
</template>
