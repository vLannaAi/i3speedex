<script setup lang="ts">
import type { Buyer } from '~/types'
import { useDebounceFn } from '@vueuse/core'

const { fetchBuyers } = useBuyers()
const { formatCurrency } = useFormatters()
const { canWrite } = useAuth()

const buyers = ref<Buyer[]>([])
const loading = ref(true)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = ref(0)
const search = ref('')

const columns = [
  { accessorKey: 'companyName', header: 'Company Name' },
  { accessorKey: 'city', header: 'City' },
  { accessorKey: 'province', header: 'Prov.' },
  { accessorKey: 'vatNumber', header: 'VAT No.' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'totalSales', header: 'Sales' },
  { accessorKey: 'totalRevenue', header: 'Revenue' },
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
    const res = await fetchBuyers({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
    })
    if (res) {
      buyers.value = res.data
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
function onSelectBuyer(_e: Event, row: any) {
  router.push(`/buyers/${row.original.buyerId}`)
}
</script>

<template>
  <div>
    <BreadcrumbNav :items="[{ label: 'Dashboard', to: '/' }, { label: 'Buyers' }]" />
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Buyers</h1>
        <p class="text-sm text-(--ui-text-muted) mt-1">{{ showing }}</p>
      </div>
      <NuxtLink v-if="canWrite" to="/buyers/new">
        <UButton icon="i-lucide-plus">New Buyer</UButton>
      </NuxtLink>
    </div>

    <UCard class="mb-4">
      <UInput v-model="search" icon="i-lucide-search" placeholder="Search buyers..." />
    </UCard>

    <UCard>
      <UTable
        :columns="columns"
        :data="buyers"
        :loading="loading"
        :ui="{
          base: 'table-fixed w-full',
          tr: 'even:bg-(--ui-bg-elevated)/50 hover:bg-(--ui-bg-accented) transition-colors cursor-pointer',
        }"
        @select="onSelectBuyer"
      >
        <template #status-cell="{ row }">
          <StatusBadge :status="row.original.status" />
        </template>
        <template #totalRevenue-cell="{ row }">
          <span class="font-medium">{{ formatCurrency(row.original.totalRevenue) }}</span>
        </template>
        <template #empty>
          <EmptyState
            title="No buyers"
            description="Get started by adding your first buyer"
            icon="i-lucide-users"
            :action-to="canWrite ? '/buyers/new' : undefined"
            :action-label="canWrite ? 'New Buyer' : undefined"
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
