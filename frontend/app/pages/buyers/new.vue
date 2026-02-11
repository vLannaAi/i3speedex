<script setup lang="ts">
import { PAYMENT_METHODS, PAYMENT_TERMS, COUNTRIES, ITALIAN_PROVINCES } from '~/utils/constants'

definePageMeta({ middleware: ['role'] })

const { createBuyer } = useBuyers()
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
  pec: '',
  sdi: '',
  defaultPaymentMethod: '',
  defaultPaymentTerms: '',
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
      pec: form.pec || undefined,
      sdi: form.sdi || undefined,
      defaultPaymentMethod: form.defaultPaymentMethod || undefined,
      defaultPaymentTerms: form.defaultPaymentTerms || undefined,
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
    <BreadcrumbNav :items="[
      { label: 'Dashboard', to: '/' },
      { label: 'Buyers', to: '/buyers' },
      { label: 'New Buyer' },
    ]" />
    <div class="mb-6">
      <h1 class="page-title">New Buyer</h1>
      <p class="page-subtitle">Enter the new buyer details</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div class="card card-body">
        <h3 class="section-title mb-4">Company Details</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="Company Name" required :error="errors.companyName">
            <FormInput v-model="form.companyName" :error="!!errors.companyName" />
          </FormField>
          <FormField label="VAT No." hint="e.g. IT12345678901">
            <FormInput v-model="form.vatNumber" />
          </FormField>
          <FormField label="Fiscal Code">
            <FormInput v-model="form.fiscalCode" />
          </FormField>
        </div>
      </div>

      <div class="card card-body">
        <h3 class="section-title mb-4">Address</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="sm:col-span-2 lg:col-span-3">
            <FormField label="Address" required :error="errors.address">
              <FormInput v-model="form.address" :error="!!errors.address" />
            </FormField>
          </div>
          <FormField label="City" required :error="errors.city">
            <FormInput v-model="form.city" :error="!!errors.city" />
          </FormField>
          <FormField label="Province">
            <FormSelect v-model="form.province" :options="provinceOptions" placeholder="Select..." />
          </FormField>
          <FormField label="Postal Code" required :error="errors.postalCode">
            <FormInput v-model="form.postalCode" :error="!!errors.postalCode" />
          </FormField>
          <FormField label="Country" required>
            <FormSelect v-model="form.country" :options="COUNTRIES" />
          </FormField>
        </div>
      </div>

      <div class="card card-body">
        <h3 class="section-title mb-4">Contacts</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="Email"><FormInput v-model="form.email" type="email" /></FormField>
          <FormField label="Phone"><FormInput v-model="form.phone" /></FormField>
          <FormField label="PEC"><FormInput v-model="form.pec" type="email" /></FormField>
          <FormField label="SDI Code" hint="7 alphanumeric characters"><FormInput v-model="form.sdi" /></FormField>
        </div>
      </div>

      <div class="card card-body">
        <h3 class="section-title mb-4">Default Payment</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Payment method"><FormSelect v-model="form.defaultPaymentMethod" :options="PAYMENT_METHODS" placeholder="Select..." /></FormField>
          <FormField label="Payment terms"><FormSelect v-model="form.defaultPaymentTerms" :options="PAYMENT_TERMS" placeholder="Select..." /></FormField>
        </div>
      </div>

      <div class="card card-body">
        <FormField label="Notes"><FormTextarea v-model="form.notes" :max-length="1000" /></FormField>
      </div>

      <div class="flex justify-end gap-3">
        <NuxtLink to="/buyers" class="btn-secondary">Cancel</NuxtLink>
        <button type="submit" class="btn-primary" :disabled="saving">
          <i v-if="saving" class="fa-solid fa-spinner fa-spin" /> Create Buyer
        </button>
      </div>
    </form>
  </div>
</template>
