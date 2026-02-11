<script setup lang="ts">
import type { Sale, Buyer, Producer } from '~/types'

defineProps<{
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  toggleSidebar: []
}>()

const router = useRouter()
const { searchAll } = useSearch()
const { formatCurrency, formatDate } = useFormatters()

const searchQuery = ref('')
const showResults = ref(false)
const loading = ref(false)
const activeIndex = ref(-1)
const inputRef = ref<HTMLInputElement>()
const mobileInputRef = ref<HTMLInputElement>()
const resultsRef = ref<HTMLElement>()
const mobileSearchOpen = ref(false)

const results = ref<{ sales: Sale[]; buyers: Buyer[]; producers: Producer[] }>({
  sales: [],
  buyers: [],
  producers: [],
})

const totalCount = computed(() =>
  results.value.sales.length + results.value.buyers.length + results.value.producers.length,
)

// Flat list of all results for keyboard navigation
const flatResults = computed(() => {
  const items: { type: 'sale' | 'buyer' | 'producer'; item: Sale | Buyer | Producer }[] = []
  for (const s of results.value.sales) items.push({ type: 'sale', item: s })
  for (const b of results.value.buyers) items.push({ type: 'buyer', item: b })
  for (const p of results.value.producers) items.push({ type: 'producer', item: p })
  return items
})

let debounceTimer: ReturnType<typeof setTimeout>

function onInput() {
  clearTimeout(debounceTimer)
  const q = searchQuery.value.trim()
  if (q.length < 2) {
    results.value = { sales: [], buyers: [], producers: [] }
    showResults.value = false
    return
  }
  loading.value = true
  showResults.value = true
  activeIndex.value = -1
  debounceTimer = setTimeout(async () => {
    try {
      results.value = await searchAll(q)
    } catch {
      results.value = { sales: [], buyers: [], producers: [] }
    } finally {
      loading.value = false
    }
  }, 300)
}

function onFocus() {
  if (searchQuery.value.trim().length >= 2) {
    showResults.value = true
  }
}

function onBlur() {
  setTimeout(() => { showResults.value = false }, 200)
}

function onKeydown(e: KeyboardEvent) {
  if (!showResults.value) {
    if (e.key === 'Escape' && mobileSearchOpen.value) {
      closeMobileSearch()
    }
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, flatResults.value.length - 1)
    scrollActiveIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, -1)
    scrollActiveIntoView()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (activeIndex.value >= 0 && activeIndex.value < flatResults.value.length) {
      navigate(flatResults.value[activeIndex.value])
    }
  } else if (e.key === 'Escape') {
    showResults.value = false
    inputRef.value?.blur()
    mobileInputRef.value?.blur()
    closeMobileSearch()
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = resultsRef.value?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function navigate(entry: { type: string; item: Sale | Buyer | Producer }) {
  showResults.value = false
  searchQuery.value = ''
  mobileSearchOpen.value = false
  if (entry.type === 'sale') router.push(`/sales/${(entry.item as Sale).saleId}`)
  else if (entry.type === 'buyer') router.push(`/buyers/${(entry.item as Buyer).buyerId}`)
  else if (entry.type === 'producer') router.push(`/producers/${(entry.item as Producer).producerId}`)
}

function clearSearch() {
  searchQuery.value = ''
  results.value = { sales: [], buyers: [], producers: [] }
  showResults.value = false
}

function openMobileSearch() {
  mobileSearchOpen.value = true
  nextTick(() => mobileInputRef.value?.focus())
}

function closeMobileSearch() {
  mobileSearchOpen.value = false
  searchQuery.value = ''
  results.value = { sales: [], buyers: [], producers: [] }
  showResults.value = false
}

// Global Ctrl+K / Cmd+K shortcut
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    inputRef.value?.focus()
  }
}
onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => document.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <header class="fixed top-0 left-0 right-0 h-[var(--header-height)] bg-white border-b border-gray-200 z-40 flex items-center px-4 gap-4">
    <!-- Hamburger -->
    <button class="btn-ghost p-2" @click="emit('toggleSidebar')">
      <div class="i-mdi-menu text-xl" />
    </button>

    <!-- Logo (mobile) -->
    <NuxtLink to="/" class="font-bold text-primary-700 text-lg md:hidden">
      i3speedex
    </NuxtLink>

    <!-- Desktop Search -->
    <div class="flex-1 max-w-xl mx-auto hidden md:block relative">
      <div class="relative">
        <div class="i-mdi-magnify absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="text"
          placeholder="Cerca vendite, acquirenti, produttori... (⌘K)"
          class="input-base pl-10 pr-8"
          @input="onInput"
          @focus="onFocus"
          @blur="onBlur"
          @keydown="onKeydown"
        >
        <button
          v-if="searchQuery"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 i-mdi-close-circle text-sm"
          @mousedown.prevent="clearSearch"
        />
      </div>

      <!-- Desktop Search Results -->
      <div
        v-if="showResults && !mobileSearchOpen"
        ref="resultsRef"
        class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-96 overflow-y-auto z-50"
      >
        <div v-if="loading" class="px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
          <div class="i-mdi-loading animate-spin" />
          Ricerca in corso...
        </div>
        <div v-else-if="totalCount === 0 && searchQuery.trim().length >= 2" class="px-4 py-6 text-center text-sm text-gray-500">
          <div class="i-mdi-magnify-close text-2xl mx-auto mb-2 text-gray-300" />
          Nessun risultato per "{{ searchQuery }}"
        </div>
        <template v-else>
          <div v-if="results.sales.length > 0">
            <div class="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase bg-gray-50 sticky top-0">Vendite ({{ results.sales.length }})</div>
            <button v-for="(sale, i) in results.sales" :key="sale.saleId" class="w-full px-3 py-2 flex items-center gap-3 text-left text-sm hover:bg-gray-50 transition-colors" :class="{ 'bg-primary-50': activeIndex === i }" :data-active="activeIndex === i" @mousedown.prevent="navigate({ type: 'sale', item: sale })" @mouseenter="activeIndex = i">
              <div class="i-mdi-receipt-text-outline text-primary-500 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 truncate">#{{ sale.saleNumber }} — {{ sale.buyerName }}</div>
                <div class="text-xs text-gray-500">{{ formatDate(sale.saleDate) }} · {{ formatCurrency(sale.total) }}</div>
              </div>
              <span class="badge text-xs shrink-0" :class="{ 'bg-gray-100 text-gray-600': sale.status === 'draft', 'bg-primary-100 text-primary-700': sale.status === 'confirmed', 'bg-warning-100 text-warning-700': sale.status === 'invoiced', 'bg-success-100 text-success-700': sale.status === 'paid', 'bg-danger-100 text-danger-700': sale.status === 'cancelled' }">{{ sale.status }}</span>
            </button>
          </div>
          <div v-if="results.buyers.length > 0">
            <div class="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase bg-gray-50 sticky top-0">Acquirenti ({{ results.buyers.length }})</div>
            <button v-for="(buyer, i) in results.buyers" :key="buyer.buyerId" class="w-full px-3 py-2 flex items-center gap-3 text-left text-sm hover:bg-gray-50 transition-colors" :class="{ 'bg-primary-50': activeIndex === results.sales.length + i }" :data-active="activeIndex === results.sales.length + i" @mousedown.prevent="navigate({ type: 'buyer', item: buyer })" @mouseenter="activeIndex = results.sales.length + i">
              <div class="i-mdi-domain text-blue-500 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 truncate">{{ buyer.companyName }}</div>
                <div class="text-xs text-gray-500">{{ buyer.city }} · {{ buyer.country }}</div>
              </div>
            </button>
          </div>
          <div v-if="results.producers.length > 0">
            <div class="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase bg-gray-50 sticky top-0">Produttori ({{ results.producers.length }})</div>
            <button v-for="(producer, i) in results.producers" :key="producer.producerId" class="w-full px-3 py-2 flex items-center gap-3 text-left text-sm hover:bg-gray-50 transition-colors" :class="{ 'bg-primary-50': activeIndex === results.sales.length + results.buyers.length + i }" :data-active="activeIndex === results.sales.length + results.buyers.length + i" @mousedown.prevent="navigate({ type: 'producer', item: producer })" @mouseenter="activeIndex = results.sales.length + results.buyers.length + i">
              <div class="i-mdi-factory text-amber-500 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 truncate">{{ producer.companyName }}</div>
                <div class="text-xs text-gray-500">{{ producer.city }} · {{ producer.country }}</div>
              </div>
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Mobile spacer / search button -->
    <div class="flex-1 md:hidden" />
    <button class="btn-ghost p-2 md:hidden" @click="openMobileSearch">
      <div class="i-mdi-magnify text-xl" />
    </button>

    <!-- User menu -->
    <UserMenu />

    <!-- Mobile Search Overlay -->
    <Transition name="fade">
      <div v-if="mobileSearchOpen" class="fixed inset-0 z-50 bg-white md:hidden">
        <div class="flex items-center h-[var(--header-height)] px-4 gap-3 border-b border-gray-200">
          <button class="btn-ghost p-2 shrink-0" @click="closeMobileSearch">
            <div class="i-mdi-arrow-left text-xl" />
          </button>
          <div class="flex-1 relative">
            <div class="i-mdi-magnify absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref="mobileInputRef"
              v-model="searchQuery"
              type="text"
              placeholder="Cerca..."
              class="input-base pl-10 pr-8"
              @input="onInput"
              @keydown="onKeydown"
            >
            <button
              v-if="searchQuery"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 i-mdi-close-circle text-sm"
              @click="clearSearch"
            />
          </div>
        </div>

        <!-- Mobile Search Results -->
        <div class="overflow-y-auto" style="max-height: calc(100vh - var(--header-height))">
          <div v-if="loading" class="px-4 py-6 flex items-center justify-center gap-2 text-sm text-gray-500">
            <div class="i-mdi-loading animate-spin" />
            Ricerca in corso...
          </div>
          <div v-else-if="totalCount === 0 && searchQuery.trim().length >= 2" class="px-4 py-12 text-center text-sm text-gray-500">
            <div class="i-mdi-magnify-close text-3xl mx-auto mb-2 text-gray-300" />
            Nessun risultato per "{{ searchQuery }}"
          </div>
          <div v-else-if="searchQuery.trim().length < 2 && !loading" class="px-4 py-12 text-center text-sm text-gray-400">
            Digita almeno 2 caratteri per cercare
          </div>
          <template v-else>
            <div v-if="results.sales.length > 0">
              <div class="px-4 py-2 text-xs font-medium text-gray-400 uppercase bg-gray-50 sticky top-0">Vendite ({{ results.sales.length }})</div>
              <button v-for="sale in results.sales" :key="sale.saleId" class="w-full px-4 py-3 flex items-center gap-3 text-left text-sm border-b border-gray-50 active:bg-gray-50" @click="navigate({ type: 'sale', item: sale })">
                <div class="i-mdi-receipt-text-outline text-primary-500 shrink-0 text-lg" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-gray-900 truncate">#{{ sale.saleNumber }} — {{ sale.buyerName }}</div>
                  <div class="text-xs text-gray-500">{{ formatDate(sale.saleDate) }} · {{ formatCurrency(sale.total) }}</div>
                </div>
              </button>
            </div>
            <div v-if="results.buyers.length > 0">
              <div class="px-4 py-2 text-xs font-medium text-gray-400 uppercase bg-gray-50 sticky top-0">Acquirenti ({{ results.buyers.length }})</div>
              <button v-for="buyer in results.buyers" :key="buyer.buyerId" class="w-full px-4 py-3 flex items-center gap-3 text-left text-sm border-b border-gray-50 active:bg-gray-50" @click="navigate({ type: 'buyer', item: buyer })">
                <div class="i-mdi-domain text-blue-500 shrink-0 text-lg" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-gray-900 truncate">{{ buyer.companyName }}</div>
                  <div class="text-xs text-gray-500">{{ buyer.city }} · {{ buyer.country }}</div>
                </div>
              </button>
            </div>
            <div v-if="results.producers.length > 0">
              <div class="px-4 py-2 text-xs font-medium text-gray-400 uppercase bg-gray-50 sticky top-0">Produttori ({{ results.producers.length }})</div>
              <button v-for="producer in results.producers" :key="producer.producerId" class="w-full px-4 py-3 flex items-center gap-3 text-left text-sm border-b border-gray-50 active:bg-gray-50" @click="navigate({ type: 'producer', item: producer })">
                <div class="i-mdi-factory text-amber-500 shrink-0 text-lg" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-gray-900 truncate">{{ producer.companyName }}</div>
                  <div class="text-xs text-gray-500">{{ producer.city }} · {{ producer.country }}</div>
                </div>
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </header>
</template>
