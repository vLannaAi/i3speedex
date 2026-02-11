<script setup lang="ts">
import type { Producer } from '~/types'
import type { Column } from '~/components/shared/DataTable.vue'

const { fetchProducers } = useProducers()
const { canWrite } = useAuth()

const producers = ref<Producer[]>([])
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
]

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

watch(search, () => { page.value = 1; load() })
onMounted(() => load())

const router = useRouter()
function openProducer(producer: Producer) {
  router.push(`/producers/${producer.producerId}`)
}
</script>

<template>
  <div>
    <BreadcrumbNav :items="[{ label: 'Dashboard', to: '/' }, { label: 'Producers' }]" />
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="page-title">Producers</h1>
        <p class="page-subtitle">Manage your producers</p>
      </div>
      <NuxtLink v-if="canWrite" to="/producers/new" class="btn-primary">
        <i class="fa-solid fa-plus" /> New Producer
      </NuxtLink>
    </div>

    <div class="card mb-4">
      <div class="p-4">
        <SearchInput v-model="search" placeholder="Search producers..." />
      </div>
    </div>

    <div class="card overflow-hidden">
      <DataTable
        :columns="columns"
        :data="producers"
        :loading="loading"
        row-key="producerId"
        clickable
        @row-click="openProducer"
      >
        <template #cell-status="{ value }">
          <StatusBadge :status="value" />
        </template>
        <template #empty>
          <EmptyState
            title="No producers"
            description="Get started by adding your first producer"
            icon="fa-solid fa-industry"
            :action-to="canWrite ? '/producers/new' : undefined"
            :action-label="canWrite ? 'New Producer' : undefined"
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
