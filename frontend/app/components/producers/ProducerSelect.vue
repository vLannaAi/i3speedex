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
const loading = ref(false)

const items = computed(() =>
  producers.value.map(p => ({
    label: p.companyName,
    value: p.producerId,
    description: `${p.city}${p.province ? ` (${p.province})` : ''}`,
    _producer: p,
  })),
)

async function loadProducers() {
  loading.value = true
  const res = await fetchProducers({ pageSize: 100, status: 'active', search: search.value || undefined })
  if (res) producers.value = res.data
  loading.value = false
}

function onUpdate(value: string) {
  emit('update:modelValue', value)
  const producer = producers.value.find(p => p.producerId === value)
  if (producer) emit('select', producer)
}

watch(search, () => loadProducers())
onMounted(() => loadProducers())
</script>

<template>
  <USelectMenu
    :model-value="modelValue"
    :items="items"
    value-key="value"
    label-key="label"
    :search-input="{ placeholder: 'Search producer...' }"
    :disabled="disabled"
    :color="error ? 'error' : undefined"
    :highlight="error"
    :loading="loading"
    placeholder="Select producer..."
    @update:model-value="onUpdate"
    @update:search-term="search = $event"
  >
    <template #item="{ item }">
      <div>
        <div class="font-medium">{{ item.label }}</div>
        <div class="text-xs text-muted">{{ item.description }}</div>
      </div>
    </template>
  </USelectMenu>
</template>
