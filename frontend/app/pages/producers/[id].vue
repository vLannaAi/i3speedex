<script setup lang="ts">
import type { Producer } from '~/types'
import { COUNTRIES, ITALIAN_PROVINCES } from '~/utils/constants'

const route = useRoute()
const router = useRouter()
const producerId = route.params.id as string

const { fetchProducer, updateProducer, deleteProducer } = useProducers()
const { formatDate } = useFormatters()
const { canWrite } = useAuth()
const toast = useToast()

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
    toast.success('Produttore aggiornato')
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
    toast.success('Produttore eliminato')
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
      { label: 'Produttori', to: '/producers' },
      { label: producer?.companyName || '...' },
    ]" />
    <div v-if="loading" class="mb-6"><LoadingSkeleton :lines="2" height="28px" /></div>
    <div v-else-if="producer" class="flex items-start justify-between mb-6">
      <div class="flex items-center gap-3">
        <div>
          <h1 class="page-title">{{ producer.companyName }}</h1>
          <div class="flex items-center gap-2 mt-1">
            <StatusBadge :status="producer.status" />
            <span v-if="producer.vatNumber" class="text-sm text-gray-500">P.IVA {{ producer.vatNumber }}</span>
          </div>
        </div>
      </div>
      <div v-if="canWrite" class="flex gap-2">
        <button v-if="!editing" class="btn-secondary btn-sm" @click="editing = true">
          <div class="i-mdi-pencil-outline" /> Modifica
        </button>
        <button class="btn-danger btn-sm" @click="showDeleteDialog = true">
          <div class="i-mdi-delete-outline" /> Elimina
        </button>
      </div>
    </div>

    <template v-if="!loading && producer">
      <template v-if="editing">
        <form @submit.prevent="save" class="space-y-6">
          <div class="card card-body">
            <h3 class="section-title mb-4">Dati Azienda</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField label="Ragione Sociale" required><FormInput v-model="form.companyName" /></FormField>
              <FormField label="P.IVA"><FormInput v-model="form.vatNumber" placeholder="IT12345678901" /></FormField>
              <FormField label="Codice Fiscale"><FormInput v-model="form.fiscalCode" /></FormField>
              <FormField label="Stato">
                <FormSelect v-model="form.status" :options="[{ value: 'active', label: 'Attivo' }, { value: 'inactive', label: 'Inattivo' }]" />
              </FormField>
            </div>
          </div>

          <div class="card card-body">
            <h3 class="section-title mb-4">Indirizzo</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div class="sm:col-span-2 lg:col-span-3"><FormField label="Indirizzo" required><FormInput v-model="form.address" /></FormField></div>
              <FormField label="Città" required><FormInput v-model="form.city" /></FormField>
              <FormField label="Provincia"><FormSelect v-model="form.province" :options="provinceOptions" placeholder="Seleziona..." /></FormField>
              <FormField label="CAP" required><FormInput v-model="form.postalCode" /></FormField>
              <FormField label="Paese" required><FormSelect v-model="form.country" :options="COUNTRIES" /></FormField>
            </div>
          </div>

          <div class="card card-body">
            <h3 class="section-title mb-4">Contatti</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField label="Email"><FormInput v-model="form.email" type="email" /></FormField>
              <FormField label="Telefono"><FormInput v-model="form.phone" /></FormField>
              <FormField label="Sito Web"><FormInput v-model="form.website" placeholder="https://..." /></FormField>
            </div>
          </div>

          <div class="card card-body">
            <FormField label="Note"><FormTextarea v-model="form.notes" :max-length="1000" /></FormField>
          </div>

          <div class="flex justify-end gap-3">
            <button type="button" class="btn-secondary" @click="editing = false; populateForm(producer!)">Annulla</button>
            <button type="submit" class="btn-primary" :disabled="saving">
              <div v-if="saving" class="i-mdi-loading animate-spin" /> Salva
            </button>
          </div>
        </form>
      </template>

      <template v-else>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card card-body">
            <h3 class="section-title mb-3">Dati Azienda</h3>
            <dl class="space-y-2 text-sm">
              <div><dt class="text-gray-500 inline">P.IVA:</dt> <dd class="inline font-medium">{{ producer.vatNumber || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">Codice Fiscale:</dt> <dd class="inline font-medium">{{ producer.fiscalCode || '—' }}</dd></div>
            </dl>
          </div>
          <div class="card card-body">
            <h3 class="section-title mb-3">Indirizzo</h3>
            <p class="text-sm">{{ producer.address }}</p>
            <p class="text-sm">{{ producer.postalCode }} {{ producer.city }} {{ producer.province ? `(${producer.province})` : '' }}</p>
            <p class="text-sm text-gray-500">{{ COUNTRIES.find(c => c.value === producer!.country)?.label || producer.country }}</p>
          </div>
          <div class="card card-body">
            <h3 class="section-title mb-3">Contatti</h3>
            <dl class="space-y-2 text-sm">
              <div><dt class="text-gray-500 inline">Email:</dt> <dd class="inline font-medium">{{ producer.email || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">Telefono:</dt> <dd class="inline font-medium">{{ producer.phone || '—' }}</dd></div>
              <div><dt class="text-gray-500 inline">Sito Web:</dt> <dd class="inline font-medium">{{ producer.website || '—' }}</dd></div>
            </dl>
          </div>
          <div class="card card-body">
            <h3 class="section-title mb-3">Statistiche</h3>
            <dl class="space-y-2 text-sm">
              <div><dt class="text-gray-500 inline">Vendite totali:</dt> <dd class="inline font-medium">{{ producer.totalSales ?? 0 }}</dd></div>
              <div><dt class="text-gray-500 inline">Ultima vendita:</dt> <dd class="inline font-medium">{{ formatDate(producer.lastSaleDate) }}</dd></div>
            </dl>
          </div>
        </div>
        <div v-if="producer.notes" class="card card-body mt-6">
          <h3 class="section-title mb-2">Note</h3>
          <p class="text-sm text-gray-600">{{ producer.notes }}</p>
        </div>
      </template>
    </template>

    <ConfirmDialog
      :open="showDeleteDialog"
      title="Elimina produttore"
      message="Sei sicuro di voler eliminare questo produttore?"
      confirm-label="Elimina"
      variant="danger"
      @confirm="handleDelete"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>
