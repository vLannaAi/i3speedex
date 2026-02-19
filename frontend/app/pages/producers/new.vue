<script setup lang="ts">
import { COUNTRIES, ITALIAN_PROVINCES, INVOICE_LANGUAGES, QUANTITY_OPTIONS } from '~/utils/constants'
import { getCountryDisplay } from '~/utils/display-helpers'

definePageMeta({ middleware: ['role'] })

const { createProducer } = useCachedProducers()
const toast = useAppToast()
const router = useRouter()

const saving = ref(false)

const selectedCountry = computed(() => getCountryDisplay(form.country))

const form = reactive({
  code: '',
  companyName: '',
  vatNumber: '',
  fiscalCode: '',
  sdi: '',
  pec: '',
  preferredLanguage: 'en',
  subName: '',
  address: '',
  poBox: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'IT',
  mainContact: '',
  email: '',
  phone: '',
  fax: '',
  website: '',
  defaultOperator: '',
  revenuePercentage: null as number | null,
  bankDetails: '',
  qualityAssurance: '',
  productionArea: '',
  markets: '',
  materials: '',
  products: '',
  standardProducts: '',
  diameterRange: '',
  maxLength: '',
  quantity: '',
  notes: '',
})

const errors = reactive<Record<string, string>>({})

function validate(): boolean {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.companyName) errors.companyName = 'Company name is required'
  if (!form.address) errors.address = 'Address is required'
  if (!form.city) errors.city = 'City is required'
  if (!form.postalCode) errors.postalCode = 'Postal code is required'
  if (!form.country) errors.country = 'Country is required'
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (!validate()) return
  saving.value = true
  try {
    const res = await createProducer({
      code: form.code || undefined,
      companyName: form.companyName,
      vatNumber: form.vatNumber || undefined,
      fiscalCode: form.fiscalCode || undefined,
      sdi: form.sdi || undefined,
      pec: form.pec || undefined,
      preferredLanguage: form.preferredLanguage || undefined,
      subName: form.subName || undefined,
      address: form.address,
      poBox: form.poBox || undefined,
      city: form.city,
      province: form.province || undefined,
      postalCode: form.postalCode,
      country: form.country,
      mainContact: form.mainContact || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      fax: form.fax || undefined,
      website: form.website || undefined,
      defaultOperator: form.defaultOperator || undefined,
      revenuePercentage: form.revenuePercentage ?? undefined,
      bankDetails: form.bankDetails || undefined,
      qualityAssurance: form.qualityAssurance || undefined,
      productionArea: form.productionArea || undefined,
      markets: form.markets || undefined,
      materials: form.materials || undefined,
      products: form.products || undefined,
      standardProducts: form.standardProducts || undefined,
      diameterRange: form.diameterRange || undefined,
      maxLength: form.maxLength || undefined,
      quantity: form.quantity || undefined,
      notes: form.notes || undefined,
    })
    if (res.success && res.data) {
      toast.success('Producer created')
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
    <div class="mb-6">
      <h1 class="text-2xl font-bold">New Producer</h1>
      <p class="text-sm text-muted mt-1">Enter the new producer details</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Company Details</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField label="Code" hint="Short reference handle">
            <UInput v-model="form.code" placeholder="e.g. quali" />
          </UFormField>
          <UFormField label="Company Name" required :error="errors.companyName">
            <UInput v-model="form.companyName" :color="errors.companyName ? 'error' : undefined" highlight />
          </UFormField>
          <UFormField label="VAT No." hint="e.g. IT12345678901">
            <UInput v-model="form.vatNumber" />
          </UFormField>
          <UFormField label="Fiscal Code">
            <UInput v-model="form.fiscalCode" />
          </UFormField>
          <UFormField label="SDI Code" hint="7 alphanumeric characters">
            <UInput v-model="form.sdi" />
          </UFormField>
          <UFormField label="Preferred Language">
            <USelect v-model="form.preferredLanguage" :items="INVOICE_LANGUAGES" />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <h3 class="text-lg font-semibold mb-4">Address</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="sm:col-span-2 lg:col-span-3">
            <UFormField label="Sub-name / c/o">
              <UInput v-model="form.subName" placeholder="c/o or sub-name" />
            </UFormField>
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <UFormField label="Address" required :error="errors.address">
              <UInput v-model="form.address" :color="errors.address ? 'error' : undefined" highlight />
            </UFormField>
          </div>
          <UFormField label="P.O. Box">
            <UInput v-model="form.poBox" />
          </UFormField>
          <UFormField label="City" required :error="errors.city">
            <UInput v-model="form.city" :color="errors.city ? 'error' : undefined" highlight />
          </UFormField>
          <UFormField label="Province">
            <USelect v-model="form.province" :items="ITALIAN_PROVINCES" placeholder="Select..." />
          </UFormField>
          <UFormField label="Postal Code" required :error="errors.postalCode">
            <UInput v-model="form.postalCode" :color="errors.postalCode ? 'error' : undefined" highlight />
          </UFormField>
          <UFormField label="Country" required>
            <div class="flex items-center gap-2">
              <UIcon v-if="selectedCountry.flag" :name="selectedCountry.flag" class="size-5 shrink-0" mode="svg" />
              <USelect v-model="form.country" :items="COUNTRIES" class="flex-1" />
            </div>
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <h3 class="text-lg font-semibold mb-4">Contacts</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField label="Main Contact"><UInput v-model="form.mainContact" placeholder="Contact person name" /></UFormField>
          <UFormField label="Email"><UInput v-model="form.email" type="email" /></UFormField>
          <UFormField label="Phone"><UInput v-model="form.phone" /></UFormField>
          <UFormField label="Fax"><UInput v-model="form.fax" /></UFormField>
          <UFormField label="Website"><UInput v-model="form.website" placeholder="https://..." /></UFormField>
          <UFormField label="PEC"><UInput v-model="form.pec" type="email" /></UFormField>
          <UFormField label="Default Operator"><UInput v-model="form.defaultOperator" /></UFormField>
        </div>
      </UCard>

      <UCard>
        <h3 class="text-lg font-semibold mb-4">Business Terms</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Revenue %" hint="Commission percentage">
            <UInput v-model.number="form.revenuePercentage" type="number" min="0" max="100" step="0.01" placeholder="e.g. 10" />
          </UFormField>
          <div class="sm:col-span-2">
            <UFormField label="Bank Details">
              <UTextarea v-model="form.bankDetails" :rows="2" placeholder="IBAN, bank name, SWIFT/BIC..." />
            </UFormField>
          </div>
        </div>
      </UCard>

      <UCard>
        <h3 class="text-lg font-semibold mb-4">Production Info</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Quality Assurance" hint="ISO certifications, etc.">
            <UTextarea v-model="form.qualityAssurance" :rows="3" placeholder="ISO 9001&#10;ISO TS 16949" />
          </UFormField>
          <UFormField label="Production Area" hint="Manufacturing capabilities">
            <UTextarea v-model="form.productionArea" :rows="3" placeholder="Cold forging&#10;Hot forging&#10;Turning" />
          </UFormField>
          <UFormField label="Markets">
            <UTextarea v-model="form.markets" :rows="3" placeholder="automotive&#10;general industry" />
          </UFormField>
          <UFormField label="Materials">
            <UTextarea v-model="form.materials" :rows="3" placeholder="carbon steel&#10;stainless&#10;special alloys" />
          </UFormField>
          <div class="sm:col-span-2">
            <UFormField label="Products">
              <UTextarea v-model="form.products" :rows="3" />
            </UFormField>
          </div>
          <div class="sm:col-span-2">
            <UFormField label="Standard Products">
              <UTextarea v-model="form.standardProducts" :rows="3" />
            </UFormField>
          </div>
          <UFormField label="Diameter Range">
            <UInput v-model="form.diameterRange" />
          </UFormField>
          <UFormField label="Max Length">
            <UInput v-model="form.maxLength" />
          </UFormField>
          <UFormField label="Quantity">
            <USelect v-model="form.quantity" :items="QUANTITY_OPTIONS" placeholder="Select..." />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <UFormField label="Notes"><UTextarea v-model="form.notes" :rows="4" /></UFormField>
      </UCard>

      <div class="flex justify-end gap-3">
        <NuxtLink to="/producers">
          <UButton variant="outline">Cancel</UButton>
        </NuxtLink>
        <UButton type="submit" :disabled="saving" :loading="saving">Create Producer</UButton>
      </div>
    </form>
  </div>
</template>
