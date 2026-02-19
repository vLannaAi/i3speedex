<script setup lang="ts">
import type { Buyer, Producer } from '~/types'
import { PAYMENT_METHODS, PAYMENT_TERMS, VAT_EXEMPT_OPTIONS } from '~/utils/constants'

definePageMeta({ middleware: ['role'] })

const { createSale } = useCachedSales()
const toast = useAppToast()
const router = useRouter()

const saving = ref(false)
const currentYear = new Date().getFullYear()

const form = reactive({
  saleDate: new Date().toISOString().slice(0, 10),
  buyerId: '',
  producerId: '',
  numberT: null as number | null,
  year: currentYear,
  registrationDate: '',
  ivaPercentage: 22 as number | null,
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
  pdfFontBase: 8 as number | null,
  notes: '',
  internalNotes: '',
  currency: 'EUR',
})

const errors = reactive<Record<string, string>>({})

function validate(): boolean {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.saleDate) errors.saleDate = 'Date is required'
  if (!form.buyerId) errors.buyerId = 'Select a buyer'
  if (!form.producerId) errors.producerId = 'Select a producer'
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (!validate()) return
  saving.value = true
  try {
    const res = await createSale({
      saleDate: form.saleDate,
      buyerId: form.buyerId,
      producerId: form.producerId,
      paymentMethod: form.paymentMethod || undefined,
      paymentTerms: form.paymentTerms || undefined,
      deliveryMethod: form.deliveryMethod || undefined,
      deliveryDate: form.deliveryDate || undefined,
      notes: form.notes || undefined,
      internalNotes: form.internalNotes || undefined,
      referenceNumber: form.referenceNumber || undefined,
      currency: form.currency,
      numberT: form.numberT ?? undefined,
      year: form.year ?? undefined,
      registrationDate: form.registrationDate || undefined,
      ivaPercentage: form.ivaPercentage ?? undefined,
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
    })
    if (res.success && res.data) {
      toast.success('Sale created')
      router.push(`/sales/${res.data.saleId}`)
    }
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    saving.value = false
  }
}

function onBuyerSelect(buyer: Buyer) {
  if (buyer.defaultPaymentMethod && !form.paymentMethod) {
    form.paymentMethod = buyer.defaultPaymentMethod
  }
  if (buyer.defaultPaymentTerms && !form.paymentTerms) {
    form.paymentTerms = buyer.defaultPaymentTerms
  }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold">New Sale</h1>
      <p class="text-sm text-muted mt-1">Fill in the details to create a new sale</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Sales Info -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Sales Info</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField label="Sale date" required :error="errors.saleDate">
            <UInput v-model="form.saleDate" type="date" :color="errors.saleDate ? 'error' : undefined" highlight />
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
          <UFormField label="Buyer" required :error="errors.buyerId">
            <BuyerSelect v-model="form.buyerId" :error="!!errors.buyerId" @select="onBuyerSelect" />
          </UFormField>
          <UFormField label="Producer" required :error="errors.producerId">
            <ProducerSelect v-model="form.producerId" :error="!!errors.producerId" />
          </UFormField>
        </div>
      </UCard>

      <!-- Invoice Info -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Invoice Info</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
      </UCard>

      <!-- Delivery -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Delivery</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField label="Delivery method">
            <UInput v-model="form.deliveryMethod" placeholder="e.g. Courier, Pickup..." />
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
      </UCard>

      <!-- Public Administration -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Public Administration</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField label="PA CUP Number">
            <UInput v-model="form.paCupNumber" />
          </UFormField>
          <UFormField label="PA CIG Number">
            <UInput v-model="form.paCigNumber" />
          </UFormField>
        </div>
      </UCard>

      <!-- Payment -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Payment</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
      </UCard>

      <!-- Cash Order -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Cash Order (C/O)</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField label="C/O Bank Description">
            <UInput v-model="form.coBankDescription" />
          </UFormField>
          <UFormField label="C/O Bank IBAN">
            <UInput v-model="form.coBankIban" />
          </UFormField>
        </div>
      </UCard>

      <!-- VAT & Invoice Options -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">VAT & Invoice Options</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
      </UCard>

      <!-- Notes -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Notes</h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UFormField label="Notes">
            <UTextarea v-model="form.notes" placeholder="Notes visible on invoice" :rows="4" />
          </UFormField>
          <UFormField label="Internal notes">
            <UTextarea v-model="form.internalNotes" placeholder="Internal use only" :rows="4" />
          </UFormField>
        </div>
      </UCard>

      <!-- Submit -->
      <div class="flex justify-end gap-3">
        <UButton to="/sales" variant="outline">Cancel</UButton>
        <UButton type="submit" :loading="saving">Create Sale</UButton>
      </div>
    </form>
  </div>
</template>
