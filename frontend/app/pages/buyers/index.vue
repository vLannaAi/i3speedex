<script setup lang="ts">
import type { Buyer, Sale } from '~/types'
import { useDebounceFn } from '@vueuse/core'
import { toAlpha2 } from '~/utils/constants'

const { fetchBuyers } = useCachedBuyers()
const { getAllCached } = useCache()
const { formatNumber } = useFormatters()
const { canWrite } = useAuth()

const buyers = ref<Buyer[]>([])
const allBuyers = ref<Buyer[]>([])
const loading = ref(true)
const total = ref(0)
const search = ref('')
const allTimeSales = ref<Record<string, number>>({})
const ytdSales = ref<Record<string, number>>({})
const toPay = ref<Record<string, number>>({})
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
      map[s.buyerId] = (map[s.buyerId] || 0) + (s.total || 0)
    }
  }
  return map
})

// The active YTD/year map and column label
const activeYtdMap = computed(() => yearSales.value || ytdSales.value)
const ytdLabel = computed(() => searchYear.value ? `${searchYear.value} €` : 'YTD €')

const columns = [
  { accessorKey: 'buyerId', header: 'ID', size: 90, meta: { class: { td: 'w-[90px] min-[580px]:w-[90px]' } } },
  { accessorKey: 'status', header: 'Status', size: 85, meta: { class: { th: 'hidden min-[580px]:table-cell', td: 'hidden min-[580px]:table-cell w-[85px]' } } },
  { accessorKey: 'country', header: 'Country', size: 80, meta: { class: { td: 'w-[80px] max-[579px]:w-[40px]' } } },
  { accessorKey: 'code', header: 'Code', size: 100, meta: { class: { td: 'w-[100px]' } } },
  { accessorKey: 'companyName', header: 'Company Name', meta: { class: { th: 'hidden min-[860px]:table-cell', td: 'hidden min-[860px]:table-cell max-w-0 overflow-hidden' } } },
  { accessorKey: 'allTimeSales', header: 'Sales \u20AC', size: 100, meta: { class: { th: 'hidden min-[860px]:table-cell', td: 'hidden min-[860px]:table-cell w-[100px]' } } },
  { accessorKey: 'ytdSales', header: 'YTD \u20AC', size: 100, meta: { class: { td: 'w-[100px]' } } },
  { accessorKey: 'toPay', header: 'To Pay \u20AC', size: 100, meta: { class: { td: 'w-[100px]' } } },
]

const showing = computed(() => {
  if (total.value === 0) return 'No records found'
  return `${total.value} records`
})

async function load() {
  loading.value = true
  try {
    const res = await fetchBuyers({
      page: 1,
      pageSize: 10000,
      search: search.value || undefined,
    })
    if (res) {
      buyers.value = res.data
      total.value = res.pagination.total
      if (!allBuyers.value.length) allBuyers.value = res.data
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
  const payMap: Record<string, number> = {}
  for (const s of sales) {
    if (s.status === 'cancelled') continue
    const t = s.total || 0
    allMap[s.buyerId] = (allMap[s.buyerId] || 0) + t
    if (s.saleDate >= '2026-01-01') {
      ytdMap[s.buyerId] = (ytdMap[s.buyerId] || 0) + t
    }
    if (s.status === 'sent') {
      payMap[s.buyerId] = (payMap[s.buyerId] || 0) + t
    }
  }
  allTimeSales.value = allMap
  ytdSales.value = ytdMap
  toPay.value = payMap
}

function buyerStatus(buyer: Buyer): string {
  if (buyer.status === 'inactive') return 'inactive'
  if (ytdSales.value[buyer.buyerId]) return 'active'
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

function getSortValue(buyer: Buyer, key: string): string | number {
  switch (key) {
    case 'buyerId': return buyer.buyerId
    case 'status': return statusOrder[buyerStatus(buyer)] ?? 9
    case 'country': return buyer.country || ''
    case 'code': return buyer.code || ''
    case 'companyName': return buyer.companyName || ''
    case 'allTimeSales': return allTimeSales.value[buyer.buyerId] || 0
    case 'ytdSales': return activeYtdMap.value[buyer.buyerId] || 0
    case 'toPay': return toPay.value[buyer.buyerId] || 0
    default: return ''
  }
}

onMounted(() => {
  load()
  loadSalesStats()
})

const tableData = computed(() => {
  // When year is searched, filter full buyer list to those with sales in that year
  const base = searchYear.value
    ? allBuyers.value.filter(b => yearSales.value && yearSales.value[b.buyerId])
    : buyers.value
  if (!base.length) return base
  const ytdMap = activeYtdMap.value
  const summary = {
    buyerId: `${base.length}`,
    status: 'active',
    country: `${new Set(base.map(b => b.country).filter(Boolean)).size}`,
    code: '',
    companyName: '',
    _summary: true,
    _activeCount: base.filter(b => buyerStatus(b) === 'active').length,
    _pastCount: base.filter(b => buyerStatus(b) === 'past').length,
    _inactiveCount: base.filter(b => buyerStatus(b) === 'inactive').length,
    _allTimeSales: base.reduce((sum, b) => sum + (allTimeSales.value[b.buyerId] || 0), 0),
    _ytdSales: base.reduce((sum, b) => sum + (ytdMap[b.buyerId] || 0), 0),
    _toPay: base.reduce((sum, b) => sum + (toPay.value[b.buyerId] || 0), 0),
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
    // Default: status (active → past → inactive), then code alphabetic
    const sa = statusOrder[buyerStatus(a)] ?? 9
    const sb = statusOrder[buyerStatus(b)] ?? 9
    if (sa !== sb) return sa - sb
    return (a.code || '').localeCompare(b.code || '')
  })
  return [summary, ...sorted]
})

const router = useRouter()
function onSelectBuyer(_e: Event, row: any) {
  if (row.original._summary) return
  router.push(`/buyers/${row.original.buyerId}`)
}
</script>

<template>
  <div>
    <div class="px-9 flex items-center gap-3 mb-4 mt-4">
      <h1 class="text-2xl font-bold shrink-0">Buyers</h1>
      <NuxtLink v-if="canWrite" to="/buyers/new">
        <UButton
          icon="i-lucide-plus"
          label="New"
          variant="outline"
          color="primary"
          class="bg-(--ui-bg) ring-primary text-primary hover:bg-(--ui-bg-accented)"
        />
      </NuxtLink>
      <div class="ml-auto flex items-center gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          class="w-32"
          size="md"
          :ui="{ icon: { trailing: { pointerEvents: 'auto' } } }"
        >
          <template v-if="search" #trailing>
            <UButton color="gray" variant="link" icon="i-lucide-x" :padded="false" @click="search = ''" />
          </template>
        </UInput>
      </div>
    </div>

    <div class="rounded-none ring-0 sm:rounded-lg sm:ring ring-(--ui-border) bg-(--ui-bg)">
      <UTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        sticky
        :ui="{
          root: '!overflow-visible w-full',
          base: 'w-full',
          thead: 'sticky top-16 z-10 bg-primary text-white font-normal text-sm',
          th: { color: 'text-white', base: 'first:!pl-9' },
          tr: 'hover:bg-(--ui-bg-accented) transition-colors cursor-pointer',
          td: { base: 'whitespace-nowrap first:!pl-9' },
        }"
        @select="onSelectBuyer"
      >
        <template #buyerId-header>
          <button class="inline-flex items-center gap-1 text-white" @click="toggleSort('buyerId')">
            ID
            <UIcon v-if="sortKey === 'buyerId'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #status-header>
          <button class="inline-flex items-center gap-1 text-white" @click="toggleSort('status')">
            Status
            <UIcon v-if="sortKey === 'status'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #country-header>
          <button class="inline-flex items-center gap-1 text-white" @click="toggleSort('country')">
            Country
            <UIcon v-if="sortKey === 'country'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #code-header>
          <button class="inline-flex items-center gap-1 text-white" @click="toggleSort('code')">
            Code
            <UIcon v-if="sortKey === 'code'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #companyName-header>
          <button class="inline-flex items-center gap-1 text-white" @click="toggleSort('companyName')">
            Company Name
            <UIcon v-if="sortKey === 'companyName'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
          </button>
        </template>
        <template #buyerId-cell="{ row }">
          <span v-if="row.original._summary" class="text-sm font-semibold">{{ row.original.buyerId }}<span class="hidden min-[580px]:inline"> buyers</span></span>
          <span v-else class="text-xs !font-mono tabular-nums text-(--ui-text-muted)">
            #<span class="text-(--ui-text) font-medium">{{ row.original.buyerId.replace('BUYER', '') }}</span>
          </span>
        </template>
        <template #status-cell="{ row }">
          <div v-if="row.original._summary" class="flex flex-wrap gap-1">
            <UBadge :label="`${row.original._activeCount}`" color="success" variant="subtle" size="xs" />
            <UBadge :label="`${row.original._pastCount}`" color="warning" variant="subtle" size="xs" />
            <UBadge :label="`${row.original._inactiveCount}`" color="neutral" variant="subtle" size="xs" />
          </div>
          <StatusBadge v-else :status="buyerStatus(row.original)" />
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
        <template #allTimeSales-header>
          <div class="flex justify-start w-full">
            <button class="inline-flex items-center gap-1 text-white" @click="toggleSort('allTimeSales')">
              Sales €
              <UIcon v-if="sortKey === 'allTimeSales'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
            </button>
          </div>
        </template>
        <template #allTimeSales-cell="{ row }">
          <div v-if="row.original._summary" class="text-left text-sm font-semibold tabular-nums">{{ formatNumber(row.original._allTimeSales, 0) }}</div>
          <div v-else-if="allTimeSales[row.original.buyerId]" class="text-left text-sm font-medium tabular-nums">{{ formatNumber(allTimeSales[row.original.buyerId], 0) }}</div>
        </template>
        <template #ytdSales-header>
          <div class="flex justify-start w-full">
            <button class="inline-flex items-center gap-1 text-white" @click="toggleSort('ytdSales')">
              {{ ytdLabel }}
              <UIcon v-if="sortKey === 'ytdSales'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
            </button>
          </div>
        </template>
        <template #ytdSales-cell="{ row }">
          <div v-if="row.original._summary" class="text-left text-sm font-semibold tabular-nums text-(--ui-text-highlighted)">{{ formatNumber(row.original._ytdSales, 0) }}</div>
          <div v-else-if="activeYtdMap[row.original.buyerId]" class="text-left text-sm font-medium tabular-nums text-(--ui-text-highlighted)">{{ formatNumber(activeYtdMap[row.original.buyerId], 0) }}</div>
        </template>
        <template #toPay-header>
          <div class="flex justify-start w-full">
            <button class="inline-flex items-center gap-1 text-white" @click="toggleSort('toPay')">
              To Pay €
              <UIcon v-if="sortKey === 'toPay'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
            </button>
          </div>
        </template>
        <template #toPay-cell="{ row }">
          <div v-if="row.original._summary" class="text-right text-sm font-semibold tabular-nums text-red-500">{{ formatNumber(row.original._toPay, 0) }}</div>
          <div v-else-if="toPay[row.original.buyerId]" class="text-right text-sm font-medium tabular-nums text-red-500">{{ formatNumber(toPay[row.original.buyerId], 0) }}</div>
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
    </div>
  </div>
</template>

<style scoped>
/* Round table corners to match container */
@media (min-width: 640px) {
  :deep(thead tr:first-child th:first-child) {
    border-top-left-radius: var(--radius-lg);
  }
  :deep(thead tr:first-child th:last-child) {
    border-top-right-radius: var(--radius-lg);
  }
  :deep(tbody tr:last-child td:first-child) {
    border-bottom-left-radius: var(--radius-lg);
  }
  :deep(tbody tr:last-child td:last-child) {
    border-bottom-right-radius: var(--radius-lg);
  }
}

/* Summary row: sticky + accent background matching Active badge */
:deep(tbody tr:first-child td) {
  position: static !important;
  z-index: 9;
  background: var(--ui-bg-elevated);
  font-weight: 600;
}
:deep(tbody tr:first-child) {
  cursor: default;
}
:deep(tbody tr:first-child:hover td) {
  background: var(--ui-bg-elevated);
}
</style>
