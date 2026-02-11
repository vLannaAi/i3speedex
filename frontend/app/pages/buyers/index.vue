<script setup lang="ts">
import type { Buyer } from '~/types'
import type { Column } from '~/components/shared/DataTable.vue'

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

const columns: Column[] = [
  { key: 'companyName', label: 'Company Name', sortable: true },
  { key: 'city', label: 'City', sortable: true },
  { key: 'province', label: 'Prov.' },
  { key: 'vatNumber', label: 'VAT No.' },
  { key: 'status', label: 'Status' },
  { key: 'totalSales', label: 'Sales', align: 'right', sortable: true },
  { key: 'totalRevenue', label: 'Revenue', align: 'right', sortable: true },
]

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

watch(search, () => { page.value = 1; load() })
onMounted(() => load())

const router = useRouter()
function openBuyer(buyer: Buyer) {
  router.push(`/buyers/${buyer.buyerId}`)
}
</script>

<template>
  <div>
    <BreadcrumbNav :items="[{ label: 'Dashboard', to: '/' }, { label: 'Buyers' }]" />
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="page-title">Buyers</h1>
        <p class="page-subtitle">Manage your buyers</p>
      </div>
      <NuxtLink v-if="canWrite" to="/buyers/new" class="btn-primary">
        <i class="fa-solid fa-plus" /> New Buyer
      </NuxtLink>
    </div>

    <div class="card mb-4">
      <div class="p-4">
        <SearchInput v-model="search" placeholder="Search buyers..." />
      </div>
    </div>

    <div class="card overflow-hidden">
      <DataTable
        :columns="columns"
        :data="buyers"
        :loading="loading"
        row-key="buyerId"
        clickable
        @row-click="openBuyer"
      >
        <template #cell-status="{ value }">
          <StatusBadge :status="value" />
        </template>
        <template #cell-totalRevenue="{ value }">
          <span class="font-medium">{{ formatCurrency(value) }}</span>
        </template>
        <template #empty>
          <EmptyState
            title="No buyers"
            description="Get started by adding your first buyer"
            icon="fa-solid fa-users"
            :action-to="canWrite ? '/buyers/new' : undefined"
            :action-label="canWrite ? 'New Buyer' : undefined"
          />
        </template>
      </DataTable>
      <DataTablePagination
        :page="page"
        :page-size="pageSize"
        :total="total"
        :total-pages="totalPages"
        @update:page="(p) => { page = p; load() }"
        @update:page-size="(s) => { pageSize = s; page = 1; load() }"
      />
    </div>
  </div>
</template>
