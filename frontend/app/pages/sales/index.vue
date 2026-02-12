<script setup lang="ts">
import type { Sale, Buyer, Producer } from '~/types'
import { useDebounceFn } from '@vueuse/core'

const { fetchSales } = useSales()
const { fetchBuyers } = useBuyers()
const { fetchProducers } = useProducers()
const { formatDate, formatCurrency } = useFormatters()
const { canWrite } = useAuth()

const sales = ref<Sale[]>([])
const buyers = ref<Buyer[]>([])
const producers = ref<Producer[]>([])
const loading = ref(true)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = ref(0)
const search = ref('')
const filters = ref<Record<string, string | undefined>>({})

const columns = [
  { accessorKey: 'saleNumber', header: '#', size: 40 },
  { accessorKey: 'saleDate', header: 'Date', size: 90 },
  { accessorKey: 'buyerName', header: 'Buyer', size: 200 },
  { accessorKey: 'producerName', header: 'Producer', size: 200 },
  { accessorKey: 'total', header: 'Total', size: 100 },
  { accessorKey: 'status', header: 'Status', size: 90 },
  { accessorKey: 'linesCount', header: 'Lines', size: 40 },
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
    const res = await fetchSales({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      ...filters.value,
    })
    if (res) {
      sales.value = res.data.sort((a, b) => {
        const dateA = a.saleDate || ''
        const dateB = b.saleDate || ''
        return dateB.localeCompare(dateA)
      })
      total.value = res.pagination.total
      totalPages.value = res.pagination.totalPages
    }
  } finally {
    loading.value = false
  }
}

// Load buyers/producers for filter dropdowns
async function loadFilters() {
  const [buyersRes, producersRes] = await Promise.all([
    fetchBuyers({ pageSize: 100 }),
    fetchProducers({ pageSize: 100 }),
  ])
  if (buyersRes) buyers.value = buyersRes.data
  if (producersRes) producers.value = producersRes.data
}

function onFilter(f: Record<string, string | undefined>) {
  filters.value = f
  page.value = 1
  load()
}

function onPageChange(p: number) {
  page.value = p
  load()
}

function onPageSizeChange(s: number) {
  pageSize.value = s
  page.value = 1
  load()
}

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  load()
}, 300)

watch(search, () => debouncedSearch())

onMounted(() => {
  load()
  loadFilters()
})

const router = useRouter()
function onSelectSale(_e: Event, row: any) {
  router.push(`/sales/${row.original.saleId}`)
}
</script>

<template>
  <div>
    <BreadcrumbNav :items="[{ label: 'Dashboard', to: '/' }, { label: 'Sales' }]" />
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Sales</h1>
        <p class="text-sm text-(--ui-text-muted) mt-1">{{ showing }}</p>
      </div>
      <UButton v-if="canWrite" to="/sales/new" icon="i-lucide-plus">
        New Sale
      </UButton>
    </div>

    <!-- Search + Filters -->
    <UCard class="mb-4">
      <div class="p-4">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search sales..."
        />
      </div>
      <div class="px-4 pb-4">
        <SaleFilters :buyers="buyers" :producers="producers" @filter="onFilter" />
      </div>
    </UCard>

    <!-- Table -->
    <UCard class="overflow-hidden">
      <UTable
        :columns="columns"
        :data="sales"
        :loading="loading"
        :ui="{
          base: 'table-fixed w-full',
          tr: 'even:bg-(--ui-bg-elevated)/50 hover:bg-(--ui-bg-accented) transition-colors cursor-pointer',
        }"
        @select="onSelectSale"
      >
        <template #saleNumber-header>
          <div class="text-right w-full">#</div>
        </template>
        <template #saleNumber-cell="{ row }">
          <div class="text-right">{{ row.original.saleNumber }}</div>
        </template>
        <template #saleDate-cell="{ row }">
          {{ formatDate(row.original.saleDate) }}
        </template>
        <template #buyerName-cell="{ row }">
          <span class="truncate block">{{ row.original.buyerName }}</span>
        </template>
        <template #producerName-cell="{ row }">
          <span class="truncate block">{{ row.original.producerName }}</span>
        </template>
        <template #total-header>
          <div class="text-right w-full">Total</div>
        </template>
        <template #total-cell="{ row }">
          <div class="text-right font-medium">{{ formatCurrency(row.original.total) }}</div>
        </template>
        <template #status-cell="{ row }">
          <SaleStatusBadge :status="row.original.status" />
        </template>
        <template #linesCount-cell="{ row }">
          <div class="text-center">{{ row.original.linesCount }}</div>
        </template>
        <template #empty>
          <EmptyState
            title="No sales"
            description="Get started by creating your first sale"
            icon="i-lucide-file-text"
            :action-to="canWrite ? '/sales/new' : undefined"
            :action-label="canWrite ? 'New Sale' : undefined"
          />
        </template>
      </UTable>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-(--ui-border)">
        <div class="flex items-center gap-2">
          <span class="text-sm text-(--ui-text-muted)">Rows per page:</span>
          <USelect
            v-model="pageSize"
            :items="pageSizeOptions"
            class="w-20"
            @update:model-value="onPageSizeChange"
          />
        </div>
        <div class="flex items-center gap-4">
          <span class="text-sm text-(--ui-text-muted)">{{ showing }}</span>
          <UPagination
            v-model="page"
            :total="total"
            :items-per-page="pageSize"
            @update:model-value="onPageChange"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>
