<script setup lang="ts">
import type { Sale, Buyer, Producer } from '~/types'
import type { Column } from '~/components/shared/DataTable.vue'

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

const columns: Column[] = [
  { key: 'saleNumber', label: '#', sortable: true, width: '80px' },
  { key: 'saleDate', label: 'Date', sortable: true },
  { key: 'buyerName', label: 'Buyer', sortable: true },
  { key: 'producerName', label: 'Producer', sortable: true },
  { key: 'total', label: 'Total', sortable: true, align: 'right' },
  { key: 'status', label: 'Status' },
  { key: 'linesCount', label: 'Lines', align: 'center' },
]

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
      sales.value = res.data
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

watch(search, () => {
  page.value = 1
  load()
})

onMounted(() => {
  load()
  loadFilters()
})

const router = useRouter()
function openSale(sale: Sale) {
  router.push(`/sales/${sale.saleId}`)
}
</script>

<template>
  <div>
    <BreadcrumbNav :items="[{ label: 'Dashboard', to: '/' }, { label: 'Sales' }]" />
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="page-title">Sales</h1>
        <p class="page-subtitle">Manage your sales</p>
      </div>
      <NuxtLink v-if="canWrite" to="/sales/new" class="btn-primary">
        <i class="fa-solid fa-plus" /> New Sale
      </NuxtLink>
    </div>

    <!-- Search + Filters -->
    <div class="card mb-4">
      <div class="p-4">
        <SearchInput v-model="search" placeholder="Search sales..." />
      </div>
      <div class="px-4 pb-4">
        <SaleFilters :buyers="buyers" :producers="producers" @filter="onFilter" />
      </div>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden">
      <DataTable
        :columns="columns"
        :data="sales"
        :loading="loading"
        row-key="saleId"
        clickable
        @row-click="openSale"
      >
        <template #cell-saleDate="{ value }">
          {{ formatDate(value) }}
        </template>
        <template #cell-total="{ value }">
          <span class="font-medium">{{ formatCurrency(value) }}</span>
        </template>
        <template #cell-status="{ value }">
          <SaleStatusBadge :status="value" />
        </template>
        <template #empty>
          <EmptyState
            title="No sales"
            description="Get started by creating your first sale"
            icon="fa-solid fa-file-invoice"
            :action-to="canWrite ? '/sales/new' : undefined"
            :action-label="canWrite ? 'New Sale' : undefined"
          />
        </template>
      </DataTable>
      <DataTablePagination
        :page="page"
        :page-size="pageSize"
        :total="total"
        :total-pages="totalPages"
        @update:page="onPageChange"
        @update:page-size="onPageSizeChange"
      />
    </div>
  </div>
</template>
