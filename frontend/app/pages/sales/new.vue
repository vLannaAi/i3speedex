<script setup lang="ts">
import type { Buyer, Producer } from '~/types'
import { PAYMENT_METHODS, PAYMENT_TERMS } from '~/utils/constants'

definePageMeta({ middleware: ['role'] })

const { createSale } = useSales()
const toast = useToast()
const router = useRouter()

const saving = ref(false)

const form = reactive({
  saleDate: new Date().toISOString().split('T')[0],
  buyerId: '',
  producerId: '',
  paymentMethod: '',
  paymentTerms: '',
  deliveryMethod: '',
  deliveryDate: '',
  notes: '',
  internalNotes: '',
  referenceNumber: '',
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
    <BreadcrumbNav :items="[
      { label: 'Dashboard', to: '/' },
      { label: 'Sales', to: '/sales' },
      { label: 'New Sale' },
    ]" />
    <div class="mb-6">
      <h1 class="page-title">New Sale</h1>
      <p class="page-subtitle">Fill in the details to create a new sale</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Main info -->
      <div class="card card-body">
        <h3 class="section-title mb-4">Main Information</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="Sale date" required :error="errors.saleDate">
            <FormDatePicker v-model="form.saleDate" :error="!!errors.saleDate" />
          </FormField>
          <FormField label="Buyer" required :error="errors.buyerId">
            <BuyerSelect v-model="form.buyerId" :error="!!errors.buyerId" @select="onBuyerSelect" />
          </FormField>
          <FormField label="Producer" required :error="errors.producerId">
            <ProducerSelect v-model="form.producerId" :error="!!errors.producerId" />
          </FormField>
        </div>
      </div>

      <!-- Payment & delivery -->
      <div class="card card-body">
        <h3 class="section-title mb-4">Payment & Delivery</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="Payment method">
            <FormSelect v-model="form.paymentMethod" :options="PAYMENT_METHODS" placeholder="Select..." />
          </FormField>
          <FormField label="Payment terms">
            <FormSelect v-model="form.paymentTerms" :options="PAYMENT_TERMS" placeholder="Select..." />
          </FormField>
          <FormField label="Delivery method">
            <FormInput v-model="form.deliveryMethod" placeholder="e.g. Courier, Pickup..." />
          </FormField>
          <FormField label="Delivery date">
            <FormDatePicker v-model="form.deliveryDate" />
          </FormField>
          <FormField label="Reference">
            <FormInput v-model="form.referenceNumber" placeholder="Order ref., DDT..." />
          </FormField>
        </div>
      </div>

      <!-- Notes -->
      <div class="card card-body">
        <h3 class="section-title mb-4">Notes</h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormField label="Notes">
            <FormTextarea v-model="form.notes" placeholder="Notes visible on invoice" :max-length="1000" />
          </FormField>
          <FormField label="Internal notes">
            <FormTextarea v-model="form.internalNotes" placeholder="Internal use only" :max-length="1000" />
          </FormField>
        </div>
      </div>

      <!-- Submit -->
      <div class="flex justify-end gap-3">
        <NuxtLink to="/sales" class="btn-secondary">Cancel</NuxtLink>
        <button type="submit" class="btn-primary" :disabled="saving">
          <i v-if="saving" class="fa-solid fa-spinner fa-spin" />
          Create Sale
        </button>
      </div>
    </form>
  </div>
</template>
