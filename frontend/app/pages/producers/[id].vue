<script setup lang="ts">
import type { Producer } from '~/types'
import { COUNTRIES, ITALIAN_PROVINCES } from '~/utils/constants'

const route = useRoute()
const router = useRouter()
const producerId = route.params.id as string

const { fetchProducer, updateProducer, deleteProducer } = useProducers()
const { formatDate } = useFormatters()
const { canWrite } = useAuth()
const toast = useAppToast()

const producer = ref<Producer | null>(null)
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

onMounted(() => load())
</script>

<template>
  <div>
    <BreadcrumbNav :items="[
      { label: 'Dashboard', to: '/' },
      { label: 'Producers', to: '/producers' },
      { label: producer?.companyName || '...' },
    ]" />
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
      <div v-if="canWrite" class="flex gap-2">
        <UButton v-if="!editing" variant="outline" size="sm" icon="i-lucide-pen" @click="editing = true">Edit</UButton>
        <UButton color="error" size="sm" icon="i-lucide-trash-2" @click="showDeleteDialog = true">Delete</UButton>
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
              <UFormField label="Province"><USelect v-model="form.province" :items="provinceOptions" placeholder="Select..." /></UFormField>
              <UFormField label="Postal Code" required><UInput v-model="form.postalCode" /></UFormField>
              <UFormField label="Country" required><USelect v-model="form.country" :items="COUNTRIES" /></UFormField>
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

          <div class="flex justify-end gap-3">
            <UButton type="button" variant="outline" @click="editing = false; populateForm(producer!)">Cancel</UButton>
            <UButton type="submit" :disabled="saving" :loading="saving">Save</UButton>
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
            <p class="text-sm">{{ producer.postalCode }} {{ producer.city }} {{ producer.province ? `(${producer.province})` : '' }}</p>
            <p class="text-sm text-gray-500">{{ COUNTRIES.find(c => c.value === producer!.country)?.label || producer.country }}</p>
          </UCard>
          <UCard>
            <h3 class="text-lg font-semibold mb-3">Contacts</h3>
            <dl class="space-y-2 text-sm">
              <div><dt class="text-gray-500 inline">Email:</dt> <dd class="inline font-medium">{{ producer.email || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">Phone:</dt> <dd class="inline font-medium">{{ producer.phone || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">Website:</dt> <dd class="inline font-medium">{{ producer.website || '—' }}</dd></div>
            </dl>
          </UCard>
          <UCard>
            <h3 class="text-lg font-semibold mb-3">Statistics</h3>
            <dl class="space-y-2 text-sm">
              <div><dt class="text-gray-500 inline">Total sales:</dt> <dd class="inline font-medium">{{ producer.totalSales ?? 0 }}</dd></div>
              <div><dt class="text-gray-500 inline">Last sale:</dt> <dd class="inline font-medium">{{ formatDate(producer.lastSaleDate) }}</dd></div>
            </dl>
          </UCard>
        </div>
        <UCard v-if="producer.notes" class="mt-6">
          <h3 class="text-lg font-semibold mb-2">Notes</h3>
          <p class="text-sm text-gray-600">{{ producer.notes }}</p>
        </UCard>
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
