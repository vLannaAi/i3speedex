<script setup lang="ts">
import type { Producer, Sale } from '~/types'
import { COUNTRIES, ITALIAN_PROVINCES } from '~/utils/constants'
import { getCountryDisplay } from '~/utils/display-helpers'

const route = useRoute()
const router = useRouter()
const producerId = route.params.id as string

const { fetchProducer, updateProducer, deleteProducer } = useCachedProducers()
const { fetchSales } = useSales()
const { formatDate, formatCurrency, formatDateTime } = useFormatters()
const { canWrite } = useAuth()
const toast = useAppToast()

const producer = ref<Producer | null>(null)
const loading = ref(true)
const editing = ref(false)
const saving = ref(false)
const showDeleteDialog = ref(false)

// Sales history state (paginated table)
const producerSales = ref<Sale[]>([])
const salesLoading = ref(false)
const salesPage = ref(1)
const salesPageSize = ref(10)
const salesTotal = ref(0)
const selectedYear = ref('all')

// All sales for stats (loaded once)
const allSales = ref<Sale[]>([])
const chartsLoading = ref(false)

// Sorting state for sales table
const sorting = ref([{ id: 'saleDate', desc: true }])

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

// Sales table columns
const salesColumns = [
  { accessorKey: 'saleDate', header: 'Date', enableSorting: true, size: 120 },
  { accessorKey: 'saleNumber', header: 'Sale #', enableSorting: true, size: 100 },
  { accessorKey: 'buyerName', header: 'Buyer', enableSorting: true, size: 200 },
  { accessorKey: 'status', header: 'Status', enableSorting: true, size: 110 },
  { accessorKey: 'total', header: 'Total', enableSorting: true, size: 120 },
  { accessorKey: 'actions', header: '', enableSorting: false, size: 50 },
]

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
  website: '',
  notes: '',
  status: 'active' as 'active' | 'inactive',
})

async function load() {
  loading.value = true
  try {
    const res = await fetchProducer(producerId)
    if (res.success && res.data) {
      producer.value = res.data
      populateForm(res.data)
    }
  } finally {
    loading.value = false
  }
}

function populateForm(p: Producer) {
  form.companyName = p.companyName
  form.vatNumber = p.vatNumber || ''
  form.fiscalCode = p.fiscalCode || ''
  form.address = p.address
  form.city = p.city
  form.province = p.province || ''
  form.postalCode = p.postalCode
  form.country = p.country
  form.email = p.email || ''
  form.phone = p.phone || ''
  form.website = p.website || ''
  form.notes = p.notes || ''
  form.status = p.status
}

async function save() {
  saving.value = true
  try {
    await updateProducer(producerId, {
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
      website: form.website || undefined,
      notes: form.notes || undefined,
      status: form.status,
    })
    toast.success('Producer updated')
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
    await deleteProducer(producerId)
    toast.success('Producer deleted')
    router.push('/producers')
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
      producerId,
      page: salesPage.value,
      pageSize: salesPageSize.value,
      startDate,
      endDate,
    })
    if (res) {
      producerSales.value = res.data || []
      salesTotal.value = res.pagination?.total || 0
    }
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    salesLoading.value = false
  }
}

async function loadAllSales() {
  chartsLoading.value = true
  try {
    const allData: Sale[] = []
    let page = 1
    const limit = 100
    while (true) {
      const res = await fetchSales({ producerId, page, pageSize: limit })
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
    // Stats are optional, fail silently
  } finally {
    chartsLoading.value = false
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
    <div v-if="loading" class="mb-6"><LoadingSkeleton :lines="2" height="28px" /></div>
    <div v-else-if="producer" class="flex items-start justify-between mb-6">
      <div class="flex items-center gap-3">
        <div>
          <h1 class="text-2xl font-bold">{{ producer.companyName }}</h1>
          <div class="flex items-center gap-2 mt-1">
            <StatusBadge :status="producer.status" />
            <span v-if="producer.vatNumber" class="text-sm text-gray-500">VAT {{ producer.vatNumber }}</span>
          </div>
        </div>
      </div>
      <div v-if="canWrite && !editing">
        <UButton variant="outline" size="sm" icon="i-lucide-pen" @click="editing = true">Edit</UButton>
      </div>
    </div>

    <template v-if="!loading && producer">
      <template v-if="editing">
        <form @submit.prevent="save" class="space-y-6">
          <UCard>
            <h3 class="text-lg font-semibold mb-4">Company Details</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <UFormField label="Company Name" required><UInput v-model="form.companyName" /></UFormField>
              <UFormField label="VAT No."><UInput v-model="form.vatNumber" placeholder="IT12345678901" /></UFormField>
              <UFormField label="Fiscal Code"><UInput v-model="form.fiscalCode" /></UFormField>
              <UFormField label="Status">
                <USelect v-model="form.status" :items="[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]" />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <h3 class="text-lg font-semibold mb-4">Address</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div class="sm:col-span-2 lg:col-span-3"><UFormField label="Address" required><UInput v-model="form.address" /></UFormField></div>
              <UFormField label="City" required><UInput v-model="form.city" /></UFormField>
              <UFormField label="Province"><USelect v-model="form.province" :items="ITALIAN_PROVINCES" placeholder="Select..." /></UFormField>
              <UFormField label="Postal Code" required><UInput v-model="form.postalCode" /></UFormField>
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
              <UFormField label="Email"><UInput v-model="form.email" type="email" /></UFormField>
              <UFormField label="Phone"><UInput v-model="form.phone" /></UFormField>
              <UFormField label="Website"><UInput v-model="form.website" placeholder="https://..." /></UFormField>
            </div>
          </UCard>

          <UCard>
            <UFormField label="Notes"><UTextarea v-model="form.notes" :rows="4" /></UFormField>
          </UCard>

          <div class="flex justify-between">
            <UButton type="button" color="error" variant="outline" icon="i-lucide-trash-2" @click="showDeleteDialog = true">Delete</UButton>
            <div class="flex gap-3">
              <UButton type="button" variant="outline" @click="editing = false; populateForm(producer!)">Cancel</UButton>
              <UButton type="submit" :disabled="saving" :loading="saving">Save</UButton>
            </div>
          </div>
        </form>
      </template>

      <template v-else>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UCard>
            <h3 class="text-lg font-semibold mb-3">Company Details</h3>
            <dl class="space-y-2 text-sm">
              <div><dt class="text-gray-500 inline">VAT No.:</dt> <dd class="inline font-medium">{{ producer.vatNumber || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">Fiscal Code:</dt> <dd class="inline font-medium">{{ producer.fiscalCode || '—' }}</dd></div>
            </dl>
          </UCard>
          <UCard>
            <h3 class="text-lg font-semibold mb-3">Address</h3>
            <p class="text-sm">{{ producer.address }}</p>
            <p class="text-sm">
              {{ producer.postalCode }} {{ producer.city }}
              <span v-if="producer.province"> ({{ getCountryDisplay(producer.country).code === 'IT' ? (ITALIAN_PROVINCES.find(p => p.value === producer!.province)?.label || producer.province) : producer.province }})</span>
            </p>
            <p class="text-sm flex items-center gap-1.5">
              <UIcon v-if="getCountryDisplay(producer.country).flag" :name="getCountryDisplay(producer.country).flag" class="size-5 shrink-0" mode="svg" />
              <span>{{ getCountryDisplay(producer.country).label }}</span>
            </p>
          </UCard>
          <UCard>
            <h3 class="text-lg font-semibold mb-3">Contacts</h3>
            <dl class="space-y-2 text-sm">
              <div><dt class="text-gray-500 inline">Email:</dt> <dd class="inline font-medium">{{ producer.email || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">Phone:</dt> <dd class="inline font-medium">{{ producer.phone || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">Website:</dt> <dd class="inline font-medium">{{ producer.website || '—' }}</dd></div>
            </dl>
          </UCard>
        </div>

        <!-- Quick Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
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

        <!-- Sales History -->
        <UCard class="mt-6">
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
          <template v-else-if="producerSales.length > 0">
            <p class="text-sm text-gray-500 mb-3">{{ salesTotal }} sale{{ salesTotal !== 1 ? 's' : '' }}</p>
            <UTable
              :data="producerSales"
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
              <template #buyerName-cell="{ row }">
                <span class="truncate block">{{ row.original.buyerName }}</span>
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
            description="No sales recorded for this producer yet."
            icon="i-lucide-receipt"
          />
        </UCard>

        <!-- Notes -->
        <UCard v-if="producer.notes" class="mt-6">
          <h3 class="text-lg font-semibold mb-2">Notes</h3>
          <p class="text-sm text-gray-600">{{ producer.notes }}</p>
        </UCard>

        <!-- Metadata -->
        <div class="text-xs text-gray-400 space-y-1 mt-6">
          <p>Created on {{ formatDateTime(producer.createdAt) }} by {{ producer.createdBy }}</p>
          <p>Updated on {{ formatDateTime(producer.updatedAt) }} by {{ producer.updatedBy }}</p>
        </div>
      </template>
    </template>

    <ConfirmDialog
      :open="showDeleteDialog"
      title="Delete producer"
      message="Are you sure you want to delete this producer?"
      confirm-label="Delete"
      variant="danger"
      @confirm="handleDelete"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>
