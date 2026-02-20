<script setup lang="ts">
import type { Sale, SaleLine, Attachment, Buyer, Producer } from '~/types'
import { PAYMENT_METHODS, PAYMENT_TERMS, VAT_EXEMPT_OPTIONS } from '~/utils/constants'
import { getPaymentMethodLabel, getPaymentTermsLabel, getCountryDisplay } from '~/utils/display-helpers'

const route = useRoute()
const router = useRouter()
const saleId = route.params.id as string

const { fetchSale, updateSale, confirmSale, deleteSale, fetchSaleLines } = useCachedSales()
const { fetchBuyer } = useCachedBuyers()
const { fetchProducer } = useCachedProducers()
const { fetchAttachments } = useAttachments()
const { formatDate, formatCurrency, formatDateTime } = useFormatters()
const { canWrite } = useAuth()
const toast = useAppToast()

const sale = ref<Sale | null>(null)
const buyer = ref<Buyer | null>(null)
const producer = ref<Producer | null>(null)
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
      // Fetch buyer and producer details in parallel (non-blocking)
      const [buyerRes, producerRes] = await Promise.all([
        fetchBuyer(saleRes.data.buyerId).catch(() => null),
        fetchProducer(saleRes.data.producerId).catch(() => null),
      ])
      if (buyerRes?.success && buyerRes.data) buyer.value = buyerRes.data
      if (producerRes?.success && producerRes.data) producer.value = producerRes.data
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
    <div v-else-if="sale" class="flex flex-wrap items-start justify-between gap-4 mb-6">
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
      <div class="flex items-center gap-2">
        <UButton v-if="isEditable && !editing" variant="ghost" size="sm" icon="i-lucide-pen" @click="editing = true">
          Edit
        </UButton>
        <SaleActions
          :sale="sale"
          @confirm="showConfirmDialog = true"
        />
      </div>
    </div>

    <!-- Content -->
    <div v-if="loading">
      <UCard><LoadingSkeleton :lines="6" /></UCard>
    </div>
    <div v-else-if="sale" class="space-y-6">
      <!-- Edit Mode -->
      <UCard v-if="editing">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Edit Sale</h3>
        </div>

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
      </UCard>

      <!-- View Mode -->
      <UCard v-if="!editing">
        <!-- Sale Info -->
        <h4 class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted) mb-2">Sale Info</h4>
        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt class="text-(--ui-text-muted) text-xs">Date</dt>
            <dd class="font-medium">{{ formatDate(sale.saleDate) }}</dd>
          </div>
          <div v-if="sale.numberT">
            <dt class="text-(--ui-text-muted) text-xs">Number T</dt>
            <dd class="font-medium">{{ sale.numberT }}</dd>
          </div>
          <div v-if="sale.year">
            <dt class="text-(--ui-text-muted) text-xs">Year</dt>
            <dd class="font-medium">{{ sale.year }}</dd>
          </div>
          <div v-if="sale.registrationDate">
            <dt class="text-(--ui-text-muted) text-xs">Registration Date</dt>
            <dd class="font-medium">{{ formatDate(sale.registrationDate) }}</dd>
          </div>
          <div v-if="sale.ivaPercentage != null">
            <dt class="text-(--ui-text-muted) text-xs">IVA %</dt>
            <dd class="font-medium">{{ sale.ivaPercentage }}%</dd>
          </div>
          <div>
            <dt class="text-(--ui-text-muted) text-xs">Currency</dt>
            <dd class="font-medium">{{ sale.currency || 'EUR' }}</dd>
          </div>
        </dl>

        <!-- Invoice Info -->
        <template v-if="sale.referenceNumber || sale.poNumber || sale.poDate || sale.printedNote || sale.package">
          <hr class="my-4 border-(--ui-border)">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted) mb-2">Invoice Info</h4>
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div v-if="sale.referenceNumber">
              <dt class="text-(--ui-text-muted) text-xs">Buyer Reference</dt>
              <dd class="font-medium">{{ sale.referenceNumber }}</dd>
            </div>
            <div v-if="sale.poNumber">
              <dt class="text-(--ui-text-muted) text-xs">PO Number</dt>
              <dd class="font-medium">{{ sale.poNumber }}</dd>
            </div>
            <div v-if="sale.poDate">
              <dt class="text-(--ui-text-muted) text-xs">PO Date</dt>
              <dd class="font-medium">{{ formatDate(sale.poDate) }}</dd>
            </div>
            <div v-if="sale.printedNote" class="col-span-2 sm:col-span-3">
              <dt class="text-(--ui-text-muted) text-xs">Printed Note</dt>
              <dd class="font-medium whitespace-pre-line">{{ sale.printedNote }}</dd>
            </div>
            <div v-if="sale.package" class="col-span-2 sm:col-span-3">
              <dt class="text-(--ui-text-muted) text-xs">Package</dt>
              <dd class="font-medium whitespace-pre-line">{{ sale.package }}</dd>
            </div>
          </dl>
        </template>

        <!-- Payment -->
        <template v-if="sale.paymentMethod || sale.paymentTerms || sale.paymentDate || sale.bank || sale.paymentNote">
          <hr class="my-4 border-(--ui-border)">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted) mb-2">Payment</h4>
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div v-if="sale.paymentMethod">
              <dt class="text-(--ui-text-muted) text-xs">Method</dt>
              <dd class="font-medium">{{ getPaymentMethodLabel(sale.paymentMethod) }}</dd>
            </div>
            <div v-if="sale.paymentTerms">
              <dt class="text-(--ui-text-muted) text-xs">Terms</dt>
              <dd class="font-medium">{{ getPaymentTermsLabel(sale.paymentTerms) }}</dd>
            </div>
            <div v-if="sale.paymentDate">
              <dt class="text-(--ui-text-muted) text-xs">Payment Date</dt>
              <dd class="font-medium">{{ formatDate(sale.paymentDate) }}</dd>
            </div>
            <div v-if="sale.bank" class="col-span-2 sm:col-span-3">
              <dt class="text-(--ui-text-muted) text-xs">Bank</dt>
              <dd class="font-medium">{{ sale.bank }}</dd>
            </div>
            <div v-if="sale.paymentNote" class="col-span-2 sm:col-span-3">
              <dt class="text-(--ui-text-muted) text-xs">Payment Note</dt>
              <dd class="font-medium whitespace-pre-line">{{ sale.paymentNote }}</dd>
            </div>
          </dl>
        </template>

        <!-- Delivery -->
        <template v-if="sale.deliveryMethod || sale.deliveryDate || sale.deliveryNote || sale.dnNumber">
          <hr class="my-4 border-(--ui-border)">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted) mb-2">Delivery</h4>
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div v-if="sale.deliveryMethod">
              <dt class="text-(--ui-text-muted) text-xs">Method</dt>
              <dd class="font-medium">{{ sale.deliveryMethod }}</dd>
            </div>
            <div v-if="sale.deliveryDate">
              <dt class="text-(--ui-text-muted) text-xs">Date</dt>
              <dd class="font-medium">{{ formatDate(sale.deliveryDate) }}</dd>
            </div>
            <div v-if="sale.deliveryNote" class="col-span-2 sm:col-span-3">
              <dt class="text-(--ui-text-muted) text-xs">Delivery Note</dt>
              <dd class="font-medium whitespace-pre-line">{{ sale.deliveryNote }}</dd>
            </div>
            <div v-if="sale.dnNumber || sale.dnDate">
              <dt class="text-(--ui-text-muted) text-xs">DN 1</dt>
              <dd class="font-medium">{{ sale.dnNumber }}<template v-if="sale.dnDate"> — {{ formatDate(sale.dnDate) }}</template></dd>
            </div>
            <div v-if="sale.dnNumber2 || sale.dnDate2">
              <dt class="text-(--ui-text-muted) text-xs">DN 2</dt>
              <dd class="font-medium">{{ sale.dnNumber2 }}<template v-if="sale.dnDate2"> — {{ formatDate(sale.dnDate2) }}</template></dd>
            </div>
            <div v-if="sale.dnNumber3 || sale.dnDate3">
              <dt class="text-(--ui-text-muted) text-xs">DN 3</dt>
              <dd class="font-medium">{{ sale.dnNumber3 }}<template v-if="sale.dnDate3"> — {{ formatDate(sale.dnDate3) }}</template></dd>
            </div>
          </dl>
        </template>

        <!-- PA & Cash Order -->
        <template v-if="sale.paCupNumber || sale.paCigNumber || sale.coBankDescription || sale.coBankIban">
          <hr class="my-4 border-(--ui-border)">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted) mb-2">Public Admin & Cash Order</h4>
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div v-if="sale.paCupNumber">
              <dt class="text-(--ui-text-muted) text-xs">PA CUP</dt>
              <dd class="font-medium">{{ sale.paCupNumber }}</dd>
            </div>
            <div v-if="sale.paCigNumber">
              <dt class="text-(--ui-text-muted) text-xs">PA CIG</dt>
              <dd class="font-medium">{{ sale.paCigNumber }}</dd>
            </div>
            <div v-if="sale.coBankDescription">
              <dt class="text-(--ui-text-muted) text-xs">C/O Bank</dt>
              <dd class="font-medium">{{ sale.coBankDescription }}</dd>
            </div>
            <div v-if="sale.coBankIban" class="col-span-2 sm:col-span-3">
              <dt class="text-(--ui-text-muted) text-xs">C/O IBAN</dt>
              <dd class="font-medium font-mono">{{ sale.coBankIban }}</dd>
            </div>
          </dl>
        </template>

        <!-- VAT & Invoice Options -->
        <template v-if="sale.vatOff || (sale.pdfFontBase && sale.pdfFontBase !== 8) || sale.attachInvoice === false">
          <hr class="my-4 border-(--ui-border)">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted) mb-2">VAT & Invoice Options</h4>
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div v-if="sale.vatOff">
              <dt class="text-(--ui-text-muted) text-xs">VAT Off</dt>
              <dd class="font-medium">{{ sale.vatOff }}</dd>
            </div>
            <div v-if="sale.pdfFontBase && sale.pdfFontBase !== 8">
              <dt class="text-(--ui-text-muted) text-xs">PDF Font Base</dt>
              <dd class="font-medium">{{ sale.pdfFontBase }}pt</dd>
            </div>
            <div v-if="sale.attachInvoice === false">
              <dt class="text-(--ui-text-muted) text-xs">Attach Invoice</dt>
              <dd class="font-medium">No</dd>
            </div>
          </dl>
        </template>

        <!-- Notes -->
        <template v-if="sale.notes || sale.internalNotes">
          <hr class="my-4 border-(--ui-border)">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted) mb-2">Notes</h4>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div v-if="sale.notes">
              <dt class="text-(--ui-text-muted) text-xs">Notes</dt>
              <dd class="font-medium whitespace-pre-line">{{ sale.notes }}</dd>
            </div>
            <div v-if="sale.internalNotes">
              <dt class="text-(--ui-text-muted) text-xs">Internal Notes</dt>
              <dd class="font-medium whitespace-pre-line">{{ sale.internalNotes }}</dd>
            </div>
          </dl>
        </template>
      </UCard>

      <!-- Buyer & Producer -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UCard>
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold">Buyer</h3>
            <NuxtLink v-if="sale.buyerId" :to="`/buyers/${sale.buyerId}`" class="text-xs text-primary hover:underline">View</NuxtLink>
          </div>
          <div class="space-y-1 text-sm">
            <div class="flex items-center gap-2">
              <UIcon v-if="sale.buyerCountry" :name="getCountryDisplay(sale.buyerCountry).flag" class="size-4 shrink-0" />
              <p class="font-medium">{{ sale.buyerName }}</p>
              <span v-if="buyer?.code" class="text-xs text-(--ui-text-muted) font-mono">{{ buyer.code }}</span>
            </div>
            <p v-if="sale.buyerCountry" class="text-(--ui-text-muted)">{{ getCountryDisplay(sale.buyerCountry).label }}</p>
            <p v-if="sale.buyerVatNumber" class="text-(--ui-text-muted)">VAT: {{ sale.buyerVatNumber }}</p>
            <p v-if="sale.buyerAddress" class="text-(--ui-text-muted)">{{ sale.buyerAddress }}, {{ sale.buyerCity }} {{ sale.buyerProvince ? `(${sale.buyerProvince})` : '' }} {{ sale.buyerPostalCode }}</p>
          </div>
        </UCard>
        <UCard>
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold">Producer</h3>
            <NuxtLink v-if="sale.producerId" :to="`/producers/${sale.producerId}`" class="text-xs text-primary hover:underline">View</NuxtLink>
          </div>
          <div class="space-y-1 text-sm">
            <div class="flex items-center gap-2">
              <UIcon v-if="sale.producerCountry" :name="getCountryDisplay(sale.producerCountry).flag" class="size-4 shrink-0" />
              <p class="font-medium">{{ sale.producerName }}</p>
              <span v-if="producer?.code" class="text-xs text-(--ui-text-muted) font-mono">{{ producer.code }}</span>
            </div>
            <p v-if="sale.producerCountry" class="text-(--ui-text-muted)">{{ getCountryDisplay(sale.producerCountry).label }}</p>
            <p v-if="sale.producerVatNumber" class="text-(--ui-text-muted)">VAT: {{ sale.producerVatNumber }}</p>
            <p v-if="sale.producerAddress" class="text-(--ui-text-muted)">{{ sale.producerAddress }}, {{ sale.producerCity }} {{ sale.producerProvince ? `(${sale.producerProvince})` : '' }} {{ sale.producerPostalCode }}</p>
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
      <div class="text-xs text-(--ui-text-dimmed) space-y-1">
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
