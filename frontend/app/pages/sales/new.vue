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
  if (!form.saleDate) errors.saleDate = 'Data obbligatoria'
  if (!form.buyerId) errors.buyerId = 'Seleziona un acquirente'
  if (!form.producerId) errors.producerId = 'Seleziona un produttore'
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
      toast.success('Vendita creata')
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
      { label: 'Vendite', to: '/sales' },
      { label: 'Nuova Vendita' },
    ]" />
    <div class="mb-6">
      <h1 class="page-title">Nuova Vendita</h1>
      <p class="page-subtitle">Compila i dati per creare una nuova vendita</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Main info -->
      <div class="card card-body">
        <h3 class="section-title mb-4">Informazioni Principali</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="Data vendita" required :error="errors.saleDate">
            <FormDatePicker v-model="form.saleDate" :error="!!errors.saleDate" />
          </FormField>
          <FormField label="Acquirente" required :error="errors.buyerId">
            <BuyerSelect v-model="form.buyerId" :error="!!errors.buyerId" @select="onBuyerSelect" />
          </FormField>
          <FormField label="Produttore" required :error="errors.producerId">
            <ProducerSelect v-model="form.producerId" :error="!!errors.producerId" />
          </FormField>
        </div>
      </div>

      <!-- Payment & delivery -->
      <div class="card card-body">
        <h3 class="section-title mb-4">Pagamento e Consegna</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="Metodo pagamento">
            <FormSelect v-model="form.paymentMethod" :options="PAYMENT_METHODS" placeholder="Seleziona..." />
          </FormField>
          <FormField label="Termini pagamento">
            <FormSelect v-model="form.paymentTerms" :options="PAYMENT_TERMS" placeholder="Seleziona..." />
          </FormField>
          <FormField label="Metodo consegna">
            <FormInput v-model="form.deliveryMethod" placeholder="Es. Corriere, Ritiro..." />
          </FormField>
          <FormField label="Data consegna">
            <FormDatePicker v-model="form.deliveryDate" />
          </FormField>
          <FormField label="Riferimento">
            <FormInput v-model="form.referenceNumber" placeholder="Rif. ordine, DDT..." />
          </FormField>
        </div>
      </div>

      <!-- Notes -->
      <div class="card card-body">
        <h3 class="section-title mb-4">Note</h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormField label="Note">
            <FormTextarea v-model="form.notes" placeholder="Note visibili in fattura" :max-length="1000" />
          </FormField>
          <FormField label="Note interne">
            <FormTextarea v-model="form.internalNotes" placeholder="Note solo uso interno" :max-length="1000" />
          </FormField>
        </div>
      </div>

      <!-- Submit -->
      <div class="flex justify-end gap-3">
        <NuxtLink to="/sales" class="btn-secondary">Annulla</NuxtLink>
        <button type="submit" class="btn-primary" :disabled="saving">
          <div v-if="saving" class="i-mdi-loading animate-spin" />
          Crea Vendita
        </button>
      </div>
    </form>
  </div>
</template>
