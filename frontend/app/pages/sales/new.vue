<script setup lang="ts">
import type { Buyer, Producer } from '~/types'
import { PAYMENT_METHODS, PAYMENT_TERMS } from '~/utils/constants'

definePageMeta({ middleware: ['role'] })

const { createSale } = useSales()
const toast = useAppToast()
const router = useRouter()

const saving = ref(false)

const form = reactive({
  saleDate: new Date().toISOString().slice(0, 10),
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
      <h1 class="text-2xl font-bold">New Sale</h1>
      <p class="text-sm text-muted mt-1">Fill in the details to create a new sale</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Main info -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Main Information</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField label="Sale date" required :error="errors.saleDate">
            <UInput
              v-model="form.saleDate"
              type="date"
              :color="errors.saleDate ? 'error' : undefined"
              highlight
            />
          </UFormField>
          <UFormField label="Buyer" required :error="errors.buyerId">
            <BuyerSelect
              v-model="form.buyerId"
              :error="!!errors.buyerId"
              @select="onBuyerSelect"
            />
          </UFormField>
          <UFormField label="Producer" required :error="errors.producerId">
            <ProducerSelect
              v-model="form.producerId"
              :error="!!errors.producerId"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- Payment & delivery -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Payment & Delivery</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField label="Payment method">
            <USelect
              v-model="form.paymentMethod"
              :items="PAYMENT_METHODS"
              placeholder="Select..."
            />
          </UFormField>
          <UFormField label="Payment terms">
            <USelect
              v-model="form.paymentTerms"
              :items="PAYMENT_TERMS"
              placeholder="Select..."
            />
          </UFormField>
          <UFormField label="Delivery method">
            <UInput
              v-model="form.deliveryMethod"
              placeholder="e.g. Courier, Pickup..."
            />
          </UFormField>
          <UFormField label="Delivery date">
            <UInput
              v-model="form.deliveryDate"
              type="date"
            />
          </UFormField>
          <UFormField label="Reference">
            <UInput
              v-model="form.referenceNumber"
              placeholder="Order ref., DDT..."
            />
          </UFormField>
        </div>
      </UCard>

      <!-- Notes -->
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Notes</h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UFormField label="Notes">
            <UTextarea
              v-model="form.notes"
              placeholder="Notes visible on invoice"
              :rows="4"
            />
          </UFormField>
          <UFormField label="Internal notes">
            <UTextarea
              v-model="form.internalNotes"
              placeholder="Internal use only"
              :rows="4"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- Submit -->
      <div class="flex justify-end gap-3">
        <UButton to="/sales" variant="outline">Cancel</UButton>
        <UButton type="submit" :loading="saving">
          Create Sale
        </UButton>
      </div>
    </form>
  </div>
</template>
