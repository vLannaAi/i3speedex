<script setup lang="ts">
import type { Sale, SaleLine, Attachment } from '~/types'
import { PAYMENT_METHODS, PAYMENT_TERMS } from '~/utils/constants'

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

const isEditable = computed(() => canWrite.value && sale.value?.status === 'draft')

onMounted(() => load())
</script>

<template>
  <div>
    <BreadcrumbNav :items="[
      { label: 'Dashboard', to: '/' },
      { label: 'Sales', to: '/sales' },
      { label: sale ? `#${sale.saleNumber}` : '...' },
    ]" />

    <!-- Header -->
    <div v-if="loading" class="mb-6">
      <LoadingSkeleton :lines="2" height="28px" />
    </div>
    <div v-else-if="sale" class="flex items-start justify-between mb-6">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold">Sale #{{ sale.saleNumber }}</h1>
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
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <UFormField label="Sale date" required>
              <UInput v-model="form.saleDate" type="date" />
            </UFormField>
            <UFormField label="Payment method">
              <USelect v-model="form.paymentMethod" :items="PAYMENT_METHODS" placeholder="Select..." />
            </UFormField>
            <UFormField label="Payment terms">
              <USelect v-model="form.paymentTerms" :items="PAYMENT_TERMS" placeholder="Select..." />
            </UFormField>
            <UFormField label="Delivery method">
              <UInput v-model="form.deliveryMethod" />
            </UFormField>
            <UFormField label="Delivery date">
              <UInput v-model="form.deliveryDate" type="date" />
            </UFormField>
            <UFormField label="Reference">
              <UInput v-model="form.referenceNumber" />
            </UFormField>
            <div class="sm:col-span-2 lg:col-span-3">
              <UFormField label="Notes">
                <UTextarea v-model="form.notes" :rows="3" />
              </UFormField>
            </div>
            <div class="sm:col-span-2 lg:col-span-3">
              <UFormField label="Internal notes">
                <UTextarea v-model="form.internalNotes" :rows="3" />
              </UFormField>
            </div>
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
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div><span class="text-gray-500">Date:</span> <span class="font-medium">{{ formatDate(sale.saleDate) }}</span></div>
            <div><span class="text-gray-500">Payment:</span> <span class="font-medium">{{ sale.paymentMethod || '—' }}</span></div>
            <div><span class="text-gray-500">Terms:</span> <span class="font-medium">{{ sale.paymentTerms || '—' }}</span></div>
            <div><span class="text-gray-500">Delivery:</span> <span class="font-medium">{{ sale.deliveryMethod || '—' }}</span></div>
            <div><span class="text-gray-500">Delivery date:</span> <span class="font-medium">{{ formatDate(sale.deliveryDate) }}</span></div>
            <div><span class="text-gray-500">Reference:</span> <span class="font-medium">{{ sale.referenceNumber || '—' }}</span></div>
            <div v-if="sale.notes" class="sm:col-span-2 lg:col-span-3">
              <span class="text-gray-500">Notes:</span>
              <p class="font-medium mt-1">{{ sale.notes }}</p>
            </div>
            <div v-if="sale.internalNotes" class="sm:col-span-2 lg:col-span-3">
              <span class="text-gray-500">Internal notes:</span>
              <p class="font-medium mt-1">{{ sale.internalNotes }}</p>
            </div>
          </div>
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
