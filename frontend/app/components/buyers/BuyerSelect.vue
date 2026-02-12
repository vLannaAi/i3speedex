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
const loading = ref(false)

const items = computed(() =>
  buyers.value.map(b => ({
    label: b.companyName,
    value: b.buyerId,
    description: `${b.city}${b.province ? ` (${b.province})` : ''}`,
    _buyer: b,
  })),
)

async function loadBuyers() {
  loading.value = true
  const res = await fetchBuyers({ pageSize: 100, status: 'active', search: search.value || undefined })
  if (res) buyers.value = res.data
  loading.value = false
}

function onUpdate(value: string) {
  emit('update:modelValue', value)
  const buyer = buyers.value.find(b => b.buyerId === value)
  if (buyer) emit('select', buyer)
}

watch(search, () => loadBuyers())
onMounted(() => loadBuyers())
</script>

<template>
  <USelectMenu
    :model-value="modelValue"
    :items="items"
    value-key="value"
    label-key="label"
    :search-input="{ placeholder: 'Search buyer...' }"
    :disabled="disabled"
    :color="error ? 'error' : undefined"
    :highlight="error"
    :loading="loading"
    placeholder="Select buyer..."
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
