<script setup lang="ts">
import type { Buyer } from '~/types'
import { PAYMENT_METHODS, PAYMENT_TERMS, COUNTRIES, ITALIAN_PROVINCES } from '~/utils/constants'

const route = useRoute()
const router = useRouter()
const buyerId = route.params.id as string

const { fetchBuyer, updateBuyer, deleteBuyer } = useBuyers()
const { formatDate, formatCurrency } = useFormatters()
const { canWrite } = useAuth()
const toast = useToast()

const buyer = ref<Buyer | null>(null)
const loading = ref(true)
const editing = ref(false)
const saving = ref(false)
const showDeleteDialog = ref(false)

const provinceOptions = ITALIAN_PROVINCES.map(p => ({ value: p, label: p }))

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

onMounted(() => load())
</script>

<template>
  <div>
    <BreadcrumbNav :items="[
      { label: 'Dashboard', to: '/' },
      { label: 'Buyers', to: '/buyers' },
      { label: buyer?.companyName || '...' },
    ]" />
    <div v-if="loading" class="mb-6"><LoadingSkeleton :lines="2" height="28px" /></div>
    <div v-else-if="buyer" class="flex items-start justify-between mb-6">
      <div class="flex items-center gap-3">
        <div>
          <h1 class="page-title">{{ buyer.companyName }}</h1>
          <div class="flex items-center gap-2 mt-1">
            <StatusBadge :status="buyer.status" />
            <span v-if="buyer.vatNumber" class="text-sm text-gray-500">VAT {{ buyer.vatNumber }}</span>
          </div>
        </div>
      </div>
      <div v-if="canWrite" class="flex gap-2">
        <button v-if="!editing" class="btn-secondary btn-sm" @click="editing = true">
          <i class="fa-solid fa-pen" /> Edit
        </button>
        <button class="btn-danger btn-sm" @click="showDeleteDialog = true">
          <i class="fa-regular fa-trash-can" /> Delete
        </button>
      </div>
    </div>

    <template v-if="!loading && buyer">
      <template v-if="editing">
        <form @submit.prevent="save" class="space-y-6">
          <div class="card card-body">
            <h3 class="section-title mb-4">Company Details</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField label="Company Name" required>
                <FormInput v-model="form.companyName" />
              </FormField>
              <FormField label="VAT No.">
                <FormInput v-model="form.vatNumber" placeholder="IT12345678901" />
              </FormField>
              <FormField label="Fiscal Code">
                <FormInput v-model="form.fiscalCode" />
              </FormField>
              <FormField label="Status">
                <FormSelect v-model="form.status" :options="[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]" />
              </FormField>
            </div>
          </div>

          <div class="card card-body">
            <h3 class="section-title mb-4">Address</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div class="sm:col-span-2 lg:col-span-3">
                <FormField label="Address" required>
                  <FormInput v-model="form.address" />
                </FormField>
              </div>
              <FormField label="City" required>
                <FormInput v-model="form.city" />
              </FormField>
              <FormField label="Province">
                <FormSelect v-model="form.province" :options="provinceOptions" placeholder="Select..." />
              </FormField>
              <FormField label="Postal Code" required>
                <FormInput v-model="form.postalCode" />
              </FormField>
              <FormField label="Country" required>
                <FormSelect v-model="form.country" :options="COUNTRIES" />
              </FormField>
            </div>
          </div>

          <div class="card card-body">
            <h3 class="section-title mb-4">Contacts</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField label="Email">
                <FormInput v-model="form.email" type="email" />
              </FormField>
              <FormField label="Phone">
                <FormInput v-model="form.phone" />
              </FormField>
              <FormField label="PEC">
                <FormInput v-model="form.pec" type="email" />
              </FormField>
              <FormField label="SDI Code" hint="7 alphanumeric characters">
                <FormInput v-model="form.sdi" />
              </FormField>
            </div>
          </div>

          <div class="card card-body">
            <h3 class="section-title mb-4">Default Payment</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Payment method">
                <FormSelect v-model="form.defaultPaymentMethod" :options="PAYMENT_METHODS" placeholder="Select..." />
              </FormField>
              <FormField label="Payment terms">
                <FormSelect v-model="form.defaultPaymentTerms" :options="PAYMENT_TERMS" placeholder="Select..." />
              </FormField>
            </div>
          </div>

          <div class="card card-body">
            <FormField label="Notes">
              <FormTextarea v-model="form.notes" :max-length="1000" />
            </FormField>
          </div>

          <div class="flex justify-end gap-3">
            <button type="button" class="btn-secondary" @click="editing = false; populateForm(buyer!)">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="saving">
              <i v-if="saving" class="fa-solid fa-spinner fa-spin" /> Save
            </button>
          </div>
        </form>
      </template>

      <template v-else>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card card-body">
            <h3 class="section-title mb-3">Company Details</h3>
            <dl class="space-y-2 text-sm">
              <div><dt class="text-gray-500 inline">VAT No.:</dt> <dd class="inline font-medium">{{ buyer.vatNumber || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">Fiscal Code:</dt> <dd class="inline font-medium">{{ buyer.fiscalCode || '—' }}</dd></div>
            </dl>
          </div>
          <div class="card card-body">
            <h3 class="section-title mb-3">Address</h3>
            <p class="text-sm">{{ buyer.address }}</p>
            <p class="text-sm">{{ buyer.postalCode }} {{ buyer.city }} {{ buyer.province ? `(${buyer.province})` : '' }}</p>
            <p class="text-sm text-gray-500">{{ COUNTRIES.find(c => c.value === buyer!.country)?.label || buyer.country }}</p>
          </div>
          <div class="card card-body">
            <h3 class="section-title mb-3">Contacts</h3>
            <dl class="space-y-2 text-sm">
              <div><dt class="text-gray-500 inline">Email:</dt> <dd class="inline font-medium">{{ buyer.email || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">Phone:</dt> <dd class="inline font-medium">{{ buyer.phone || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">PEC:</dt> <dd class="inline font-medium">{{ buyer.pec || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">SDI:</dt> <dd class="inline font-medium">{{ buyer.sdi || '—' }}</dd></div>
            </dl>
          </div>
          <div class="card card-body">
            <h3 class="section-title mb-3">Statistics</h3>
            <dl class="space-y-2 text-sm">
              <div><dt class="text-gray-500 inline">Total sales:</dt> <dd class="inline font-medium">{{ buyer.totalSales ?? 0 }}</dd></div>
              <div><dt class="text-gray-500 inline">Revenue:</dt> <dd class="inline font-medium">{{ formatCurrency(buyer.totalRevenue ?? 0) }}</dd></div>
              <div><dt class="text-gray-500 inline">Last sale:</dt> <dd class="inline font-medium">{{ formatDate(buyer.lastSaleDate) }}</dd></div>
            </dl>
          </div>
        </div>
        <div v-if="buyer.notes" class="card card-body mt-6">
          <h3 class="section-title mb-2">Notes</h3>
          <p class="text-sm text-gray-600">{{ buyer.notes }}</p>
        </div>
      </template>
    </template>

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
