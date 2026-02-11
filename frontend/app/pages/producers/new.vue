<script setup lang="ts">
import { COUNTRIES, ITALIAN_PROVINCES } from '~/utils/constants'

definePageMeta({ middleware: ['role'] })

const { createProducer } = useProducers()
const toast = useToast()
const router = useRouter()

const saving = ref(false)
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
})

const errors = reactive<Record<string, string>>({})

function validate(): boolean {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.companyName) errors.companyName = 'Ragione sociale obbligatoria'
  if (!form.address) errors.address = 'Indirizzo obbligatorio'
  if (!form.city) errors.city = 'Città obbligatoria'
  if (!form.postalCode) errors.postalCode = 'CAP obbligatorio'
  if (!form.country) errors.country = 'Paese obbligatorio'
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (!validate()) return
  saving.value = true
  try {
    const res = await createProducer({
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
    })
    if (res.success && res.data) {
      toast.success('Produttore creato')
      router.push(`/producers/${res.data.producerId}`)
    }
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <BreadcrumbNav :items="[
      { label: 'Dashboard', to: '/' },
      { label: 'Produttori', to: '/producers' },
      { label: 'Nuovo Produttore' },
    ]" />
    <div class="mb-6">
      <h1 class="page-title">Nuovo Produttore</h1>
      <p class="page-subtitle">Inserisci i dati del nuovo produttore</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div class="card card-body">
        <h3 class="section-title mb-4">Dati Azienda</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="Ragione Sociale" required :error="errors.companyName">
            <FormInput v-model="form.companyName" :error="!!errors.companyName" />
          </FormField>
          <FormField label="P.IVA" hint="Es. IT12345678901">
            <FormInput v-model="form.vatNumber" />
          </FormField>
          <FormField label="Codice Fiscale">
            <FormInput v-model="form.fiscalCode" />
          </FormField>
        </div>
      </div>

      <div class="card card-body">
        <h3 class="section-title mb-4">Indirizzo</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="sm:col-span-2 lg:col-span-3">
            <FormField label="Indirizzo" required :error="errors.address">
              <FormInput v-model="form.address" :error="!!errors.address" />
            </FormField>
          </div>
          <FormField label="Città" required :error="errors.city">
            <FormInput v-model="form.city" :error="!!errors.city" />
          </FormField>
          <FormField label="Provincia">
            <FormSelect v-model="form.province" :options="provinceOptions" placeholder="Seleziona..." />
          </FormField>
          <FormField label="CAP" required :error="errors.postalCode">
            <FormInput v-model="form.postalCode" :error="!!errors.postalCode" />
          </FormField>
          <FormField label="Paese" required>
            <FormSelect v-model="form.country" :options="COUNTRIES" />
          </FormField>
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
        <NuxtLink to="/producers" class="btn-secondary">Annulla</NuxtLink>
        <button type="submit" class="btn-primary" :disabled="saving">
          <i v-if="saving" class="fa-solid fa-spinner fa-spin" /> Crea Produttore
        </button>
      </div>
    </form>
  </div>
</template>
