<script setup lang="ts">
import type { Producer } from '~/types'

const props = defineProps<{
  modelValue: string
  disabled?: boolean
  error?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'select': [producer: Producer]
}>()

const { fetchProducers } = useProducers()
const producers = ref<Producer[]>([])
const search = ref('')
const open = ref(false)
const loading = ref(false)

const selectedName = computed(() => {
  const p = producers.value.find(p => p.producerId === props.modelValue)
  return p?.companyName || ''
})

async function loadProducers() {
  loading.value = true
  const res = await fetchProducers({ pageSize: 100, status: 'active', search: search.value || undefined })
  if (res) producers.value = res.data
  loading.value = false
}

function select(producer: Producer) {
  emit('update:modelValue', producer.producerId)
  emit('select', producer)
  search.value = ''
  open.value = false
}

watch(search, () => loadProducers())
onMounted(() => loadProducers())
</script>

<template>
  <div class="relative">
    <div
      class="input-base cursor-pointer flex items-center justify-between"
      :class="{ 'input-error': error }"
      @click="open = !open"
    >
      <span :class="selectedName ? 'text-gray-900' : 'text-gray-400'">
        {{ selectedName || 'Seleziona produttore...' }}
      </span>
      <div class="i-mdi-chevron-down text-gray-400" />
    </div>

    <div v-if="open" class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-hidden">
      <div class="p-2 border-b border-gray-100">
        <input
          v-model="search"
          type="text"
          placeholder="Cerca produttore..."
          class="input-base text-sm"
          @click.stop
        >
      </div>
      <div class="overflow-y-auto max-h-48">
        <div v-if="loading" class="p-3 text-sm text-gray-500 text-center">Caricamento...</div>
        <div v-else-if="producers.length === 0" class="p-3 text-sm text-gray-500 text-center">Nessun risultato</div>
        <button
          v-for="p in producers"
          :key="p.producerId"
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
          :class="p.producerId === modelValue ? 'bg-primary-50 text-primary-700' : 'text-gray-700'"
          @click="select(p)"
        >
          <div>
            <p class="font-medium">{{ p.companyName }}</p>
            <p class="text-xs text-gray-400">{{ p.city }}{{ p.province ? ` (${p.province})` : '' }}</p>
          </div>
          <div v-if="p.producerId === modelValue" class="i-mdi-check text-primary-600" />
        </button>
      </div>
    </div>

    <div v-if="open" class="fixed inset-0 z-10" @click="open = false" />
  </div>
</template>
