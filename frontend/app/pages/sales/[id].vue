<script setup lang="ts">
import type { Sale, SaleLine, Attachment } from '~/types'
import { PAYMENT_METHODS, PAYMENT_TERMS, VAT_EXEMPT_OPTIONS } from '~/utils/constants'
import { getPaymentMethodLabel, getPaymentTermsLabel } from '~/utils/display-helpers'

const route = useRoute()
const router = useRouter()
const saleId = route.params.id as string

const { fetchSale, updateSale, confirmSale, deleteSale, fetchSaleLines } = useCachedSales()
const { fetchAttachments } = useAttachments()
const { formatDate, formatCurrency, formatDateTime } = useFormatters()
const { canWrite } = useAuth()
const toast = useAppToast()

const sale = ref<Sale | null>(null)
const lines = ref<SaleLine[]>([])
const attachments = ref<Attachment[]>([])
const loading = ref(true)
const editing = ref(false)
const saving = ref(false)
const showDeleteDialog = ref(false)
const showConfirmDialog = ref(false)

// Edit form
const form = reactive({
  saleDate: '',
  registrationDate: '',
  numberT: null as number | null,
  year: null as number | null,
  ivaPercentage: null as number | null,
  paymentMethod: '',
  paymentTerms: '',
  deliveryMethod: '',
  deliveryDate: '',
  referenceNumber: '',
  poNumber: '',
  poDate: '',
  printedNote: '',
  package: '',
  deliveryNote: '',
  dnNumber: '',
  dnDate: '',
  dnNumber2: '',
  dnDate2: '',
  dnNumber3: '',
  dnDate3: '',
  paCupNumber: '',
  paCigNumber: '',
  paymentDate: '',
  paymentNote: '',
  bank: '',
  coBankDescription: '',
  coBankIban: '',
  vatOff: '',
  attachInvoice: true,
  pdfFontBase: null as number | null,
  notes: '',
  internalNotes: '',
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
  form.registrationDate = s.registrationDate?.split('T')[0] || ''
  form.numberT = s.numberT ?? null
  form.year = s.year ?? null
  form.ivaPercentage = s.ivaPercentage ?? null
  form.paymentMethod = s.paymentMethod || ''
  form.paymentTerms = s.paymentTerms || ''
  form.deliveryMethod = s.deliveryMethod || ''
  form.deliveryDate = s.deliveryDate?.split('T')[0] || ''
  form.referenceNumber = s.referenceNumber || ''
  form.poNumber = s.poNumber || ''
  form.poDate = s.poDate?.split('T')[0] || ''
  form.printedNote = s.printedNote || ''
  form.package = s.package || ''
  form.deliveryNote = s.deliveryNote || ''
  form.dnNumber = s.dnNumber || ''
  form.dnDate = s.dnDate?.split('T')[0] || ''
  form.dnNumber2 = s.dnNumber2 || ''
  form.dnDate2 = s.dnDate2?.split('T')[0] || ''
  form.dnNumber3 = s.dnNumber3 || ''
  form.dnDate3 = s.dnDate3?.split('T')[0] || ''
  form.paCupNumber = s.paCupNumber || ''
  form.paCigNumber = s.paCigNumber || ''
  form.paymentDate = s.paymentDate?.split('T')[0] || ''
  form.paymentNote = s.paymentNote || ''
  form.bank = s.bank || ''
  form.coBankDescription = s.coBankDescription || ''
  form.coBankIban = s.coBankIban || ''
  form.vatOff = s.vatOff || ''
  form.attachInvoice = s.attachInvoice ?? true
  form.pdfFontBase = s.pdfFontBase ?? null
  form.notes = s.notes || ''
  form.internalNotes = s.internalNotes || ''
}

async function saveDetails() {
  saving.value = true
  try {
    await updateSale(saleId, {
      saleDate: form.saleDate || undefined,
      registrationDate: form.registrationDate || undefined,
      numberT: form.numberT ?? undefined,
      year: form.year ?? undefined,
      ivaPercentage: form.ivaPercentage ?? undefined,
      paymentMethod: form.paymentMethod || undefined,
      paymentTerms: form.paymentTerms || undefined,
      deliveryMethod: form.deliveryMethod || undefined,
      deliveryDate: form.deliveryDate || undefined,
      referenceNumber: form.referenceNumber || undefined,
      poNumber: form.poNumber || undefined,
      poDate: form.poDate || undefined,
      printedNote: form.printedNote || undefined,
      package: form.package || undefined,
      deliveryNote: form.deliveryNote || undefined,
      dnNumber: form.dnNumber || undefined,
      dnDate: form.dnDate || undefined,
      dnNumber2: form.dnNumber2 || undefined,
      dnDate2: form.dnDate2 || undefined,
      dnNumber3: form.dnNumber3 || undefined,
      dnDate3: form.dnDate3 || undefined,
      paCupNumber: form.paCupNumber || undefined,
      paCigNumber: form.paCigNumber || undefined,
      paymentDate: form.paymentDate || undefined,
      paymentNote: form.paymentNote || undefined,
      bank: form.bank || undefined,
      coBankDescription: form.coBankDescription || undefined,
      coBankIban: form.coBankIban || undefined,
      vatOff: form.vatOff || undefined,
      attachInvoice: form.attachInvoice,
      pdfFontBase: form.pdfFontBase ?? undefined,
      notes: form.notes || undefined,
      internalNotes: form.internalNotes || undefined,
    })
    toast.success('Sale updated')
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
    toast.success('Sale confirmed')
    await load()
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function handleDelete() {
  showDeleteDialog.value = false
  try {
    await deleteSale(saleId)
    toast.success('Sale deleted')
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

const isEditable = computed(() => canWrite.value && sale.value?.status === 'proforma')

onMounted(() => load())
</script>

<template>
  <div>
    <!-- Header -->
    <div v-if="loading" class="mb-6">
      <LoadingSkeleton :lines="2" height="28px" />
    </div>
    <div v-else-if="sale" class="flex items-start justify-between mb-6">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold">Sale #{{ sale.saleNumber }}</h1>
          <span v-if="sale.year && sale.numberT" class="text-lg text-muted font-mono">{{ sale.year }}/T{{ sale.numberT }}</span>
          <SaleStatusBadge :status="sale.status" />
        </div>
        <p class="text-sm text-muted mt-1">
          {{ sale.buyerName }} — {{ formatDate(sale.saleDate) }}
        </p>
      </div>
      <SaleActions
        :sale="sale"
        @confirm="showConfirmDialog = true"
      />
    </div>

    <!-- Content -->
    <div v-if="loading">
      <UCard><LoadingSkeleton :lines="6" /></UCard>
    </div>
    <div v-else-if="sale" class="space-y-6">
      <!-- Sale Information -->
      <UCard>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Sale Information</h3>
          <UButton v-if="isEditable && !editing" variant="ghost" size="sm" icon="i-lucide-pen" @click="editing = true">
            Edit
          </UButton>
        </div>

        <template v-if="editing">
          <!-- Sales Info section -->
          <h4 class="font-medium text-sm text-muted mb-3">Sales Info</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <UFormField label="Sale date" required>
              <UInput v-model="form.saleDate" type="date" />
            </UFormField>
            <UFormField label="Number T" hint="Sequential period number">
              <UInput v-model.number="form.numberT" type="number" min="1" />
            </UFormField>
            <UFormField label="Year">
              <UInput v-model.number="form.year" type="number" min="2000" max="2099" />
            </UFormField>
            <UFormField label="Registration Date">
              <UInput v-model="form.registrationDate" type="date" />
            </UFormField>
            <UFormField label="IVA %" hint="Default VAT percentage">
              <UInput v-model.number="form.ivaPercentage" type="number" min="0" max="100" step="0.01" />
            </UFormField>
          </div>

          <!-- Invoice Info section -->
          <h4 class="font-medium text-sm text-muted mb-3">Invoice Info</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <UFormField label="Buyer Reference">
              <UInput v-model="form.referenceNumber" />
            </UFormField>
            <UFormField label="PO Number">
              <UInput v-model="form.poNumber" />
            </UFormField>
            <UFormField label="PO Date">
              <UInput v-model="form.poDate" type="date" />
            </UFormField>
            <div class="sm:col-span-2 lg:col-span-3">
              <UFormField label="Printed Note" hint="Printed on invoice">
                <UTextarea v-model="form.printedNote" :rows="3" />
              </UFormField>
            </div>
            <div class="sm:col-span-2 lg:col-span-3">
              <UFormField label="Package">
                <UTextarea v-model="form.package" :rows="2" placeholder="e.g. Imballo compreso" />
              </UFormField>
            </div>
          </div>

          <!-- Delivery section -->
          <h4 class="font-medium text-sm text-muted mb-3">Delivery</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <UFormField label="Delivery method">
              <UInput v-model="form.deliveryMethod" />
            </UFormField>
            <UFormField label="Delivery date">
              <UInput v-model="form.deliveryDate" type="date" />
            </UFormField>
            <div class="sm:col-span-2 lg:col-span-3">
              <UFormField label="Delivery Note" hint="Delivery terms / instructions">
                <UTextarea v-model="form.deliveryNote" :rows="2" placeholder="e.g. Resa F.co partenza ns sede Milano" />
              </UFormField>
            </div>
            <UFormField label="DN Number">
              <UInput v-model="form.dnNumber" />
            </UFormField>
            <UFormField label="DN Date">
              <UInput v-model="form.dnDate" type="date" />
            </UFormField>
            <div />
            <UFormField label="DN Number 2">
              <UInput v-model="form.dnNumber2" />
            </UFormField>
            <UFormField label="DN Date 2">
              <UInput v-model="form.dnDate2" type="date" />
            </UFormField>
            <div />
            <UFormField label="DN Number 3">
              <UInput v-model="form.dnNumber3" />
            </UFormField>
            <UFormField label="DN Date 3">
              <UInput v-model="form.dnDate3" type="date" />
            </UFormField>
          </div>

          <!-- Public Administration section -->
          <h4 class="font-medium text-sm text-muted mb-3">Public Administration</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <UFormField label="PA CUP Number">
              <UInput v-model="form.paCupNumber" />
            </UFormField>
            <UFormField label="PA CIG Number">
              <UInput v-model="form.paCigNumber" />
            </UFormField>
          </div>

          <!-- Payment section -->
          <h4 class="font-medium text-sm text-muted mb-3">Payment</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <UFormField label="Payment method">
              <USelect v-model="form.paymentMethod" :items="PAYMENT_METHODS" placeholder="Select..." />
            </UFormField>
            <UFormField label="Payment terms">
              <USelect v-model="form.paymentTerms" :items="PAYMENT_TERMS" placeholder="Select..." />
            </UFormField>
            <UFormField label="Payment date">
              <UInput v-model="form.paymentDate" type="date" />
            </UFormField>
            <div class="sm:col-span-2 lg:col-span-3">
              <UFormField label="Payment note">
                <UTextarea v-model="form.paymentNote" :rows="2" />
              </UFormField>
            </div>
            <UFormField label="Bank" hint="Bank for bank transfer">
              <UInput v-model="form.bank" />
            </UFormField>
          </div>

          <!-- Cash Order section -->
          <h4 class="font-medium text-sm text-muted mb-3">Cash Order (C/O)</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <UFormField label="C/O Bank Description">
              <UInput v-model="form.coBankDescription" />
            </UFormField>
            <UFormField label="C/O Bank IBAN">
              <UInput v-model="form.coBankIban" />
            </UFormField>
          </div>

          <!-- VAT & Invoice Options section -->
          <h4 class="font-medium text-sm text-muted mb-3">VAT & Invoice Options</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <UFormField label="VAT Off">
              <USelect v-model="form.vatOff" :items="VAT_EXEMPT_OPTIONS" placeholder="Select..." />
            </UFormField>
            <UFormField label="PDF Font Base">
              <UInput v-model.number="form.pdfFontBase" type="number" min="1" max="20" />
            </UFormField>
            <UFormField label="Attach Invoice to SDI">
              <UCheckbox v-model="form.attachInvoice" label="Attach invoice" />
            </UFormField>
          </div>

          <!-- Notes section -->
          <h4 class="font-medium text-sm text-muted mb-3">Notes</h4>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <UFormField label="Notes">
              <UTextarea v-model="form.notes" :rows="3" />
            </UFormField>
            <UFormField label="Internal notes">
              <UTextarea v-model="form.internalNotes" :rows="3" />
            </UFormField>
          </div>

          <div class="flex justify-between mt-4">
            <UButton color="error" variant="outline" size="sm" icon="i-lucide-trash-2" @click="showDeleteDialog = true">Delete</UButton>
            <div class="flex gap-2">
              <UButton variant="ghost" size="sm" @click="editing = false; populateForm(sale!)">Cancel</UButton>
              <UButton size="sm" :loading="saving" @click="saveDetails">Save</UButton>
            </div>
          </div>
        </template>

        <template v-else>
          <!-- Sales Info -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-6">
            <div><span class="text-gray-500">Date:</span> <span class="font-medium">{{ formatDate(sale.saleDate) }}</span></div>
            <div><span class="text-gray-500">Number T:</span> <span class="font-medium">{{ sale.numberT || '—' }}</span></div>
            <div><span class="text-gray-500">Year:</span> <span class="font-medium">{{ sale.year || '—' }}</span></div>
            <div><span class="text-gray-500">Registration Date:</span> <span class="font-medium">{{ formatDate(sale.registrationDate) }}</span></div>
            <div><span class="text-gray-500">IVA %:</span> <span class="font-medium">{{ sale.ivaPercentage != null ? `${sale.ivaPercentage}%` : '—' }}</span></div>
            <div><span class="text-gray-500">Currency:</span> <span class="font-medium">{{ sale.currency || '—' }}</span></div>
          </div>

          <!-- Invoice Info -->
          <h4 class="font-medium text-sm text-muted mb-3">Invoice Info</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-6">
            <div><span class="text-gray-500">Buyer Reference:</span> <span class="font-medium">{{ sale.referenceNumber || '—' }}</span></div>
            <div><span class="text-gray-500">PO Number:</span> <span class="font-medium">{{ sale.poNumber || '—' }}</span></div>
            <div><span class="text-gray-500">PO Date:</span> <span class="font-medium">{{ formatDate(sale.poDate) }}</span></div>
            <div v-if="sale.printedNote" class="sm:col-span-2 lg:col-span-3">
              <span class="text-gray-500">Printed Note:</span>
              <p class="font-medium mt-1 whitespace-pre-line">{{ sale.printedNote }}</p>
            </div>
            <div v-if="sale.package" class="sm:col-span-2 lg:col-span-3">
              <span class="text-gray-500">Package:</span>
              <p class="font-medium mt-1 whitespace-pre-line">{{ sale.package }}</p>
            </div>
          </div>

          <!-- Payment -->
          <h4 class="font-medium text-sm text-muted mb-3">Payment</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-6">
            <div><span class="text-gray-500">Payment:</span> <span class="font-medium">{{ getPaymentMethodLabel(sale.paymentMethod || '') }}</span></div>
            <div><span class="text-gray-500">Terms:</span> <span class="font-medium">{{ getPaymentTermsLabel(sale.paymentTerms || '') }}</span></div>
            <div><span class="text-gray-500">Payment Date:</span> <span class="font-medium">{{ formatDate(sale.paymentDate) }}</span></div>
            <div v-if="sale.paymentNote" class="sm:col-span-2 lg:col-span-3">
              <span class="text-gray-500">Payment Note:</span>
              <p class="font-medium mt-1 whitespace-pre-line">{{ sale.paymentNote }}</p>
            </div>
            <div v-if="sale.bank"><span class="text-gray-500">Bank:</span> <span class="font-medium">{{ sale.bank }}</span></div>
          </div>

          <!-- Delivery -->
          <h4 class="font-medium text-sm text-muted mb-3">Delivery</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-6">
            <div><span class="text-gray-500">Delivery:</span> <span class="font-medium">{{ sale.deliveryMethod || '—' }}</span></div>
            <div><span class="text-gray-500">Delivery date:</span> <span class="font-medium">{{ formatDate(sale.deliveryDate) }}</span></div>
            <div v-if="sale.deliveryNote" class="sm:col-span-2 lg:col-span-3">
              <span class="text-gray-500">Delivery Note:</span>
              <p class="font-medium mt-1 whitespace-pre-line">{{ sale.deliveryNote }}</p>
            </div>
            <template v-if="sale.dnNumber || sale.dnDate">
              <div><span class="text-gray-500">DN Number:</span> <span class="font-medium">{{ sale.dnNumber || '—' }}</span></div>
              <div><span class="text-gray-500">DN Date:</span> <span class="font-medium">{{ formatDate(sale.dnDate) }}</span></div>
              <div />
            </template>
            <template v-if="sale.dnNumber2 || sale.dnDate2">
              <div><span class="text-gray-500">DN Number 2:</span> <span class="font-medium">{{ sale.dnNumber2 || '—' }}</span></div>
              <div><span class="text-gray-500">DN Date 2:</span> <span class="font-medium">{{ formatDate(sale.dnDate2) }}</span></div>
              <div />
            </template>
            <template v-if="sale.dnNumber3 || sale.dnDate3">
              <div><span class="text-gray-500">DN Number 3:</span> <span class="font-medium">{{ sale.dnNumber3 || '—' }}</span></div>
              <div><span class="text-gray-500">DN Date 3:</span> <span class="font-medium">{{ formatDate(sale.dnDate3) }}</span></div>
              <div />
            </template>
          </div>

          <!-- PA & Other -->
          <template v-if="sale.paCupNumber || sale.paCigNumber || sale.coBankDescription || sale.coBankIban || sale.vatOff">
            <h4 class="font-medium text-sm text-muted mb-3">Other Details</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-6">
              <div v-if="sale.paCupNumber"><span class="text-gray-500">PA CUP:</span> <span class="font-medium">{{ sale.paCupNumber }}</span></div>
              <div v-if="sale.paCigNumber"><span class="text-gray-500">PA CIG:</span> <span class="font-medium">{{ sale.paCigNumber }}</span></div>
              <div v-if="sale.coBankDescription"><span class="text-gray-500">C/O Bank:</span> <span class="font-medium">{{ sale.coBankDescription }}</span></div>
              <div v-if="sale.coBankIban"><span class="text-gray-500">C/O IBAN:</span> <span class="font-medium font-mono">{{ sale.coBankIban }}</span></div>
              <div v-if="sale.vatOff"><span class="text-gray-500">VAT Off:</span> <span class="font-medium">{{ sale.vatOff }}</span></div>
            </div>
          </template>

          <!-- Notes -->
          <template v-if="sale.notes || sale.internalNotes">
            <h4 class="font-medium text-sm text-muted mb-3">Notes</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div v-if="sale.notes">
                <span class="text-gray-500">Notes:</span>
                <p class="font-medium mt-1 whitespace-pre-line">{{ sale.notes }}</p>
              </div>
              <div v-if="sale.internalNotes">
                <span class="text-gray-500">Internal notes:</span>
                <p class="font-medium mt-1 whitespace-pre-line">{{ sale.internalNotes }}</p>
              </div>
            </div>
          </template>
        </template>
      </UCard>

      <!-- Buyer & Producer -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UCard>
          <h3 class="text-lg font-semibold mb-3">Buyer</h3>
          <div class="space-y-1 text-sm">
            <p class="font-medium text-gray-900">{{ sale.buyerName }}</p>
            <p v-if="sale.buyerVatNumber" class="text-gray-500">VAT: {{ sale.buyerVatNumber }}</p>
            <p v-if="sale.buyerAddress" class="text-gray-500">{{ sale.buyerAddress }}, {{ sale.buyerCity }} {{ sale.buyerProvince ? `(${sale.buyerProvince})` : '' }} {{ sale.buyerPostalCode }}</p>
          </div>
        </UCard>
        <UCard>
          <h3 class="text-lg font-semibold mb-3">Producer</h3>
          <div class="space-y-1 text-sm">
            <p class="font-medium text-gray-900">{{ sale.producerName }}</p>
            <p v-if="sale.producerVatNumber" class="text-gray-500">VAT: {{ sale.producerVatNumber }}</p>
            <p v-if="sale.producerAddress" class="text-gray-500">{{ sale.producerAddress }}, {{ sale.producerCity }} {{ sale.producerProvince ? `(${sale.producerProvince})` : '' }} {{ sale.producerPostalCode }}</p>
          </div>
        </UCard>
      </div>

      <!-- Lines -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Lines</h3>
        <SaleLineEditor
          :sale-id="saleId"
          :lines="lines"
          :readonly="!isEditable"
          @refresh="refreshLines"
        />
        <div class="mt-4 max-w-sm ml-auto">
          <SaleTotals :lines="lines" />
        </div>
      </UCard>

      <!-- Invoice -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Invoice</h3>
        <InvoiceActions :sale="sale" />
      </UCard>

      <!-- Attachments -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Attachments</h3>
        <AttachmentUpload v-if="canWrite" :sale-id="saleId" @uploaded="refreshAttachments" />
        <div class="mt-4">
          <AttachmentList :sale-id="saleId" :attachments="attachments" :readonly="!canWrite" @refresh="refreshAttachments" />
        </div>
      </UCard>

      <!-- Metadata -->
      <div class="text-xs text-gray-400 space-y-1">
        <p>Created on {{ formatDateTime(sale.createdAt) }} by {{ sale.createdBy }}</p>
        <p>Updated on {{ formatDateTime(sale.updatedAt) }} by {{ sale.updatedBy }}</p>
      </div>
    </div>

    <!-- Dialogs -->
    <ConfirmDialog
      :open="showConfirmDialog"
      title="Confirm sale"
      message="Are you sure you want to confirm this sale? The status will change to 'Confirmed'."
      confirm-label="Confirm"
      @confirm="handleConfirm"
      @cancel="showConfirmDialog = false"
    />
    <ConfirmDialog
      :open="showDeleteDialog"
      title="Delete sale"
      message="Are you sure you want to delete this sale? This action cannot be undone."
      confirm-label="Delete"
      variant="danger"
      @confirm="handleDelete"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>
