<script setup lang="ts">
import type { Sale, Buyer } from '~/types'
import { useDebounceFn } from '@vueuse/core'
import { toAlpha2 } from '~/utils/constants'

const { fetchSales } = useCachedSales()
const { fetchBuyers } = useCachedBuyers()
const { getAllCached } = useCache()
const { formatNumber } = useFormatters()
const { canWrite } = useAuth()
const route = useRoute()
const router = useRouter()

const sales = ref<Sale[]>([])
const buyers = ref<Buyer[]>([])
const loading = ref(true)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = ref(0)

// Unified search: single source of truth
const search = ref((route.query.q as string) || '')
const inputFocused = ref(false)
const rawBeforeFocus = ref('')

const { activeFilters, displayString, toggleToken, isActive, hasActiveFilters, applyDisplayFormat } = useSearchQuery(search, buyers)

const { sortKey, sortDir, toggleSort: toggleSortBase, resetSort } = useTableSort()

function toggleSort(key: string) {
  toggleSortBase(key)
  page.value = 1
  load()
}

function clearSearch() {
  search.value = ''
  resetSort()
  page.value = 1
  load()
  router.replace({ query: {} })
}

function onInputFocus() {
  inputFocused.value = true
  rawBeforeFocus.value = search.value
}

function onInputBlur() {
  inputFocused.value = false
  applyDisplayFormat()
}

// Badge toggle: delegates to useSearchQuery then reloads
function onToggleToken(domain: Parameters<typeof toggleToken>[0], value: string) {
  toggleToken(domain, value)
  page.value = 1
  load()
}

// Year dropdown: toggle year in search
function onYearSelect(year: string) {
  if (!year) {
    // "All" selected — remove all year tokens
    const tokens = search.value.split(/\s+/).filter(Boolean)
    const cleaned = tokens.filter((t) => {
      const lower = t.toLowerCase()
      // Remove tokens that are 4-digit years or year ranges
      if (/^\d{4}$/.test(t)) return false
      if (/^\d{4}[–-]\d{4}$/.test(t)) return false
      if (['today', 'week', 'month'].includes(lower)) return false
      if (/^[qh][1-4]/i.test(t)) return false
      return true
    })
    search.value = cleaned.join(' ')
  } else {
    toggleToken('year', year)
  }
  page.value = 1
  load()
}

// Buyer dropdown: toggle buyer in search
function onBuyerSelect(buyerId: string) {
  if (!buyerId) {
    // "All" selected — remove all buyer tokens
    const tokens = search.value.split(/\s+/).filter(Boolean)
    const buyerCodes = new Set(buyers.value.filter(b => b.code).map(b => b.code!.toUpperCase()))
    const cleaned = tokens.filter(t => !buyerCodes.has(t.toUpperCase()))
    search.value = cleaned.join(' ')
  } else {
    toggleToken('buyer', buyerId)
  }
  page.value = 1
  load()
}

// Global stats from all sales (recomputed when filters change)
const globalStats = ref({
  total: 0,
  totalAmount: 0,
  totalLines: 0,
  uniqueBuyers: 0,
  docTypes: {} as Record<string, number>,
  statuses: {} as Record<string, number>,
  years: [] as string[],
})

const buyerCodeMap = computed(() => {
  const map: Record<string, string> = {}
  for (const b of buyers.value) {
    if (b.code) map[b.buyerId] = b.code
  }
  return map
})

const buyerCountryMap = computed(() => {
  const map: Record<string, string> = {}
  for (const b of buyers.value) {
    if (b.country) map[b.buyerId] = toAlpha2(b.country)
  }
  return map
})

const docTypeColor: Record<string, 'neutral' | 'primary'> = {
  proforma: 'neutral',
  invoice: 'primary',
}
const docTypeLabel: Record<string, string> = {
  proforma: 'PRO',
  invoice: 'INV',
}

const columns = [
  { accessorKey: 'saleId', header: 'ID', size: 80 },
  { accessorKey: 'docType', header: 'Doc', size: 70 },
  { accessorKey: 'status', header: 'Status', size: 90 },
  { accessorKey: 'regDate', header: 'Reg / Date', size: 150 },
  { accessorKey: 'buyerId', header: 'Buyer', size: 180 },
  { accessorKey: 'total', header: 'Total €', size: 100, meta: { class: { td: 'text-left' } } },
]

const showing = computed(() => {
  if (total.value === 0) return 'No records found'
  const from = (page.value - 1) * pageSize.value + 1
  const to = Math.min(page.value * pageSize.value, total.value)
  return `Showing ${from}-${to} of ${total.value} records`
})

// Year dropdown items — check marks driven by isActive
const yearMenuItems = computed(() => [
  [{
    label: `All (${globalStats.value.years.length} years)`,
    icon: !activeFilters.value.years.length && !activeFilters.value.yearRange ? 'i-lucide-check' : undefined,
    onSelect: () => onYearSelect(''),
  }],
  globalStats.value.years.map(y => ({
    label: y,
    icon: isActive('year', y) ? 'i-lucide-check' : undefined,
    onSelect: () => onYearSelect(y),
  })),
])

const yearLabel = computed(() => {
  const f = activeFilters.value
  if (f.years.length === 1) return f.years[0]
  if (f.years.length > 1) return f.years.join(',')
  if (f.yearRange) return `${f.yearRange.from}–${f.yearRange.to}`
  return `${globalStats.value.years.length} years`
})

// Buyer dropdown items — check marks driven by isActive
const buyerMenuItems = computed(() => {
  const sorted = [...buyers.value].filter(b => b.code).sort((a, b) => (a.code || '').localeCompare(b.code || ''))
  return [
    [{
      label: `All (${buyers.value.length} buyers)`,
      icon: activeFilters.value.buyerIds.length === 0 ? 'i-lucide-check' : undefined,
      onSelect: () => onBuyerSelect(''),
    }],
    sorted.map(b => ({
      label: b.code || b.companyName,
      icon: isActive('buyer', b.buyerId) ? 'i-lucide-check' : undefined,
      onSelect: () => onBuyerSelect(b.buyerId),
    })),
  ]
})

const buyerLabel = computed(() => {
  const ids = activeFilters.value.buyerIds
  if (ids.length === 0) return `${buyers.value.length} buyers`
  const names = ids.map((id) => {
    const b = buyers.value.find(b => b.buyerId === id)
    return b?.code || b?.companyName || id
  })
  return names.join(',')
})

const tableData = computed(() => {
  if (!sales.value.length) return sales.value
  const g = globalStats.value
  const summary = {
    saleId: `${total.value}`,
    docType: '',
    status: '',
    regDate: '',
    buyerId: '',
    total: 0,
    linesCount: 0,
    _summary: true,
    _proformaCount: g.statuses['proforma'] || 0,
    _sentCount: g.statuses['sent'] || 0,
    _paidCount: g.statuses['paid'] || 0,
    _cancelledCount: g.statuses['cancelled'] || 0,
    _proformaDocCount: g.docTypes['proforma'] || 0,
    _invoiceDocCount: g.docTypes['invoice'] || 0,
    _uniqueBuyers: g.uniqueBuyers,
    _total: g.totalAmount,
    _linesCount: g.totalLines,
  } as any
  return [summary, ...sales.value]
})

async function load() {
  loading.value = true
  try {
    const res = await fetchSales({
      page: page.value,
      pageSize: pageSize.value,
      filters: activeFilters.value,
      sortKey: sortKey.value || undefined,
      sortDir: sortDir.value || undefined,
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

async function loadGlobalStats() {
  const allSales = await getAllCached<Sale>('sales')
  const docTypes: Record<string, number> = {}
  const statuses: Record<string, number> = {}
  let totalAmount = 0
  let totalLines = 0
  const buyerSet = new Set<string>()
  const yearSet = new Set<string>()
  for (const s of allSales) {
    if (s.docType) docTypes[s.docType] = (docTypes[s.docType] || 0) + 1
    statuses[s.status] = (statuses[s.status] || 0) + 1
    totalAmount += s.total || 0
    totalLines += s.linesCount || 0
    buyerSet.add(s.buyerId)
    if (s.saleDate) yearSet.add(s.saleDate.slice(0, 4))
  }
  globalStats.value = {
    total: allSales.length,
    totalAmount,
    totalLines,
    uniqueBuyers: buyerSet.size,
    docTypes,
    statuses,
    years: [...yearSet].sort().reverse(),
  }
}

async function loadBuyers() {
  const res = await fetchBuyers({ pageSize: 100 })
  if (res) buyers.value = res.data
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
  // Sync search to URL
  const q = search.value.trim()
  router.replace({ query: q ? { q } : {} })
}, 300)

watch(search, () => debouncedSearch())

onMounted(() => {
  load()
  loadBuyers()
  loadGlobalStats()
})

function onSelectSale(_e: Event, row: any) {
  if (row.original._summary) return
  router.push(`/sales/${row.original.saleId}`)
}
</script>

<template>
  <div>
    <ListPageHeader title="Sales" new-to="/sales/new" :can-write="canWrite">
      <UInput
        v-model="search"
        class="w-64"
        size="md"
        :placeholder="hasActiveFilters ? '' : 'Search...'"
        :ui="{ icon: { trailing: { pointerEvents: 'auto' } } }"
        @focus="onInputFocus"
        @blur="onInputBlur"
      >
        <template #trailing>
           <UIcon
             v-if="search"
             name="i-lucide-x"
             class="cursor-pointer text-(--ui-text-muted) hover:text-(--ui-text)"
             @click="clearSearch"
           />
           <UIcon
             v-else
             name="i-lucide-search"
             class="text-(--ui-text-dimmed)"
           />
        </template>
      </UInput>
    </ListPageHeader>

    <AppTable :columns="columns" :data="tableData" :loading="loading" summary-style="primary" @select="onSelectSale">
      <template #saleId-header>
        <SortableHeader label="ID" column-key="saleId" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />
      </template>
      <template #docType-header>
        <SortableHeader label="Doc" column-key="docType" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />
      </template>
      <template #status-header>
        <SortableHeader label="Status" column-key="status" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />
      </template>
      <template #regDate-header>
        <SortableHeader label="Reg / Date" column-key="regDate" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />
      </template>
      <template #buyerId-header>
        <SortableHeader label="Buyer" column-key="buyerId" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />
      </template>
      <template #total-header>
        <SortableHeader label="Total €" column-key="total" :sort-key="sortKey" :sort-dir="sortDir" justify="start" @sort="toggleSort" />
      </template>
      <template #saleId-cell="{ row }">
        <span v-if="row.original._summary" class="text-sm font-semibold">{{ row.original.saleId }} sales</span>
        <span v-else class="text-xs !font-mono tabular-nums text-(--ui-text-muted)">
          #<span class="text-(--ui-text) font-medium">{{ row.original.saleId.replace('SALE', '') }}</span>
        </span>
      </template>
      <template #docType-cell="{ row }">
        <div v-if="row.original._summary" class="flex flex-wrap gap-1">
          <UBadge
            :label="`${row.original._proformaDocCount}`"
            color="neutral"
            :variant="isActive('docType', 'proforma') ? 'solid' : 'subtle'"
            size="xs"
            class="cursor-pointer"
            @click.stop="onToggleToken('docType', 'proforma')"
          />
          <UBadge
            :label="`${row.original._invoiceDocCount}`"
            color="primary"
            :variant="isActive('docType', 'invoice') ? 'solid' : 'subtle'"
            size="xs"
            class="cursor-pointer"
            @click.stop="onToggleToken('docType', 'invoice')"
          />
        </div>
        <UBadge
          v-else-if="row.original.docType"
          :label="docTypeLabel[row.original.docType] || row.original.docType"
          :color="docTypeColor[row.original.docType] || 'neutral'"
          variant="subtle"
          size="sm"
        />
        <span v-else class="text-xs text-(--ui-text-muted)">—</span>
      </template>
      <template #regDate-cell="{ row }">
        <div v-if="row.original._summary" @click.stop>
          <UDropdownMenu :items="yearMenuItems">
            <UButton size="xs" variant="ghost" :label="yearLabel" trailing-icon="i-lucide-chevron-down" />
          </UDropdownMenu>
        </div>
        <span v-else class="text-sm tabular-nums">
          {{ row.original.regNumber ? row.original.regNumber.split('/').reverse().join('/') : '—' }}
          <span class="opacity-60">{{ row.original.saleDate ? row.original.saleDate.slice(5).replace('-', '/') : '' }}</span>
        </span>
      </template>
      <template #buyerId-cell="{ row }">
        <div v-if="row.original._summary" @click.stop>
          <UDropdownMenu :items="buyerMenuItems" :ui="{ content: 'max-h-60 overflow-y-auto' }">
            <UButton size="xs" variant="ghost" :label="buyerLabel" trailing-icon="i-lucide-chevron-down" />
          </UDropdownMenu>
        </div>
        <span v-else class="inline-flex items-center gap-1.5 font-semibold truncate">
          <UIcon
            v-if="buyerCountryMap[row.original.buyerId]"
            :name="`circle-flags:${buyerCountryMap[row.original.buyerId]?.toLowerCase()}`"
            class="size-4 shrink-0"
            mode="svg"
          />
          {{ buyerCodeMap[row.original.buyerId] || row.original.buyerName }}
        </span>
      </template>
      <template #total-cell="{ row }">
        <div v-if="row.original._summary" class="text-right text-sm font-semibold tabular-nums">{{ formatNumber(row.original._total, 0) }}</div>
        <div v-else class="text-right text-sm font-medium tabular-nums">{{ formatNumber(row.original.total, 0) }}</div>
      </template>
      <template #status-cell="{ row }">
        <div v-if="row.original._summary" class="flex flex-wrap gap-1">
          <UBadge
            :label="`${row.original._sentCount}`"
            color="warning"
            :variant="isActive('status', 'sent') ? 'solid' : 'subtle'"
            size="xs"
            class="cursor-pointer"
            @click.stop="onToggleToken('status', 'sent')"
          />
          <UBadge
            :label="`${row.original._paidCount}`"
            color="success"
            :variant="isActive('status', 'paid') ? 'solid' : 'subtle'"
            size="xs"
            class="cursor-pointer"
            @click.stop="onToggleToken('status', 'paid')"
          />
        </div>
        <SaleStatusBadge v-else-if="row.original.status !== 'proforma'" :status="row.original.status" />
        <span v-else />
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
      <template #after>
        <TablePagination
          :page="page"
          :total="total"
          :page-size="pageSize"
          :showing="showing"
          @update:page="onPageChange"
          @update:page-size="onPageSizeChange"
        />
      </template>
    </AppTable>
  </div>
</template>
