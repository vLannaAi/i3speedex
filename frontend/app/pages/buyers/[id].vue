<script setup lang="ts">
import type { Buyer, Sale } from '~/types'
import { PAYMENT_METHODS, PAYMENT_TERMS, COUNTRIES, ITALIAN_PROVINCES } from '~/utils/constants'
import { getCountryDisplay, getProvinceDisplay, getPaymentMethodLabel, getPaymentTermsLabel } from '~/utils/display-helpers'

const route = useRoute()
const router = useRouter()
const buyerId = route.params.id as string

const { fetchBuyer, updateBuyer, deleteBuyer } = useCachedBuyers()
const { fetchSales } = useSales()
const { formatDate, formatCurrency, formatDateTime } = useFormatters()
const { canWrite } = useAuth()
const toast = useAppToast()

const buyer = ref<Buyer | null>(null)
const loading = ref(true)
const editing = ref(false)
const saving = ref(false)
const showDeleteDialog = ref(false)

// Sales history state (paginated table)
const buyerSales = ref<Sale[]>([])
const salesLoading = ref(false)
const salesPage = ref(1)
const salesPageSize = ref(10)
const salesTotal = ref(0)
const selectedYear = ref('all')

// All sales for charts & stats (loaded once, up to 500)
const allSales = ref<Sale[]>([])
const chartsLoading = ref(false)

// Sorting state for sales table
const sorting = ref([{ id: 'saleDate', desc: true }])

const form = reactive({
  companyName: '',
  vatNumber: '',
  fiscalCode: '',
  address: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'IT',
  email: '',
  phone: '',
  pec: '',
  sdi: '',
  defaultPaymentMethod: '',
  defaultPaymentTerms: '',
  notes: '',
  status: 'active' as 'active' | 'inactive',
})

// Company initials for avatar
const initials = computed(() => {
  if (!buyer.value) return '?'
  return buyer.value.companyName
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
})

// Country display
const countryInfo = computed(() => {
  if (!buyer.value?.country) return null
  return getCountryDisplay(buyer.value.country)
})

// Province display
const provinceInfo = computed(() => {
  if (!buyer.value?.province) return null
  return getProvinceDisplay(buyer.value.province)
})

// Computed stats from actual sales data
const computedTotalSales = computed(() => allSales.value.length)
const computedTotalRevenue = computed(() =>
  allSales.value.reduce((sum, s) => sum + (s.total || s.subtotal || 0), 0),
)
const computedLastSaleDate = computed(() => {
  if (allSales.value.length === 0) return null
  return allSales.value[0]?.saleDate || null
})

// Available years for filter (derived from all sales)
const availableYears = computed(() => {
  const years = new Set<string>()
  for (const sale of allSales.value) {
    if (sale.saleDate) {
      years.add(sale.saleDate.slice(0, 4))
    }
  }
  return Array.from(years)
    .sort((a, b) => b.localeCompare(a))
    .map(y => ({ value: y, label: y }))
})

// Sales table columns with sorting enabled
const salesColumns = [
  { accessorKey: 'saleDate', header: 'Date', enableSorting: true, size: 120 },
  { accessorKey: 'saleNumber', header: 'Sale #', enableSorting: true, size: 100 },
  { accessorKey: 'status', header: 'Status', enableSorting: true, size: 110 },
  { accessorKey: 'total', header: 'Total', enableSorting: true, size: 120 },
  { accessorKey: 'actions', header: '', enableSorting: false, size: 50 },
]

async function load() {
  loading.value = true
  try {
    const res = await fetchBuyer(buyerId)
    if (res.success && res.data) {
      buyer.value = res.data
      populateForm(res.data)
    }
  } finally {
    loading.value = false
  }
}

function populateForm(b: Buyer) {
  form.companyName = b.companyName
  form.vatNumber = b.vatNumber || ''
  form.fiscalCode = b.fiscalCode || ''
  form.address = b.address
  form.city = b.city
  form.province = b.province || ''
  form.postalCode = b.postalCode
  form.country = b.country
  form.email = b.email || ''
  form.phone = b.phone || ''
  form.pec = b.pec || ''
  form.sdi = b.sdi || ''
  form.defaultPaymentMethod = b.defaultPaymentMethod || ''
  form.defaultPaymentTerms = b.defaultPaymentTerms || ''
  form.notes = b.notes || ''
  form.status = b.status
}

function startEditing() {
  editing.value = true
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}

function cancelEditing() {
  editing.value = false
  populateForm(buyer.value!)
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}

async function save() {
  saving.value = true
  try {
    await updateBuyer(buyerId, {
      companyName: form.companyName,
      vatNumber: form.vatNumber || undefined,
      fiscalCode: form.fiscalCode || undefined,
      address: form.address,
      city: form.city,
      province: form.province || undefined,
      postalCode: form.postalCode,
      country: form.country,
      email: form.email || undefined,
      phone: form.phone || undefined,
      pec: form.pec || undefined,
      sdi: form.sdi || undefined,
      defaultPaymentMethod: form.defaultPaymentMethod || undefined,
      defaultPaymentTerms: form.defaultPaymentTerms || undefined,
      notes: form.notes || undefined,
      status: form.status,
    })
    toast.success('Buyer updated')
    editing.value = false
    await load()
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  showDeleteDialog.value = false
  try {
    await deleteBuyer(buyerId)
    toast.success('Buyer deleted')
    router.push('/buyers')
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function loadSales() {
  salesLoading.value = true
  try {
    const startDate = selectedYear.value && selectedYear.value !== 'all' ? `${selectedYear.value}-01-01` : undefined
    const endDate = selectedYear.value && selectedYear.value !== 'all' ? `${selectedYear.value}-12-31` : undefined
    const res = await fetchSales({
      buyerId,
      page: salesPage.value,
      pageSize: salesPageSize.value,
      startDate,
      endDate,
    })
    if (res) {
      buyerSales.value = res.data || []
      salesTotal.value = res.pagination?.total || 0
    }
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    salesLoading.value = false
  }
}

function onSalesPageChange(p: number) {
  salesPage.value = p
  loadSales()
}

function filterByYear() {
  salesPage.value = 1
  loadSales()
}

function onSelectSale(_e: Event, row: any) {
  router.push(`/sales/${row.original.saleId}`)
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  } catch {
    toast.error('Copy failed')
  }
}

async function loadAllSales() {
  chartsLoading.value = true
  try {
    const allData: Sale[] = []
    let page = 1
    const limit = 100
    while (true) {
      const res = await fetchSales({ buyerId, page, pageSize: limit })
      if (res?.data?.length) {
        allData.push(...res.data)
        if (res.data.length < limit) break
        page++
      } else {
        break
      }
    }
    allSales.value = allData
  } catch {
    // Charts/stats are optional, fail silently
  } finally {
    chartsLoading.value = false
  }
}

function getSaleTotal(sale: Sale): number {
  return sale.total || sale.subtotal || 0
}

onMounted(async () => {
  await load()
  await Promise.all([loadAllSales(), loadSales()])
})
</script>

<template>
  <div>
    <!-- Header -->
    <div v-if="loading" class="mb-6">
      <LoadingSkeleton :lines="2" height="28px" />
    </div>
    <div v-else-if="buyer" class="flex items-start justify-between mb-6">
      <div class="flex items-center gap-4">
        <div class="size-14 rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 flex items-center justify-center text-lg font-bold shrink-0">
          {{ initials }}
        </div>
        <div>
          <h1 class="text-2xl font-bold">{{ buyer.companyName }}</h1>
          <div class="flex items-center gap-2 mt-1">
            <StatusBadge :status="buyer.status" />
            <span v-if="buyer.vatNumber" class="text-sm text-gray-500">VAT {{ buyer.vatNumber }}</span>
            <span v-if="countryInfo && countryInfo.flag" class="inline-flex items-center gap-1.5 text-sm text-gray-500">
              <UIcon :name="countryInfo.flag" class="size-4" mode="svg" />
              {{ countryInfo.label }}
            </span>
            <span v-else-if="countryInfo" class="text-sm text-gray-500">{{ countryInfo.label }}</span>
          </div>
        </div>
      </div>
      <div v-if="canWrite && !editing">
        <UButton variant="outline" size="sm" icon="i-lucide-pen" @click="startEditing">Edit</UButton>
      </div>
    </div>

    <!-- Edit mode -->
    <form v-if="!loading && buyer && editing" @submit.prevent="save" class="space-y-6">
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Company Details</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField label="Company Name" required>
            <UInput v-model="form.companyName" />
          </UFormField>
          <UFormField label="VAT No.">
            <UInput v-model="form.vatNumber" placeholder="IT12345678901" />
          </UFormField>
          <UFormField label="Fiscal Code">
            <UInput v-model="form.fiscalCode" />
          </UFormField>
          <UFormField label="Status">
            <USelect v-model="form.status" :items="[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]" />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <h3 class="text-lg font-semibold mb-4">Address</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="sm:col-span-2 lg:col-span-3">
            <UFormField label="Address" required>
              <UInput v-model="form.address" />
            </UFormField>
          </div>
          <UFormField label="City" required>
            <UInput v-model="form.city" />
          </UFormField>
          <UFormField label="Province">
            <USelect v-model="form.province" :items="ITALIAN_PROVINCES" placeholder="Select..." />
          </UFormField>
          <UFormField label="Postal Code" required>
            <UInput v-model="form.postalCode" />
          </UFormField>
          <UFormField label="Country" required>
            <div class="flex items-center gap-2">
              <UIcon v-if="getCountryDisplay(form.country).flag" :name="getCountryDisplay(form.country).flag" class="size-5 shrink-0" mode="svg" />
              <USelect v-model="form.country" :items="COUNTRIES" class="flex-1" />
            </div>
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <h3 class="text-lg font-semibold mb-4">Contacts</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField label="Email">
            <UInput v-model="form.email" type="email" />
          </UFormField>
          <UFormField label="Phone">
            <UInput v-model="form.phone" />
          </UFormField>
          <UFormField label="PEC">
            <UInput v-model="form.pec" type="email" />
          </UFormField>
          <UFormField label="SDI Code" hint="7 alphanumeric characters">
            <UInput v-model="form.sdi" />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <h3 class="text-lg font-semibold mb-4">Default Payment</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Payment method">
            <USelect v-model="form.defaultPaymentMethod" :items="PAYMENT_METHODS" placeholder="Select..." />
          </UFormField>
          <UFormField label="Payment terms">
            <USelect v-model="form.defaultPaymentTerms" :items="PAYMENT_TERMS" placeholder="Select..." />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <UFormField label="Notes">
          <UTextarea v-model="form.notes" :rows="4" />
        </UFormField>
      </UCard>

      <div class="flex justify-between">
        <UButton type="button" color="error" variant="outline" icon="i-lucide-trash-2" @click="showDeleteDialog = true">Delete</UButton>
        <div class="flex gap-3">
          <UButton type="button" variant="outline" @click="cancelEditing">Cancel</UButton>
          <UButton type="submit" :disabled="saving" :loading="saving">Save</UButton>
        </div>
      </div>
    </form>

    <!-- View mode — all sections visible -->
    <div v-else-if="!loading && buyer" class="space-y-6">
      <!-- Row 1: Company Details + Address -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UCard>
          <h3 class="text-lg font-semibold mb-3">Company Details</h3>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500">VAT No.</dt>
              <dd class="font-medium flex items-center gap-1">
                {{ buyer.vatNumber || '\u2014' }}
                <UButton v-if="buyer.vatNumber" variant="ghost" size="xs" icon="i-lucide-copy" @click="copyToClipboard(buyer!.vatNumber!, 'VAT number')" />
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">Fiscal Code</dt>
              <dd class="font-medium flex items-center gap-1">
                {{ buyer.fiscalCode || '\u2014' }}
                <UButton v-if="buyer.fiscalCode" variant="ghost" size="xs" icon="i-lucide-copy" @click="copyToClipboard(buyer!.fiscalCode!, 'Fiscal code')" />
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">Payment Method</dt>
              <dd class="font-medium">{{ getPaymentMethodLabel(buyer.defaultPaymentMethod || '') }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">Payment Terms</dt>
              <dd class="font-medium">{{ getPaymentTermsLabel(buyer.defaultPaymentTerms || '') }}</dd>
            </div>
          </dl>
        </UCard>

        <UCard>
          <h3 class="text-lg font-semibold mb-3">Address</h3>
          <div class="text-sm space-y-1">
            <p class="font-medium">{{ buyer.address }}</p>
            <p>
              {{ buyer.postalCode }} {{ buyer.city }}
              <span v-if="provinceInfo"> ({{ provinceInfo.label }})</span>
            </p>
            <p v-if="countryInfo" class="flex items-center gap-2 mt-2">
              <UIcon v-if="countryInfo.flag" :name="countryInfo.flag" class="size-6" mode="svg" />
              <span class="font-medium">{{ countryInfo.label }}</span>
              <UBadge v-if="countryInfo.eu" label="EU" color="primary" variant="subtle" size="xs" />
            </p>
          </div>
        </UCard>
      </div>

      <!-- Row 2: Contacts -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Contact Information</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-800">
          <!-- Left column -->
          <div class="sm:pr-6 space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
            <div class="flex items-center justify-between py-3">
              <div class="flex items-center gap-3">
                <div class="size-10 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-400 flex items-center justify-center">
                  <UIcon name="i-lucide-mail" class="size-5" />
                </div>
                <div>
                  <p class="text-xs text-gray-500">Email</p>
                  <p class="text-sm font-medium">{{ buyer.email || '\u2014' }}</p>
                </div>
              </div>
              <a v-if="buyer.email" :href="`mailto:${buyer.email}`">
                <UButton variant="ghost" size="sm" icon="i-lucide-send">Send</UButton>
              </a>
            </div>
            <div class="flex items-center justify-between py-3">
              <div class="flex items-center gap-3">
                <div class="size-10 rounded-lg bg-green-50 text-green-600 dark:bg-green-900 dark:text-green-400 flex items-center justify-center">
                  <UIcon name="i-lucide-phone" class="size-5" />
                </div>
                <div>
                  <p class="text-xs text-gray-500">Phone</p>
                  <p class="text-sm font-medium">{{ buyer.phone || '\u2014' }}</p>
                </div>
              </div>
              <a v-if="buyer.phone" :href="`tel:${buyer.phone}`">
                <UButton variant="ghost" size="sm" icon="i-lucide-phone-call">Call</UButton>
              </a>
            </div>
          </div>
          <!-- Right column -->
          <div class="sm:pl-6 space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
            <div class="flex items-center justify-between py-3">
              <div class="flex items-center gap-3">
                <div class="size-10 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900 dark:text-purple-400 flex items-center justify-center">
                  <UIcon name="i-lucide-shield-check" class="size-5" />
                </div>
                <div>
                  <p class="text-xs text-gray-500">PEC (Certified Email)</p>
                  <p class="text-sm font-medium">{{ buyer.pec || '\u2014' }}</p>
                </div>
              </div>
              <a v-if="buyer.pec" :href="`mailto:${buyer.pec}`">
                <UButton variant="ghost" size="sm" icon="i-lucide-send">Send</UButton>
              </a>
            </div>
            <div class="flex items-center justify-between py-3">
              <div class="flex items-center gap-3">
                <div class="size-10 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900 dark:text-amber-400 flex items-center justify-center">
                  <UIcon name="i-lucide-file-code" class="size-5" />
                </div>
                <div>
                  <p class="text-xs text-gray-500">SDI Code</p>
                  <p class="text-sm font-medium font-mono">{{ buyer.sdi || '\u2014' }}</p>
                </div>
              </div>
              <UButton v-if="buyer.sdi" variant="ghost" size="sm" icon="i-lucide-copy" @click="copyToClipboard(buyer!.sdi!, 'SDI code')">Copy</UButton>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Row 3: Quick Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Sales"
          :value="chartsLoading ? '...' : computedTotalSales"
          icon="i-lucide-receipt"
          color="primary"
        />
        <StatCard
          label="Revenue"
          :value="chartsLoading ? '...' : formatCurrency(computedTotalRevenue)"
          icon="i-lucide-banknote"
          color="success"
        />
        <StatCard
          label="Last Sale"
          :value="chartsLoading ? '...' : formatDate(computedLastSaleDate)"
          icon="i-lucide-calendar"
          color="warning"
        />
      </div>

      <!-- Row 4: Charts -->
      <div v-if="chartsLoading" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UCard>
          <h3 class="text-lg font-semibold mb-3">Monthly Revenue</h3>
          <LoadingSkeleton :lines="6" />
        </UCard>
        <UCard>
          <h3 class="text-lg font-semibold mb-3">Sales by Status</h3>
          <LoadingSkeleton :lines="6" />
        </UCard>
      </div>
      <div v-else-if="allSales.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UCard>
          <h3 class="text-lg font-semibold mb-3">Monthly Revenue (Last 12 months)</h3>
          <BuyerSalesChart :sales="allSales" />
        </UCard>
        <UCard>
          <h3 class="text-lg font-semibold mb-3">Sales by Status</h3>
          <BuyerStatusChart :sales="allSales" />
        </UCard>
      </div>

      <!-- Row 5: Sales History -->
      <UCard>
        <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 class="text-lg font-semibold">Sales History</h3>
          <div class="flex items-center gap-2">
            <USelect
              v-model="selectedYear"
              :items="[{ value: 'all', label: 'All years' }, ...availableYears]"
              size="sm"
              class="w-32"
              @update:model-value="filterByYear"
            />
          </div>
        </div>

        <div v-if="salesLoading" class="py-8">
          <LoadingSkeleton :lines="5" />
        </div>
        <template v-else-if="buyerSales.length > 0">
          <p class="text-sm text-gray-500 mb-3">{{ salesTotal }} sale{{ salesTotal !== 1 ? 's' : '' }}</p>
          <UTable
            :data="buyerSales"
            :columns="salesColumns"
            v-model:sorting="sorting"
            :ui="{ base: 'table-fixed w-full', tr: 'even:bg-(--ui-bg-elevated)/50 hover:bg-(--ui-bg-accented) transition-colors cursor-pointer' }"
            @select="onSelectSale"
          >
            <template #saleNumber-header>
              <div class="text-right w-full">Sale #</div>
            </template>
            <template #saleDate-cell="{ row }">
              {{ formatDate(row.original.saleDate) }}
            </template>
            <template #saleNumber-cell="{ row }">
              <div class="text-right font-medium">#{{ row.original.saleNumber }}</div>
            </template>
            <template #status-cell="{ row }">
              <SaleStatusBadge :status="row.original.status" />
            </template>
            <template #total-header>
              <div class="text-right w-full">Total</div>
            </template>
            <template #total-cell="{ row }">
              <div class="text-right font-medium">{{ formatCurrency(getSaleTotal(row.original)) }}</div>
            </template>
            <template #actions-cell="{ row }">
              <UButton variant="ghost" size="xs" icon="i-lucide-arrow-right" :to="`/sales/${row.original.saleId}`" />
            </template>
          </UTable>
          <div v-if="salesTotal > salesPageSize" class="flex justify-center mt-4">
            <UPagination
              :page="salesPage"
              :total="salesTotal"
              :items-per-page="salesPageSize"
              @update:page="onSalesPageChange"
            />
          </div>
        </template>
        <EmptyState
          v-else
          title="No sales found"
          description="No sales recorded for this buyer yet."
          icon="i-lucide-receipt"
        />
      </UCard>

      <!-- Row 6: Notes -->
      <UCard v-if="buyer.notes">
        <h3 class="text-lg font-semibold mb-3">Notes</h3>
        <p class="text-sm text-gray-600 whitespace-pre-wrap">{{ buyer.notes }}</p>
      </UCard>

      <!-- Metadata -->
      <div class="text-xs text-gray-400 space-y-1">
        <p>Created on {{ formatDateTime(buyer.createdAt) }} by {{ buyer.createdBy }}</p>
        <p>Updated on {{ formatDateTime(buyer.updatedAt) }} by {{ buyer.updatedBy }}</p>
      </div>
    </div>

    <ConfirmDialog
      :open="showDeleteDialog"
      title="Delete buyer"
      message="Are you sure you want to delete this buyer?"
      confirm-label="Delete"
      variant="danger"
      @confirm="handleDelete"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>
