<script setup lang="ts">
import type { Sale, Buyer, Producer } from '~/types'

const { user, isAdmin, isOperator, logout } = useAuth()
const { searchAll } = useSearch()
const { formatCurrency, formatDate } = useFormatters()
const router = useRouter()

// Offline detection
const isOffline = ref(false)
if (import.meta.client) {
  isOffline.value = !navigator.onLine
  window.addEventListener('online', () => { isOffline.value = false })
  window.addEventListener('offline', () => { isOffline.value = true })
}

// Search
const searchOpen = ref(false)
const searchQuery = ref('')
const searchLoading = ref(false)
const searchResults = ref<{ sales: Sale[]; buyers: Buyer[]; producers: Producer[] }>({
  sales: [], buyers: [], producers: [],
})
const searchInputRef = ref<HTMLInputElement>()

let debounceTimer: ReturnType<typeof setTimeout>

function onSearchInput() {
  clearTimeout(debounceTimer)
  const q = searchQuery.value.trim()
  if (q.length < 2) {
    searchResults.value = { sales: [], buyers: [], producers: [] }
    return
  }
  searchLoading.value = true
  debounceTimer = setTimeout(async () => {
    try {
      searchResults.value = await searchAll(q)
    } catch {
      searchResults.value = { sales: [], buyers: [], producers: [] }
    } finally {
      searchLoading.value = false
    }
  }, 300)
}

const totalCount = computed(() =>
  searchResults.value.sales.length + searchResults.value.buyers.length + searchResults.value.producers.length,
)

function navigateSearch(type: string, item: Sale | Buyer | Producer) {
  searchOpen.value = false
  searchQuery.value = ''
  searchResults.value = { sales: [], buyers: [], producers: [] }
  if (type === 'sale') router.push(`/sales/${(item as Sale).saleId}`)
  else if (type === 'buyer') router.push(`/buyers/${(item as Buyer).buyerId}`)
  else if (type === 'producer') router.push(`/producers/${(item as Producer).producerId}`)
}

watch(searchOpen, (open) => {
  if (open) {
    nextTick(() => searchInputRef.value?.focus())
  } else {
    searchQuery.value = ''
    searchResults.value = { sales: [], buyers: [], producers: [] }
  }
})

// Global Cmd+K shortcut
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    searchOpen.value = true
  }
}
onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => document.removeEventListener('keydown', onGlobalKeydown))

// User menu
const roleLabel = computed(() => {
  if (isAdmin.value) return 'Admin'
  if (isOperator.value) return 'Operator'
  return 'Viewer'
})

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const displayName = computed(() =>
  user.value?.givenName || user.value?.email || user.value?.username || '?',
)

const userMenuItems = computed(() => [
  [{
    label: user.value?.email || user.value?.username || '',
    type: 'label' as const,
  }],
  [{
    label: roleLabel.value,
    icon: 'i-lucide-shield',
    disabled: true,
  }],
  [{
    label: isDark.value ? 'Light Mode' : 'Dark Mode',
    icon: isDark.value ? 'i-lucide-sun' : 'i-lucide-moon',
    onSelect: () => { colorMode.preference = isDark.value ? 'light' : 'dark' },
  }],
  [{
    label: 'Sign Out',
    icon: 'i-lucide-log-out',
    color: 'error' as const,
    onSelect: () => logout(),
  }],
])

// Navigation
const navigationItems = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Sales', icon: 'i-lucide-receipt', to: '/sales' },
  { label: 'Buyers', icon: 'i-lucide-users', to: '/buyers' },
  { label: 'Producers', icon: 'i-lucide-factory', to: '/producers' },
]
</script>

<template>
  <div class="min-h-screen">
    <div class="sticky top-0 z-50 bg-(--ui-bg)">
      <UDashboardNavbar :toggle="false">
        <template #left>
          <UNavigationMenu
            :items="navigationItems"
            orientation="horizontal"
            :ui="{ linkLabel: 'hidden sm:inline' }"
          />
        </template>

        <template #right>
          <SyncStatusIndicator />
          <UButton
            icon="i-lucide-search"
            variant="ghost"
            color="neutral"
            square
            @click="searchOpen = true"
          />
          <UDropdownMenu :items="userMenuItems">
            <UButton variant="ghost">
              <span class="truncate text-sm">{{ displayName }}</span>
            </UButton>
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>
    </div>

    <UAlert
      v-if="isOffline"
      title="No connection — Changes will not be saved"
      icon="i-lucide-wifi-off"
      color="warning"
      variant="soft"
    />

    <div class="!px-0 !py-0 sm:px-6 sm:py-6 max-w-7xl mx-auto">
      <slot />
    </div>
  </div>

  <!-- Search Modal -->
  <UModal v-model:open="searchOpen" :close="false">
    <template #content>
      <div class="p-0">
        <!-- Search input -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-default">
          <UIcon name="i-lucide-search" class="size-5 text-muted shrink-0" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search sales, buyers, producers..."
            class="flex-1 bg-transparent outline-none text-sm placeholder:text-muted"
            @input="onSearchInput"
            @keydown.escape="searchOpen = false"
          >
          <UKbd>Esc</UKbd>
        </div>

        <!-- Results -->
        <div class="max-h-80 overflow-y-auto">
          <div v-if="searchLoading" class="px-4 py-6 flex items-center justify-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
            Searching...
          </div>
          <div v-else-if="totalCount === 0 && searchQuery.trim().length >= 2" class="px-4 py-8 text-center text-sm text-muted">
            No results for "{{ searchQuery }}"
          </div>
          <div v-else-if="searchQuery.trim().length < 2" class="px-4 py-8 text-center text-sm text-muted">
            Type at least 2 characters to search
          </div>
          <template v-else>
            <!-- Sales -->
            <div v-if="searchResults.sales.length">
              <div class="px-3 py-1.5 text-xs font-medium text-muted uppercase bg-elevated sticky top-0">
                Sales ({{ searchResults.sales.length }})
              </div>
              <button
                v-for="sale in searchResults.sales"
                :key="sale.saleId"
                class="w-full px-3 py-2 flex items-center gap-3 text-left text-sm hover:bg-elevated transition-colors"
                @click="navigateSearch('sale', sale)"
              >
                <UIcon name="i-lucide-receipt" class="size-4 text-primary shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">#{{ sale.saleNumber }} — {{ sale.buyerName }}</div>
                  <div class="text-xs text-muted">{{ formatDate(sale.saleDate) }} · {{ formatCurrency(sale.total) }}</div>
                </div>
                <UBadge
                  :label="sale.status"
                  :color="sale.status === 'paid' ? 'success' : sale.status === 'cancelled' ? 'error' : sale.status === 'sent' ? 'warning' : 'neutral'"
                  variant="subtle"
                  size="xs"
                />
              </button>
            </div>
            <!-- Buyers -->
            <div v-if="searchResults.buyers.length">
              <div class="px-3 py-1.5 text-xs font-medium text-muted uppercase bg-elevated sticky top-0">
                Buyers ({{ searchResults.buyers.length }})
              </div>
              <button
                v-for="buyer in searchResults.buyers"
                :key="buyer.buyerId"
                class="w-full px-3 py-2 flex items-center gap-3 text-left text-sm hover:bg-elevated transition-colors"
                @click="navigateSearch('buyer', buyer)"
              >
                <UIcon name="i-lucide-building-2" class="size-4 text-blue-500 shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{{ buyer.companyName }}</div>
                  <div class="text-xs text-muted">{{ buyer.city }} · {{ buyer.country }}</div>
                </div>
              </button>
            </div>
            <!-- Producers -->
            <div v-if="searchResults.producers.length">
              <div class="px-3 py-1.5 text-xs font-medium text-muted uppercase bg-elevated sticky top-0">
                Producers ({{ searchResults.producers.length }})
              </div>
              <button
                v-for="producer in searchResults.producers"
                :key="producer.producerId"
                class="w-full px-3 py-2 flex items-center gap-3 text-left text-sm hover:bg-elevated transition-colors"
                @click="navigateSearch('producer', producer)"
              >
                <UIcon name="i-lucide-factory" class="size-4 text-amber-500 shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{{ producer.companyName }}</div>
                  <div class="text-xs text-muted">{{ producer.city }} · {{ producer.country }}</div>
                </div>
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>
