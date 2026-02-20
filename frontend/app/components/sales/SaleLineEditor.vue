<script setup lang="ts">
import type { SaleLine, CreateSaleLineRequest } from '~/types'
import { calculateLineAmounts } from '~/utils/calculations'
import { TAX_RATES, UNITS_OF_MEASURE } from '~/utils/constants'

const props = defineProps<{
  saleId: string
  lines: SaleLine[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { createSaleLine, updateSaleLine, deleteSaleLine } = useSales()
const { formatCurrency } = useFormatters()
const toast = useAppToast()

const showForm = ref(false)
const editing = ref<string | null>(null)
const saving = ref(false)
const deleting = ref<string | null>(null)

const form = reactive({
  productCode: '',
  productDescription: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  taxRate: 22,
  unitOfMeasure: 'pz',
  notes: '',
})

const preview = computed(() => calculateLineAmounts({
  quantity: form.quantity,
  unitPrice: form.unitPrice,
  discount: form.discount,
  taxRate: form.taxRate,
}))

function resetForm() {
  form.productCode = ''
  form.productDescription = ''
  form.quantity = 1
  form.unitPrice = 0
  form.discount = 0
  form.taxRate = 22
  form.unitOfMeasure = 'pz'
  form.notes = ''
  editing.value = null
  showForm.value = false
}

function editLine(line: SaleLine) {
  form.productCode = line.productCode || ''
  form.productDescription = line.productDescription
  form.quantity = line.quantity
  form.unitPrice = line.unitPrice
  form.discount = line.discount
  form.taxRate = line.taxRate
  form.unitOfMeasure = line.unitOfMeasure || 'pz'
  form.notes = line.notes || ''
  editing.value = line.lineId
  showForm.value = true
}

async function save() {
  if (!form.productDescription) {
    toast.error('Enter the product description')
    return
  }
  saving.value = true
  try {
    const data: CreateSaleLineRequest = {
      productCode: form.productCode || undefined,
      productDescription: form.productDescription,
      quantity: Number(form.quantity),
      unitPrice: Number(form.unitPrice),
      discount: Number(form.discount) || undefined,
      taxRate: Number(form.taxRate),
      unitOfMeasure: form.unitOfMeasure || undefined,
      notes: form.notes || undefined,
    }
    if (editing.value) {
      await updateSaleLine(props.saleId, editing.value, data)
      toast.success('Line updated')
    } else {
      await createSaleLine(props.saleId, data)
      toast.success('Line added')
    }
    resetForm()
    emit('refresh')
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    saving.value = false
  }
}

async function removeLine(lineId: string) {
  deleting.value = lineId
  try {
    await deleteSaleLine(props.saleId, lineId)
    toast.success('Line deleted')
    emit('refresh')
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <div>
    <!-- Lines table -->
    <div class="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table class="w-full text-sm min-w-[640px]">
        <thead>
          <tr class="border-b border-(--ui-border) bg-(--ui-bg-muted) text-xs text-(--ui-text-muted) uppercase">
            <th class="px-3 py-2 text-left">#</th>
            <th class="px-3 py-2 text-left">Description</th>
            <th class="px-3 py-2 text-right">Qty</th>
            <th class="px-3 py-2 text-right">Price</th>
            <th class="px-3 py-2 text-right">Disc.%</th>
            <th class="px-3 py-2 text-right">Net</th>
            <th class="px-3 py-2 text-right">VAT%</th>
            <th class="px-3 py-2 text-right">Total</th>
            <th v-if="!readonly" class="px-3 py-2 w-20" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="lines.length === 0">
            <td :colspan="readonly ? 8 : 9" class="px-3 py-8 text-center text-(--ui-text-dimmed)">
              No lines
            </td>
          </tr>
          <tr
            v-for="line in lines"
            :key="line.lineId"
            class="border-b border-(--ui-border-muted)"
          >
            <td class="px-3 py-2 text-(--ui-text-dimmed)">{{ line.lineNumber }}</td>
            <td class="px-3 py-2">
              <p class="font-medium text-(--ui-text)">{{ line.productDescription }}</p>
              <p v-if="line.productCode" class="text-xs text-(--ui-text-dimmed)">{{ line.productCode }}</p>
            </td>
            <td class="px-3 py-2 text-right">{{ line.quantity }} {{ line.unitOfMeasure }}</td>
            <td class="px-3 py-2 text-right">{{ formatCurrency(line.unitPrice) }}</td>
            <td class="px-3 py-2 text-right">{{ line.discount }}%</td>
            <td class="px-3 py-2 text-right">{{ formatCurrency(line.netAmount) }}</td>
            <td class="px-3 py-2 text-right">{{ line.taxRate }}%</td>
            <td class="px-3 py-2 text-right font-medium">{{ formatCurrency(line.totalAmount) }}</td>
            <td v-if="!readonly" class="px-3 py-2">
              <div class="flex gap-1">
                <UButton
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-pencil"
                  @click="editLine(line)"
                />
                <UButton
                  variant="ghost"
                  size="xs"
                  color="error"
                  :icon="deleting === line.lineId ? 'i-lucide-loader-circle' : 'i-lucide-trash-2'"
                  :disabled="deleting === line.lineId"
                  @click="removeLine(line.lineId)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit form -->
    <div v-if="!readonly" class="mt-4">
      <UButton v-if="!showForm" variant="outline" size="sm" icon="i-lucide-plus" @click="showForm = true">
        Add line
      </UButton>

      <div v-if="showForm" class="border border-(--ui-border) rounded-lg p-4 bg-(--ui-bg-muted) mt-2">
        <h4 class="text-sm font-semibold text-(--ui-text) mb-3">
          {{ editing ? 'Edit line' : 'New line' }}
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="sm:col-span-2">
            <UFormField label="Description" required>
              <UInput v-model="form.productDescription" placeholder="Product/service description" />
            </UFormField>
          </div>
          <UFormField label="Code">
            <UInput v-model="form.productCode" placeholder="COD001" />
          </UFormField>
          <UFormField label="Unit of measure">
            <USelect v-model="form.unitOfMeasure" :items="UNITS_OF_MEASURE" />
          </UFormField>
          <UFormField label="Quantity" required>
            <UInput v-model="form.quantity" type="number" />
          </UFormField>
          <UFormField label="Unit price" required>
            <FormCurrency v-model="form.unitPrice" />
          </UFormField>
          <UFormField label="Discount %">
            <UInput v-model="form.discount" type="number" placeholder="0" />
          </UFormField>
          <UFormField label="VAT rate" required>
            <USelect v-model="form.taxRate" :items="TAX_RATES" />
          </UFormField>
          <div class="sm:col-span-2 lg:col-span-4">
            <UFormField label="Notes">
              <UInput v-model="form.notes" placeholder="Line notes" />
            </UFormField>
          </div>
        </div>

        <!-- Preview -->
        <div class="mt-3 flex items-center gap-4 text-sm text-(--ui-text-muted)">
          <span>Net: <strong>{{ formatCurrency(preview.netAmount) }}</strong></span>
          <span>VAT: <strong>{{ formatCurrency(preview.taxAmount) }}</strong></span>
          <span>Total: <strong class="text-(--ui-text)">{{ formatCurrency(preview.totalAmount) }}</strong></span>
        </div>

        <div class="mt-4 flex gap-2">
          <UButton size="sm" :loading="saving" @click="save">
            {{ editing ? 'Update' : 'Add' }}
          </UButton>
          <UButton variant="ghost" size="sm" @click="resetForm">Cancel</UButton>
        </div>
      </div>
    </div>
  </div>
</template>
