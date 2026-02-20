<script setup lang="ts">
import type { Producer, Sale } from '~/types'
import { COUNTRIES, ITALIAN_PROVINCES, INVOICE_LANGUAGES, QUANTITY_OPTIONS } from '~/utils/constants'
import { getCountryDisplay, getLanguageLabel, getQuantityLabel } from '~/utils/display-helpers'

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
  code: '',
  companyName: '',
  vatNumber: '',
  fiscalCode: '',
  sdi: '',
  pec: '',
  preferredLanguage: 'en',
  subName: '',
  address: '',
  poBox: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'IT',
  mainContact: '',
  email: '',
  phone: '',
  fax: '',
  website: '',
  defaultOperator: '',
  revenuePercentage: null as number | null,
  bankDetails: '',
  qualityAssurance: '',
  productionArea: '',
  markets: '',
  materials: '',
  products: '',
  standardProducts: '',
  diameterRange: '',
  maxLength: '',
  quantity: '',
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
  form.code = p.code || ''
  form.companyName = p.companyName
  form.vatNumber = p.vatNumber || ''
  form.fiscalCode = p.fiscalCode || ''
  form.sdi = p.sdi || ''
  form.pec = p.pec || ''
  form.preferredLanguage = p.preferredLanguage || 'en'
  form.subName = p.subName || ''
  form.address = p.address
  form.poBox = p.poBox || ''
  form.city = p.city
  form.province = p.province || ''
  form.postalCode = p.postalCode
  form.country = p.country
  form.mainContact = p.mainContact || ''
  form.email = p.email || ''
  form.phone = p.phone || ''
  form.fax = p.fax || ''
  form.website = p.website || ''
  form.defaultOperator = p.defaultOperator || ''
  form.revenuePercentage = p.revenuePercentage ?? null
  form.bankDetails = p.bankDetails || ''
  form.qualityAssurance = p.qualityAssurance || ''
  form.productionArea = p.productionArea || ''
  form.markets = p.markets || ''
  form.materials = p.materials || ''
  form.products = p.products || ''
  form.standardProducts = p.standardProducts || ''
  form.diameterRange = p.diameterRange || ''
  form.maxLength = p.maxLength || ''
  form.quantity = p.quantity || ''
  form.notes = p.notes || ''
  form.status = p.status
}

async function save() {
  saving.value = true
  try {
    await updateProducer(producerId, {
      code: form.code || undefined,
      companyName: form.companyName,
      vatNumber: form.vatNumber || undefined,
      fiscalCode: form.fiscalCode || undefined,
      sdi: form.sdi || undefined,
      pec: form.pec || undefined,
      preferredLanguage: form.preferredLanguage || undefined,
      subName: form.subName || undefined,
      address: form.address,
      poBox: form.poBox || undefined,
      city: form.city,
      province: form.province || undefined,
      postalCode: form.postalCode,
      country: form.country,
      mainContact: form.mainContact || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      fax: form.fax || undefined,
      website: form.website || undefined,
      defaultOperator: form.defaultOperator || undefined,
      revenuePercentage: form.revenuePercentage ?? undefined,
      bankDetails: form.bankDetails || undefined,
      qualityAssurance: form.qualityAssurance || undefined,
      productionArea: form.productionArea || undefined,
      markets: form.markets || undefined,
      materials: form.materials || undefined,
      products: form.products || undefined,
      standardProducts: form.standardProducts || undefined,
      diameterRange: form.diameterRange || undefined,
      maxLength: form.maxLength || undefined,
      quantity: form.quantity || undefined,
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
    <div v-else-if="producer" class="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div class="flex items-center gap-3">
        <div>
          <h1 class="text-2xl font-bold">{{ producer.companyName }}</h1>
          <p v-if="producer.code" class="text-sm text-gray-500 font-mono">{{ producer.code }}</p>
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
              <UFormField label="Code" hint="Short reference handle">
                <UInput v-model="form.code" placeholder="e.g. quali" />
              </UFormField>
              <UFormField label="Company Name" required><UInput v-model="form.companyName" /></UFormField>
              <UFormField label="VAT No."><UInput v-model="form.vatNumber" placeholder="IT12345678901" /></UFormField>
              <UFormField label="Fiscal Code"><UInput v-model="form.fiscalCode" /></UFormField>
              <UFormField label="SDI Code" hint="7 alphanumeric characters"><UInput v-model="form.sdi" /></UFormField>
              <UFormField label="Preferred Language">
                <USelect v-model="form.preferredLanguage" :items="INVOICE_LANGUAGES" />
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
                <UFormField label="Sub-name / c/o"><UInput v-model="form.subName" placeholder="c/o or sub-name" /></UFormField>
              </div>
              <div class="sm:col-span-2 lg:col-span-3">
                <UFormField label="Address" required><UInput v-model="form.address" /></UFormField>
              </div>
              <UFormField label="P.O. Box"><UInput v-model="form.poBox" /></UFormField>
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
              <UFormField label="Main Contact"><UInput v-model="form.mainContact" placeholder="Contact person name" /></UFormField>
              <UFormField label="Email"><UInput v-model="form.email" type="email" /></UFormField>
              <UFormField label="Phone"><UInput v-model="form.phone" /></UFormField>
              <UFormField label="Fax"><UInput v-model="form.fax" /></UFormField>
              <UFormField label="Website"><UInput v-model="form.website" placeholder="https://..." /></UFormField>
              <UFormField label="PEC"><UInput v-model="form.pec" type="email" /></UFormField>
              <UFormField label="Default Operator"><UInput v-model="form.defaultOperator" /></UFormField>
            </div>
          </UCard>

          <UCard>
            <h3 class="text-lg font-semibold mb-4">Business Terms</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Revenue %" hint="Commission percentage">
                <UInput v-model.number="form.revenuePercentage" type="number" min="0" max="100" step="0.01" placeholder="e.g. 10" />
              </UFormField>
              <div class="sm:col-span-2">
                <UFormField label="Bank Details">
                  <UTextarea v-model="form.bankDetails" :rows="2" placeholder="IBAN, bank name, SWIFT/BIC..." />
                </UFormField>
              </div>
            </div>
          </UCard>

          <UCard>
            <h3 class="text-lg font-semibold mb-4">Production Info</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Quality Assurance" hint="ISO certifications, etc.">
                <UTextarea v-model="form.qualityAssurance" :rows="3" />
              </UFormField>
              <UFormField label="Production Area" hint="Manufacturing capabilities">
                <UTextarea v-model="form.productionArea" :rows="3" />
              </UFormField>
              <UFormField label="Markets">
                <UTextarea v-model="form.markets" :rows="3" />
              </UFormField>
              <UFormField label="Materials">
                <UTextarea v-model="form.materials" :rows="3" />
              </UFormField>
              <div class="sm:col-span-2">
                <UFormField label="Products"><UTextarea v-model="form.products" :rows="3" /></UFormField>
              </div>
              <div class="sm:col-span-2">
                <UFormField label="Standard Products"><UTextarea v-model="form.standardProducts" :rows="3" /></UFormField>
              </div>
              <UFormField label="Diameter Range"><UInput v-model="form.diameterRange" /></UFormField>
              <UFormField label="Max Length"><UInput v-model="form.maxLength" /></UFormField>
              <UFormField label="Quantity">
                <USelect v-model="form.quantity" :items="QUANTITY_OPTIONS" placeholder="Select..." />
              </UFormField>
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
        <div class="space-y-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UCard>
            <h3 class="text-lg font-semibold mb-3">Company Details</h3>
            <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt class="text-gray-500 text-xs">VAT No.</dt>
                <dd class="font-medium">{{ producer.vatNumber || '\u2014' }}</dd>
              </div>
              <div>
                <dt class="text-gray-500 text-xs">Fiscal Code</dt>
                <dd class="font-medium">{{ producer.fiscalCode || '\u2014' }}</dd>
              </div>
              <div v-if="producer.sdi">
                <dt class="text-gray-500 text-xs">SDI Code</dt>
                <dd class="font-medium font-mono">{{ producer.sdi }}</dd>
              </div>
              <div v-if="producer.preferredLanguage">
                <dt class="text-gray-500 text-xs">Preferred Language</dt>
                <dd class="font-medium">{{ getLanguageLabel(producer.preferredLanguage) }}</dd>
              </div>
            </dl>
          </UCard>
          <UCard>
            <h3 class="text-lg font-semibold mb-3">Address</h3>
            <div class="text-sm space-y-1">
              <p v-if="producer.subName" class="text-gray-500">{{ producer.subName }}</p>
              <p class="font-medium">{{ producer.address }}</p>
              <p v-if="producer.poBox" class="text-gray-500">P.O. Box {{ producer.poBox }}</p>
              <p>
                {{ producer.postalCode }} {{ producer.city }}
                <span v-if="producer.province"> ({{ getCountryDisplay(producer.country).code === 'IT' ? (ITALIAN_PROVINCES.find(p => p.value === producer!.province)?.label || producer.province) : producer.province }})</span>
              </p>
              <p class="flex items-center gap-1.5 mt-2">
                <UIcon v-if="getCountryDisplay(producer.country).flag" :name="getCountryDisplay(producer.country).flag" class="size-5 shrink-0" mode="svg" />
                <span class="font-medium">{{ getCountryDisplay(producer.country).label }}</span>
                <UBadge v-if="getCountryDisplay(producer.country).eu" label="EU" color="primary" variant="subtle" size="xs" />
              </p>
            </div>
          </UCard>
        </div>

        <!-- Contacts -->
        <UCard>
          <h3 class="text-lg font-semibold mb-4">Contact Information</h3>
          <div v-if="producer.mainContact" class="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div class="size-10 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 flex items-center justify-center">
              <UIcon name="i-lucide-user" class="size-5" />
            </div>
            <div>
              <p class="text-xs text-gray-500">Main Contact</p>
              <p class="text-sm font-medium">{{ producer.mainContact }}</p>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-800">
            <div class="sm:pr-6 space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
              <div class="flex items-center justify-between py-3">
                <div class="flex items-center gap-3">
                  <div class="size-10 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-400 flex items-center justify-center">
                    <UIcon name="i-lucide-mail" class="size-5" />
                  </div>
                  <div>
                    <p class="text-xs text-gray-500">Email</p>
                    <p class="text-sm font-medium">{{ producer.email || '\u2014' }}</p>
                  </div>
                </div>
                <a v-if="producer.email" :href="`mailto:${producer.email}`">
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
                    <p class="text-sm font-medium">{{ producer.phone || '\u2014' }}</p>
                  </div>
                </div>
                <a v-if="producer.phone" :href="`tel:${producer.phone}`">
                  <UButton variant="ghost" size="sm" icon="i-lucide-phone-call">Call</UButton>
                </a>
              </div>
              <div v-if="producer.fax" class="flex items-center justify-between py-3">
                <div class="flex items-center gap-3">
                  <div class="size-10 rounded-lg bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 flex items-center justify-center">
                    <UIcon name="i-lucide-printer" class="size-5" />
                  </div>
                  <div>
                    <p class="text-xs text-gray-500">Fax</p>
                    <p class="text-sm font-medium">{{ producer.fax }}</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="sm:pl-6 space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
              <div v-if="producer.pec" class="flex items-center justify-between py-3">
                <div class="flex items-center gap-3">
                  <div class="size-10 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900 dark:text-purple-400 flex items-center justify-center">
                    <UIcon name="i-lucide-shield-check" class="size-5" />
                  </div>
                  <div>
                    <p class="text-xs text-gray-500">PEC (Certified Email)</p>
                    <p class="text-sm font-medium">{{ producer.pec }}</p>
                  </div>
                </div>
                <a :href="`mailto:${producer.pec}`">
                  <UButton variant="ghost" size="sm" icon="i-lucide-send">Send</UButton>
                </a>
              </div>
              <div v-if="producer.website" class="flex items-center justify-between py-3">
                <div class="flex items-center gap-3">
                  <div class="size-10 rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-400 flex items-center justify-center">
                    <UIcon name="i-lucide-globe" class="size-5" />
                  </div>
                  <div>
                    <p class="text-xs text-gray-500">Website</p>
                    <p class="text-sm font-medium">{{ producer.website }}</p>
                  </div>
                </div>
                <a :href="producer.website.startsWith('http') ? producer.website : `https://${producer.website}`" target="_blank" rel="noopener">
                  <UButton variant="ghost" size="sm" icon="i-lucide-external-link">Open</UButton>
                </a>
              </div>
              <div v-if="producer.defaultOperator" class="flex items-center justify-between py-3">
                <div class="flex items-center gap-3">
                  <div class="size-10 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900 dark:text-amber-400 flex items-center justify-center">
                    <UIcon name="i-lucide-user-cog" class="size-5" />
                  </div>
                  <div>
                    <p class="text-xs text-gray-500">Default Operator</p>
                    <p class="text-sm font-medium">{{ producer.defaultOperator }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Business Terms -->
        <UCard v-if="producer.revenuePercentage != null || producer.bankDetails">
          <h3 class="text-lg font-semibold mb-3">Business Terms</h3>
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div v-if="producer.revenuePercentage != null">
              <dt class="text-gray-500 text-xs">Revenue %</dt>
              <dd class="font-medium">{{ producer.revenuePercentage }}%</dd>
            </div>
            <div v-if="producer.bankDetails" class="col-span-2 sm:col-span-3">
              <dt class="text-gray-500 text-xs">Bank Details</dt>
              <dd class="font-medium whitespace-pre-wrap">{{ producer.bankDetails }}</dd>
            </div>
          </dl>
        </UCard>

        <!-- Production Info -->
        <UCard v-if="producer.qualityAssurance || producer.productionArea || producer.markets || producer.materials || producer.products || producer.standardProducts || producer.diameterRange || producer.maxLength || producer.quantity">
          <h3 class="text-lg font-semibold mb-3">Production Info</h3>
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div v-if="producer.qualityAssurance" class="col-span-2 sm:col-span-3">
              <dt class="text-gray-500 text-xs">Quality Assurance</dt>
              <dd class="font-medium whitespace-pre-wrap">{{ producer.qualityAssurance }}</dd>
            </div>
            <div v-if="producer.productionArea">
              <dt class="text-gray-500 text-xs">Production Area</dt>
              <dd class="font-medium whitespace-pre-wrap">{{ producer.productionArea }}</dd>
            </div>
            <div v-if="producer.markets">
              <dt class="text-gray-500 text-xs">Markets</dt>
              <dd class="font-medium whitespace-pre-wrap">{{ producer.markets }}</dd>
            </div>
            <div v-if="producer.materials">
              <dt class="text-gray-500 text-xs">Materials</dt>
              <dd class="font-medium whitespace-pre-wrap">{{ producer.materials }}</dd>
            </div>
            <div v-if="producer.products" class="col-span-2 sm:col-span-3">
              <dt class="text-gray-500 text-xs">Products</dt>
              <dd class="font-medium whitespace-pre-wrap">{{ producer.products }}</dd>
            </div>
            <div v-if="producer.standardProducts" class="col-span-2 sm:col-span-3">
              <dt class="text-gray-500 text-xs">Standard Products</dt>
              <dd class="font-medium whitespace-pre-wrap">{{ producer.standardProducts }}</dd>
            </div>
            <div v-if="producer.diameterRange">
              <dt class="text-gray-500 text-xs">Diameter Range</dt>
              <dd class="font-medium">{{ producer.diameterRange }}</dd>
            </div>
            <div v-if="producer.maxLength">
              <dt class="text-gray-500 text-xs">Max Length</dt>
              <dd class="font-medium">{{ producer.maxLength }}</dd>
            </div>
            <div v-if="producer.quantity">
              <dt class="text-gray-500 text-xs">Quantity</dt>
              <dd class="font-medium">{{ getQuantityLabel(producer.quantity) }}</dd>
            </div>
          </dl>
        </UCard>

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
        <UCard v-if="producer.notes">
          <h3 class="text-lg font-semibold mb-2">Notes</h3>
          <p class="text-sm text-gray-600">{{ producer.notes }}</p>
        </UCard>

        <!-- Metadata -->
        <div class="text-xs text-gray-400 space-y-1">
          <p>Created on {{ formatDateTime(producer.createdAt) }} by {{ producer.createdBy }}</p>
          <p>Updated on {{ formatDateTime(producer.updatedAt) }} by {{ producer.updatedBy }}</p>
        </div>
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
