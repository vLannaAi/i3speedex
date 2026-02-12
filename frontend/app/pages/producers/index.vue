<script setup lang="ts">
import type { Producer } from '~/types'
import { useDebounceFn } from '@vueuse/core'

const { fetchProducers } = useCachedProducers()
const { canWrite } = useAuth()

const producers = ref<Producer[]>([])
const loading = ref(true)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = ref(0)
const search = ref('')

const columns = [
  { accessorKey: 'companyName', header: 'Company Name', size: 300 },
  { accessorKey: 'city', header: 'City', size: 150 },
  { accessorKey: 'province', header: 'Prov.', size: 80 },
  { accessorKey: 'vatNumber', header: 'VAT No.', size: 150 },
  { accessorKey: 'status', header: 'Status', size: 100 },
]

const pageSizeOptions = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
]

const showing = computed(() => {
  if (total.value === 0) return 'No records found'
  const from = (page.value - 1) * pageSize.value + 1
  const to = Math.min(page.value * pageSize.value, total.value)
  return `Showing ${from}-${to} of ${total.value} records`
})

async function load() {
  loading.value = true
  try {
    const res = await fetchProducers({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
    })
    if (res) {
      producers.value = res.data
      total.value = res.pagination.total
      totalPages.value = res.pagination.totalPages
    }
  } finally {
    loading.value = false
  }
}

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  load()
}, 300)

watch(search, () => debouncedSearch())
onMounted(() => load())

const router = useRouter()
function onSelectProducer(_e: Event, row: any) {
  router.push(`/producers/${row.original.producerId}`)
}
</script>

<template>
  <div>
    <BreadcrumbNav :items="[{ label: 'Dashboard', to: '/' }, { label: 'Producers' }]" />
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Producers</h1>
        <p class="text-sm text-(--ui-text-muted) mt-1">{{ showing }}</p>
      </div>
      <NuxtLink v-if="canWrite" to="/producers/new">
        <UButton icon="i-lucide-plus">New Producer</UButton>
      </NuxtLink>
    </div>

    <UCard class="mb-4">
      <UInput v-model="search" icon="i-lucide-search" placeholder="Search producers..." />
    </UCard>

    <UCard>
      <UTable
        :columns="columns"
        :data="producers"
        :loading="loading"
        :ui="{
          base: 'table-fixed w-full',
          tr: 'even:bg-(--ui-bg-elevated)/50 hover:bg-(--ui-bg-accented) transition-colors cursor-pointer',
        }"
        @select="onSelectProducer"
      >
        <template #companyName-cell="{ row }">
          <span class="font-medium truncate block max-w-56">{{ row.original.companyName }}</span>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :status="row.original.status" />
        </template>
        <template #empty>
          <EmptyState
            title="No producers"
            description="Get started by adding your first producer"
            icon="i-lucide-factory"
            :action-to="canWrite ? '/producers/new' : undefined"
            :action-label="canWrite ? 'New Producer' : undefined"
          />
        </template>
      </UTable>
      <div class="flex items-center justify-between px-4 py-3 border-t border-(--ui-border)">
        <div class="flex items-center gap-2">
          <span class="text-sm text-(--ui-text-muted)">Rows per page:</span>
          <USelect v-model="pageSize" :items="pageSizeOptions" @update:model-value="() => { page = 1; load() }" class="w-20" />
        </div>
        <div class="flex items-center gap-4">
          <span class="text-sm text-(--ui-text-muted)">{{ showing }}</span>
          <UPagination v-model="page" :total="total" :items-per-page="pageSize" @update:model-value="load" />
        </div>
      </div>
    </UCard>
  </div>
</template>
