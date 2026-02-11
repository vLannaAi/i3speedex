<script setup lang="ts">
import type { Sale, SaleLine, Attachment } from '~/types'
import { PAYMENT_METHODS, PAYMENT_TERMS } from '~/utils/constants'

const route = useRoute()
const router = useRouter()
const saleId = route.params.id as string

const { fetchSale, updateSale, confirmSale, deleteSale, fetchSaleLines } = useSales()
const { fetchAttachments } = useAttachments()
const { formatDate, formatCurrency, formatDateTime } = useFormatters()
const { canWrite } = useAuth()
const toast = useToast()

const sale = ref<Sale | null>(null)
const lines = ref<SaleLine[]>([])
const attachments = ref<Attachment[]>([])
const loading = ref(true)
const activeTab = ref('details')
const editing = ref(false)
const saving = ref(false)
const showDeleteDialog = ref(false)
const showConfirmDialog = ref(false)

const tabs = [
  { key: 'details', label: 'Dettagli', icon: 'fa-regular fa-circle-info' },
  { key: 'lines', label: 'Righe', icon: 'fa-solid fa-list-ol' },
  { key: 'invoice', label: 'Fattura', icon: 'fa-regular fa-file-lines' },
  { key: 'attachments', label: 'Allegati', icon: 'fa-solid fa-paperclip' },
]

// Edit form
const form = reactive({
  saleDate: '',
  paymentMethod: '',
  paymentTerms: '',
  deliveryMethod: '',
  deliveryDate: '',
  notes: '',
  internalNotes: '',
  referenceNumber: '',
})

async function load() {
  loading.value = true
  try {
    const [saleRes, linesRes, attRes] = await Promise.all([
      fetchSale(saleId),
      fetchSaleLines(saleId),
      fetchAttachments(saleId),
    ])
    if (saleRes.success && saleRes.data) {
      sale.value = saleRes.data
      populateForm(saleRes.data)
    }
    if (linesRes.success && linesRes.data) {
      lines.value = Array.isArray(linesRes.data) ? linesRes.data : []
    }
    if (attRes.success && attRes.data) {
      attachments.value = Array.isArray(attRes.data) ? attRes.data : []
    }
  } finally {
    loading.value = false
  }
}

function populateForm(s: Sale) {
  form.saleDate = s.saleDate?.split('T')[0] || ''
  form.paymentMethod = s.paymentMethod || ''
  form.paymentTerms = s.paymentTerms || ''
  form.deliveryMethod = s.deliveryMethod || ''
  form.deliveryDate = s.deliveryDate?.split('T')[0] || ''
  form.notes = s.notes || ''
  form.internalNotes = s.internalNotes || ''
  form.referenceNumber = s.referenceNumber || ''
}

async function saveDetails() {
  saving.value = true
  try {
    await updateSale(saleId, {
      saleDate: form.saleDate || undefined,
      paymentMethod: form.paymentMethod || undefined,
      paymentTerms: form.paymentTerms || undefined,
      deliveryMethod: form.deliveryMethod || undefined,
      deliveryDate: form.deliveryDate || undefined,
      notes: form.notes || undefined,
      internalNotes: form.internalNotes || undefined,
      referenceNumber: form.referenceNumber || undefined,
    })
    toast.success('Vendita aggiornata')
    editing.value = false
    await load()
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    saving.value = false
  }
}

async function handleConfirm() {
  showConfirmDialog.value = false
  try {
    await confirmSale(saleId)
    toast.success('Vendita confermata')
    await load()
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function handleDelete() {
  showDeleteDialog.value = false
  try {
    await deleteSale(saleId)
    toast.success('Vendita eliminata')
    router.push('/sales')
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function refreshLines() {
  const [saleRes, linesRes] = await Promise.all([
    fetchSale(saleId),
    fetchSaleLines(saleId),
  ])
  if (saleRes.success && saleRes.data) sale.value = saleRes.data
  if (linesRes.success && linesRes.data) lines.value = Array.isArray(linesRes.data) ? linesRes.data : []
}

async function refreshAttachments() {
  const res = await fetchAttachments(saleId)
  if (res.success && res.data) attachments.value = Array.isArray(res.data) ? res.data : []
}

const isEditable = computed(() => canWrite.value && sale.value?.status === 'draft')

onMounted(() => load())
</script>

<template>
  <div>
    <BreadcrumbNav :items="[
      { label: 'Dashboard', to: '/' },
      { label: 'Vendite', to: '/sales' },
      { label: sale ? `#${sale.saleNumber}` : '...' },
    ]" />

    <!-- Header -->
    <div v-if="loading" class="mb-6">
      <LoadingSkeleton :lines="2" height="28px" />
    </div>
    <div v-else-if="sale" class="flex items-start justify-between mb-6">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="page-title">Vendita #{{ sale.saleNumber }}</h1>
          <SaleStatusBadge :status="sale.status" />
        </div>
        <p class="page-subtitle">
          {{ sale.buyerName }} — {{ formatDate(sale.saleDate) }}
        </p>
      </div>
      <SaleActions
        :sale="sale"
        @confirm="showConfirmDialog = true"
        @delete="showDeleteDialog = true"
      />
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="flex gap-0 -mb-px">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.key
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          @click="activeTab = tab.key"
        >
          <div class="inline-flex items-center gap-1.5">
            <i :class="tab.icon" />
            {{ tab.label }}
            <span v-if="tab.key === 'lines' && lines.length" class="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{{ lines.length }}</span>
            <span v-if="tab.key === 'attachments' && attachments.length" class="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{{ attachments.length }}</span>
          </div>
        </button>
      </nav>
    </div>

    <!-- Tab content -->
    <div v-if="loading">
      <div class="card card-body"><LoadingSkeleton :lines="6" /></div>
    </div>
    <template v-else-if="sale">
      <!-- Details tab -->
      <div v-if="activeTab === 'details'" class="space-y-6">
        <div class="card card-body">
          <div class="flex items-center justify-between mb-4">
            <h3 class="section-title">Informazioni Vendita</h3>
            <button v-if="isEditable && !editing" class="btn-ghost btn-sm" @click="editing = true">
              <i class="fa-solid fa-pen" /> Modifica
            </button>
          </div>

          <template v-if="editing">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField label="Data vendita" required>
                <FormDatePicker v-model="form.saleDate" />
              </FormField>
              <FormField label="Metodo pagamento">
                <FormSelect v-model="form.paymentMethod" :options="PAYMENT_METHODS" placeholder="Seleziona..." />
              </FormField>
              <FormField label="Termini pagamento">
                <FormSelect v-model="form.paymentTerms" :options="PAYMENT_TERMS" placeholder="Seleziona..." />
              </FormField>
              <FormField label="Metodo consegna">
                <FormInput v-model="form.deliveryMethod" />
              </FormField>
              <FormField label="Data consegna">
                <FormDatePicker v-model="form.deliveryDate" />
              </FormField>
              <FormField label="Riferimento">
                <FormInput v-model="form.referenceNumber" />
              </FormField>
              <div class="sm:col-span-2 lg:col-span-3">
                <FormField label="Note">
                  <FormTextarea v-model="form.notes" :max-length="1000" />
                </FormField>
              </div>
              <div class="sm:col-span-2 lg:col-span-3">
                <FormField label="Note interne">
                  <FormTextarea v-model="form.internalNotes" :max-length="1000" />
                </FormField>
              </div>
            </div>
            <div class="flex gap-2 mt-4">
              <button class="btn-primary btn-sm" :disabled="saving" @click="saveDetails">
                <i v-if="saving" class="fa-solid fa-spinner fa-spin" /> Salva
              </button>
              <button class="btn-ghost btn-sm" @click="editing = false; populateForm(sale!)">Annulla</button>
            </div>
          </template>

          <template v-else>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div><span class="text-gray-500">Data:</span> <span class="font-medium">{{ formatDate(sale.saleDate) }}</span></div>
              <div><span class="text-gray-500">Pagamento:</span> <span class="font-medium">{{ sale.paymentMethod || '—' }}</span></div>
              <div><span class="text-gray-500">Termini:</span> <span class="font-medium">{{ sale.paymentTerms || '—' }}</span></div>
              <div><span class="text-gray-500">Consegna:</span> <span class="font-medium">{{ sale.deliveryMethod || '—' }}</span></div>
              <div><span class="text-gray-500">Data consegna:</span> <span class="font-medium">{{ formatDate(sale.deliveryDate) }}</span></div>
              <div><span class="text-gray-500">Riferimento:</span> <span class="font-medium">{{ sale.referenceNumber || '—' }}</span></div>
              <div v-if="sale.notes" class="sm:col-span-2 lg:col-span-3">
                <span class="text-gray-500">Note:</span>
                <p class="font-medium mt-1">{{ sale.notes }}</p>
              </div>
              <div v-if="sale.internalNotes" class="sm:col-span-2 lg:col-span-3">
                <span class="text-gray-500">Note interne:</span>
                <p class="font-medium mt-1">{{ sale.internalNotes }}</p>
              </div>
            </div>
          </template>
        </div>

        <!-- Buyer & Producer info -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card card-body">
            <h3 class="section-title mb-3">Acquirente</h3>
            <div class="space-y-1 text-sm">
              <p class="font-medium text-gray-900">{{ sale.buyerName }}</p>
              <p v-if="sale.buyerVatNumber" class="text-gray-500">P.IVA: {{ sale.buyerVatNumber }}</p>
              <p v-if="sale.buyerAddress" class="text-gray-500">{{ sale.buyerAddress }}, {{ sale.buyerCity }} {{ sale.buyerProvince ? `(${sale.buyerProvince})` : '' }} {{ sale.buyerPostalCode }}</p>
            </div>
          </div>
          <div class="card card-body">
            <h3 class="section-title mb-3">Produttore</h3>
            <div class="space-y-1 text-sm">
              <p class="font-medium text-gray-900">{{ sale.producerName }}</p>
              <p v-if="sale.producerVatNumber" class="text-gray-500">P.IVA: {{ sale.producerVatNumber }}</p>
              <p v-if="sale.producerAddress" class="text-gray-500">{{ sale.producerAddress }}, {{ sale.producerCity }} {{ sale.producerProvince ? `(${sale.producerProvince})` : '' }} {{ sale.producerPostalCode }}</p>
            </div>
          </div>
        </div>

        <!-- Totals -->
        <div class="max-w-sm ml-auto">
          <SaleTotals :lines="lines" />
        </div>

        <!-- Metadata -->
        <div class="text-xs text-gray-400 space-y-1">
          <p>Creata il {{ formatDateTime(sale.createdAt) }} da {{ sale.createdBy }}</p>
          <p>Aggiornata il {{ formatDateTime(sale.updatedAt) }} da {{ sale.updatedBy }}</p>
        </div>
      </div>

      <!-- Lines tab -->
      <div v-if="activeTab === 'lines'" class="card card-body">
        <SaleLineEditor
          :sale-id="saleId"
          :lines="lines"
          :readonly="!isEditable"
          @refresh="refreshLines"
        />
        <div class="mt-4 max-w-sm ml-auto">
          <SaleTotals :lines="lines" />
        </div>
      </div>

      <!-- Invoice tab -->
      <div v-if="activeTab === 'invoice'" class="card card-body">
        <h3 class="section-title mb-4">Generazione Fattura</h3>
        <InvoiceActions :sale="sale" />
      </div>

      <!-- Attachments tab -->
      <div v-if="activeTab === 'attachments'" class="card card-body">
        <h3 class="section-title mb-4">Allegati</h3>
        <AttachmentUpload v-if="canWrite" :sale-id="saleId" @uploaded="refreshAttachments" />
        <div class="mt-4">
          <AttachmentList :sale-id="saleId" :attachments="attachments" :readonly="!canWrite" @refresh="refreshAttachments" />
        </div>
      </div>
    </template>

    <!-- Dialogs -->
    <ConfirmDialog
      :open="showConfirmDialog"
      title="Conferma vendita"
      message="Sei sicuro di voler confermare questa vendita? Lo stato cambierà a 'Confermata'."
      confirm-label="Conferma"
      @confirm="handleConfirm"
      @cancel="showConfirmDialog = false"
    />
    <ConfirmDialog
      :open="showDeleteDialog"
      title="Elimina vendita"
      message="Sei sicuro di voler eliminare questa vendita? L'operazione non è reversibile."
      confirm-label="Elimina"
      variant="danger"
      @confirm="handleDelete"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>
