<script setup lang="ts">
import { PAYMENT_METHODS, PAYMENT_TERMS, COUNTRIES, ITALIAN_PROVINCES, SECTORS, VAT_EXEMPT_OPTIONS, CURRENCIES, INVOICE_LANGUAGES } from '~/utils/constants'
import { getCountryDisplay } from '~/utils/display-helpers'

definePageMeta({ middleware: ['role'] })

const { createBuyer } = useCachedBuyers()
const toast = useAppToast()
const router = useRouter()

const saving = ref(false)

const selectedCountry = computed(() => getCountryDisplay(form.country))

const form = reactive({
  code: '',
  companyName: '',
  industrialGroup: '',
  sector: '',
  vatNumber: '',
  fiscalCode: '',
  vatExempt: '',
  currency: 'EUR',
  preferredLanguage: 'it',
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
  pec: '',
  sdi: '',
  defaultPaymentMethod: '',
  defaultPaymentTerms: '',
  defaultOperator: '',
  bankDetails: '',
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
    const res = await createBuyer({
      code: form.code || undefined,
      companyName: form.companyName,
      industrialGroup: form.industrialGroup || undefined,
      sector: form.sector || undefined,
      vatNumber: form.vatNumber || undefined,
      fiscalCode: form.fiscalCode || undefined,
      vatExempt: form.vatExempt || undefined,
      currency: form.currency || undefined,
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
      pec: form.pec || undefined,
      sdi: form.sdi || undefined,
      defaultPaymentMethod: form.defaultPaymentMethod || undefined,
      defaultPaymentTerms: form.defaultPaymentTerms || undefined,
      defaultOperator: form.defaultOperator || undefined,
      bankDetails: form.bankDetails || undefined,
      notes: form.notes || undefined,
    })
    if (res.success && res.data) {
      toast.success('Buyer created')
      router.push(`/buyers/${res.data.buyerId}`)
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
      <h1 class="text-2xl font-bold">New Buyer</h1>
      <p class="text-sm text-muted mt-1">Enter the new buyer details</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <UCard>
        <h3 class="text-lg font-semibold mb-4">Company Details</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField label="Code" hint="Short reference handle">
            <UInput v-model="form.code" placeholder="e.g. Condotte Algeria" />
          </UFormField>
          <UFormField label="Company Name" required :error="errors.companyName">
            <UInput v-model="form.companyName" :color="errors.companyName ? 'error' : undefined" highlight />
          </UFormField>
          <UFormField label="Industrial Group">
            <UInput v-model="form.industrialGroup" />
          </UFormField>
          <UFormField label="Sector">
            <USelect v-model="form.sector" :items="SECTORS" placeholder="Select..." />
          </UFormField>
          <UFormField label="VAT No." hint="e.g. IT12345678901">
            <UInput v-model="form.vatNumber" />
          </UFormField>
          <UFormField label="Fiscal Code">
            <UInput v-model="form.fiscalCode" />
          </UFormField>
          <UFormField label="VAT Regime">
            <USelect v-model="form.vatExempt" :items="VAT_EXEMPT_OPTIONS" placeholder="Select..." />
          </UFormField>
          <UFormField label="Currency">
            <USelect v-model="form.currency" :items="CURRENCIES" />
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
          <UFormField label="SDI Code" hint="7 alphanumeric characters"><UInput v-model="form.sdi" /></UFormField>
        </div>
      </UCard>

      <UCard>
        <h3 class="text-lg font-semibold mb-4">Payment & Operations</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Payment Method"><USelect v-model="form.defaultPaymentMethod" :items="PAYMENT_METHODS" placeholder="Select..." /></UFormField>
          <UFormField label="Payment Terms"><USelect v-model="form.defaultPaymentTerms" :items="PAYMENT_TERMS" placeholder="Select..." /></UFormField>
          <UFormField label="Default Operator"><UInput v-model="form.defaultOperator" /></UFormField>
          <div class="sm:col-span-2">
            <UFormField label="Bank Details"><UTextarea v-model="form.bankDetails" :rows="2" placeholder="IBAN, bank name, SWIFT/BIC..." /></UFormField>
          </div>
        </div>
      </UCard>

      <UCard>
        <UFormField label="Notes"><UTextarea v-model="form.notes" :rows="4" /></UFormField>
      </UCard>

      <div class="flex justify-end gap-3">
        <NuxtLink to="/buyers">
          <UButton variant="outline">Cancel</UButton>
        </NuxtLink>
        <UButton type="submit" :disabled="saving" :loading="saving">Create Buyer</UButton>
      </div>
    </form>
  </div>
</template>
