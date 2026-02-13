<script setup lang="ts">
import type { Producer, Sale } from '~/types'
import { useDebounceFn } from '@vueuse/core'
import { toAlpha2 } from '~/utils/constants'

const { fetchProducers } = useCachedProducers()
const { getAllCached } = useCache()
const { formatNumber } = useFormatters()
const { canWrite } = useAuth()

const producers = ref<Producer[]>([])
const allProducers = ref<Producer[]>([])
const loading = ref(true)
const total = ref(0)
const search = ref('')
const allTimeSales = ref<Record<string, number>>({})
const ytdSales = ref<Record<string, number>>({})
const cachedSales = ref<Sale[]>([])

// Detect year search (e.g. "2025")
const searchYear = computed(() => {
  const q = search.value.trim()
  return /^\d{4}$/.test(q) ? q : null
})

// Year-specific sales computed reactively
const yearSales = computed(() => {
  if (!searchYear.value) return null
  const year = searchYear.value
  const map: Record<string, number> = {}
  for (const s of cachedSales.value) {
    if (s.status === 'cancelled') continue
    if (s.saleDate?.startsWith(year)) {
      map[s.producerId] = (map[s.producerId] || 0) + (s.total || 0)
    }
  }
  return map
})

const activeYtdMap = computed(() => yearSales.value || ytdSales.value)
const ytdLabel = computed(() => searchYear.value ? `${searchYear.value} €` : 'YTD €')

const columns = [
  { accessorKey: 'producerId', header: 'ID', size: 90, meta: { class: { td: 'w-[90px]' } } },
  { accessorKey: 'status', header: 'Status', size: 85, meta: { class: { th: 'hidden min-[580px]:table-cell', td: 'hidden min-[580px]:table-cell w-[85px]' } } },
  { accessorKey: 'country', header: 'Country', size: 80, meta: { class: { td: 'w-[80px] max-[579px]:w-[40px]' } } },
  { accessorKey: 'code', header: 'Code', size: 100, meta: { class: { td: 'w-[100px]' } } },
  { accessorKey: 'companyName', header: 'Company Name', meta: { class: { th: 'hidden min-[860px]:table-cell', td: 'hidden min-[860px]:table-cell max-w-0 overflow-hidden' } } },
  { accessorKey: 'allTimeSales', header: 'Sales €', size: 100, meta: { class: { th: 'hidden min-[860px]:table-cell', td: 'hidden min-[860px]:table-cell w-[100px]' } } },
  { accessorKey: 'ytdSales', header: 'YTD €', size: 100, meta: { class: { td: 'w-[100px]' } } },
]

async function load() {
  loading.value = true
  try {
    const res = await fetchProducers({
      page: 1,
      pageSize: 10000,
      search: search.value || undefined,
    })
    if (res) {
      producers.value = res.data
      total.value = res.pagination.total
      if (!allProducers.value.length) allProducers.value = res.data
    }
  } finally {
    loading.value = false
  }
}

const debouncedSearch = useDebounceFn(() => {
  if (!searchYear.value) load()
}, 300)

watch(search, () => debouncedSearch())

async function loadSalesStats() {
  const sales = await getAllCached<Sale>('sales')
  cachedSales.value = sales
  const allMap: Record<string, number> = {}
  const ytdMap: Record<string, number> = {}
  for (const s of sales) {
    if (s.status === 'cancelled') continue
    const t = s.total || 0
    allMap[s.producerId] = (allMap[s.producerId] || 0) + t
    if (s.saleDate >= '2026-01-01') {
      ytdMap[s.producerId] = (ytdMap[s.producerId] || 0) + t
    }
  }
  allTimeSales.value = allMap
  ytdSales.value = ytdMap
}

function producerStatus(producer: Producer): string {
  if (producer.status === 'inactive') return 'inactive'
  if (ytdSales.value[producer.producerId]) return 'active'
  return 'past'
}

// Sort state
const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc' | null>(null)

function toggleSort(key: string) {
  if (sortKey.value !== key) {
    sortKey.value = key
    sortDir.value = 'asc'
  } else if (sortDir.value === 'asc') {
    sortDir.value = 'desc'
  } else {
    sortKey.value = null
    sortDir.value = null
  }
}

const statusOrder: Record<string, number> = { active: 0, past: 1, inactive: 2 }

function getSortValue(producer: Producer, key: string): string | number {
  switch (key) {
    case 'producerId': return producer.producerId
    case 'status': return statusOrder[producerStatus(producer)] ?? 9
    case 'country': return producer.country || ''
    case 'code': return producer.code || ''
    case 'companyName': return producer.companyName || ''
    case 'allTimeSales': return allTimeSales.value[producer.producerId] || 0
    case 'ytdSales': return activeYtdMap.value[producer.producerId] || 0
    default: return ''
  }
}

onMounted(() => {
  load()
  loadSalesStats()
})

const tableData = computed(() => {
  const base = searchYear.value
    ? allProducers.value.filter(p => yearSales.value && yearSales.value[p.producerId])
    : producers.value
  if (!base.length) return base
  const ytdMap = activeYtdMap.value
  const summary = {
    producerId: `${base.length}`,
    status: 'active',
    country: `${new Set(base.map(p => p.country).filter(Boolean)).size}`,
    code: '',
    companyName: '',
    _summary: true,
    _activeCount: base.filter(p => producerStatus(p) === 'active').length,
    _pastCount: base.filter(p => producerStatus(p) === 'past').length,
    _inactiveCount: base.filter(p => producerStatus(p) === 'inactive').length,
    _allTimeSales: base.reduce((sum, p) => sum + (allTimeSales.value[p.producerId] || 0), 0),
    _ytdSales: base.reduce((sum, p) => sum + (ytdMap[p.producerId] || 0), 0),
  } as any
  const sorted = [...base].sort((a, b) => {
    if (sortKey.value && sortDir.value) {
      const va = getSortValue(a, sortKey.value)
      const vb = getSortValue(b, sortKey.value)
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb))
      return sortDir.value === 'desc' ? -cmp : cmp
    }
    const sa = statusOrder[producerStatus(a)] ?? 9
    const sb = statusOrder[producerStatus(b)] ?? 9
    if (sa !== sb) return sa - sb
    return (a.code || '').localeCompare(b.code || '')
  })
  return [summary, ...sorted]
})

const router = useRouter()
function onSelectProducer(_e: Event, row: any) {
  if (row.original._summary) return
  router.push(`/producers/${row.original.producerId}`)
}
</script>

<template>
  <div>
    <div class="px-4 sm:px-0 flex items-center gap-3 mb-4">
      <h1 class="text-2xl font-bold shrink-0">Producers</h1>
      <div class="ml-auto flex items-center gap-2">
        <UInput v-model="search" icon="i-lucide-search" class="w-32" size="md" />
        <NuxtLink v-if="canWrite" to="/producers/new">
          <UButton icon="i-lucide-plus">New Producer</UButton>
        </NuxtLink>
      </div>
    </div>

    <div class="sm:rounded-lg sm:ring ring-(--ui-border) bg-(--ui-bg)">
      <UTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        sticky
        :ui="{
          root: '!overflow-visible w-full',
          base: 'w-full',
          thead: '!top-(--ui-header-height) z-10 !bg-(--ui-bg)',
          tr: 'even:bg-(--ui-bg-elevated)/50 hover:bg-(--ui-bg-accented) transition-colors cursor-pointer',
        }"
        @select="onSelectProducer"
      >
        <template #producerId-header>
          <button class="inline-flex items-center gap-1" @click="toggleSort('producerId')">
            ID
            <UIcon v-if="sortKey === 'producerId'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #status-header>
          <button class="inline-flex items-center gap-1" @click="toggleSort('status')">
            Status
            <UIcon v-if="sortKey === 'status'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #country-header>
          <button class="inline-flex items-center gap-1" @click="toggleSort('country')">
            Country
            <UIcon v-if="sortKey === 'country'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #code-header>
          <button class="inline-flex items-center gap-1" @click="toggleSort('code')">
            Code
            <UIcon v-if="sortKey === 'code'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #companyName-header>
          <button class="inline-flex items-center gap-1" @click="toggleSort('companyName')">
            Company Name
            <UIcon v-if="sortKey === 'companyName'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #allTimeSales-header>
          <button class="inline-flex items-center gap-1 ml-auto" @click="toggleSort('allTimeSales')">
            Sales €
            <UIcon v-if="sortKey === 'allTimeSales'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #ytdSales-header>
          <button class="inline-flex items-center gap-1 ml-auto" @click="toggleSort('ytdSales')">
            {{ ytdLabel }}
            <UIcon v-if="sortKey === 'ytdSales'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #producerId-cell="{ row }">
          <span v-if="row.original._summary" class="text-sm font-semibold">{{ row.original.producerId }}<span class="hidden min-[580px]:inline"> producers</span></span>
          <span v-else class="text-sm tabular-nums">
            <span class="hidden min-[580px]:inline">{{ row.original.producerId }}</span>
            <span class="min-[580px]:hidden">{{ row.original.producerId.replace('PRODUCER', '') }}</span>
          </span>
        </template>
        <template #status-cell="{ row }">
          <div v-if="row.original._summary" class="flex flex-wrap gap-1">
            <UBadge :label="`${row.original._activeCount}`" color="success" variant="subtle" size="xs" />
            <UBadge :label="`${row.original._pastCount}`" color="warning" variant="subtle" size="xs" />
            <UBadge :label="`${row.original._inactiveCount}`" color="neutral" variant="subtle" size="xs" />
          </div>
          <StatusBadge v-else :status="producerStatus(row.original)" />
        </template>
        <template #country-cell="{ row }">
          <span v-if="row.original._summary" class="text-sm font-semibold">{{ row.original.country }} countries</span>
          <span v-else-if="row.original.country" class="inline-flex items-center gap-1.5">
            <UIcon :name="`circle-flags:${toAlpha2(row.original.country).toLowerCase()}`" class="size-4" mode="svg" />
            <span class="hidden min-[580px]:inline">{{ row.original.country }}</span>
          </span>
          <span v-else class="text-(--ui-text-muted)">—</span>
        </template>
        <template #code-cell="{ row }">
          <span v-if="!row.original._summary" class="font-semibold text-(--ui-text-highlighted)">{{ row.original.code || '—' }}</span>
        </template>
        <template #companyName-cell="{ row }">
          <div v-if="!row.original._summary" class="font-medium truncate">{{ row.original.companyName }}</div>
        </template>
        <template #allTimeSales-cell="{ row }">
          <div v-if="row.original._summary" class="text-right text-sm font-semibold tabular-nums">{{ formatNumber(row.original._allTimeSales, 0) }}</div>
          <div v-else-if="allTimeSales[row.original.producerId]" class="text-right text-sm font-medium tabular-nums">{{ formatNumber(allTimeSales[row.original.producerId], 0) }}</div>
        </template>
        <template #ytdSales-cell="{ row }">
          <div v-if="row.original._summary" class="text-right text-sm font-semibold tabular-nums text-(--ui-text-highlighted)">{{ formatNumber(row.original._ytdSales, 0) }}</div>
          <div v-else-if="activeYtdMap[row.original.producerId]" class="text-right text-sm font-medium tabular-nums text-(--ui-text-highlighted)">{{ formatNumber(activeYtdMap[row.original.producerId], 0) }}</div>
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
    </div>
  </div>
</template>

<style scoped>
@media (min-width: 640px) {
  :deep(thead tr:first-child th:first-child) { border-top-left-radius: var(--radius-lg); }
  :deep(thead tr:first-child th:last-child) { border-top-right-radius: var(--radius-lg); }
  :deep(tbody tr:last-child td:first-child) { border-bottom-left-radius: var(--radius-lg); }
  :deep(tbody tr:last-child td:last-child) { border-bottom-right-radius: var(--radius-lg); }
}

:deep(tbody tr:first-child td) {
  position: sticky;
  top: calc(var(--ui-header-height) + 45px);
  z-index: 9;
  background: color-mix(in srgb, var(--color-success-500) 15%, var(--ui-bg));
}
:deep(tbody tr:first-child) { cursor: default; }
:deep(tbody tr:first-child:hover td) {
  background: color-mix(in srgb, var(--color-success-500) 15%, var(--ui-bg));
}
</style>
