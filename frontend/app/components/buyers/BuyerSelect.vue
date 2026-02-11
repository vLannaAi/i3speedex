<script setup lang="ts">
import type { Buyer } from '~/types'

const props = defineProps<{
  modelValue: string
  disabled?: boolean
  error?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'select': [buyer: Buyer]
}>()

const { fetchBuyers } = useBuyers()
const buyers = ref<Buyer[]>([])
const search = ref('')
const open = ref(false)
const loading = ref(false)

const selectedName = computed(() => {
  const b = buyers.value.find(b => b.buyerId === props.modelValue)
  return b?.companyName || ''
})

async function loadBuyers() {
  loading.value = true
  const res = await fetchBuyers({ pageSize: 100, status: 'active', search: search.value || undefined })
  if (res) buyers.value = res.data
  loading.value = false
}

function select(buyer: Buyer) {
  emit('update:modelValue', buyer.buyerId)
  emit('select', buyer)
  search.value = ''
  open.value = false
}

watch(search, () => loadBuyers())
onMounted(() => loadBuyers())
</script>

<template>
  <div class="relative">
    <div
      class="input-base cursor-pointer flex items-center justify-between"
      :class="{ 'input-error': error }"
      @click="open = !open"
    >
      <span :class="selectedName ? 'text-gray-900' : 'text-gray-400'">
        {{ selectedName || 'Seleziona acquirente...' }}
      </span>
      <i class="fa-solid fa-chevron-down text-gray-400" />
    </div>

    <div v-if="open" class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-hidden">
      <div class="p-2 border-b border-gray-100">
        <input
          v-model="search"
          type="text"
          placeholder="Cerca acquirente..."
          class="input-base text-sm"
          @click.stop
        >
      </div>
      <div class="overflow-y-auto max-h-48">
        <div v-if="loading" class="p-3 text-sm text-gray-500 text-center">Caricamento...</div>
        <div v-else-if="buyers.length === 0" class="p-3 text-sm text-gray-500 text-center">Nessun risultato</div>
        <button
          v-for="b in buyers"
          :key="b.buyerId"
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
          :class="b.buyerId === modelValue ? 'bg-primary-50 text-primary-700' : 'text-gray-700'"
          @click="select(b)"
        >
          <div>
            <p class="font-medium">{{ b.companyName }}</p>
            <p class="text-xs text-gray-400">{{ b.city }}{{ b.province ? ` (${b.province})` : '' }}</p>
          </div>
          <i v-if="b.buyerId === modelValue" class="fa-solid fa-check text-primary-600" />
        </button>
      </div>
    </div>

    <!-- Backdrop -->
    <div v-if="open" class="fixed inset-0 z-10" @click="open = false" />
  </div>
</template>
