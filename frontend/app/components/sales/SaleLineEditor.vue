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
const toast = useToast()

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
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50/50 text-xs text-gray-500 uppercase">
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
            <td :colspan="readonly ? 8 : 9" class="px-3 py-8 text-center text-gray-400">
              No lines
            </td>
          </tr>
          <tr
            v-for="line in lines"
            :key="line.lineId"
            class="border-b border-gray-50"
          >
            <td class="px-3 py-2 text-gray-400">{{ line.lineNumber }}</td>
            <td class="px-3 py-2">
              <p class="font-medium text-gray-900">{{ line.productDescription }}</p>
              <p v-if="line.productCode" class="text-xs text-gray-400">{{ line.productCode }}</p>
            </td>
            <td class="px-3 py-2 text-right">{{ line.quantity }} {{ line.unitOfMeasure }}</td>
            <td class="px-3 py-2 text-right">{{ formatCurrency(line.unitPrice) }}</td>
            <td class="px-3 py-2 text-right">{{ line.discount }}%</td>
            <td class="px-3 py-2 text-right">{{ formatCurrency(line.netAmount) }}</td>
            <td class="px-3 py-2 text-right">{{ line.taxRate }}%</td>
            <td class="px-3 py-2 text-right font-medium">{{ formatCurrency(line.totalAmount) }}</td>
            <td v-if="!readonly" class="px-3 py-2">
              <div class="flex gap-1">
                <button class="btn-ghost btn-sm p-1" @click="editLine(line)">
                  <i class="fa-solid fa-pen text-sm" />
                </button>
                <button
                  class="btn-ghost btn-sm p-1 text-danger-600"
                  :disabled="deleting === line.lineId"
                  @click="removeLine(line.lineId)"
                >
                  <i :class="deleting === line.lineId ? 'fa-solid fa-spinner fa-spin' : 'fa-regular fa-trash-can'" class="text-sm" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit form -->
    <div v-if="!readonly" class="mt-4">
      <button v-if="!showForm" class="btn-secondary btn-sm" @click="showForm = true">
        <i class="fa-solid fa-plus" /> Add line
      </button>

      <div v-if="showForm" class="border border-gray-200 rounded-lg p-4 bg-gray-50 mt-2">
        <h4 class="text-sm font-semibold text-gray-900 mb-3">
          {{ editing ? 'Edit line' : 'New line' }}
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="sm:col-span-2">
            <FormField label="Description" required>
              <FormInput v-model="form.productDescription" placeholder="Product/service description" />
            </FormField>
          </div>
          <FormField label="Code">
            <FormInput v-model="form.productCode" placeholder="COD001" />
          </FormField>
          <FormField label="Unit of measure">
            <FormSelect v-model="form.unitOfMeasure" :options="UNITS_OF_MEASURE" />
          </FormField>
          <FormField label="Quantity" required>
            <FormInput v-model="form.quantity" type="number" />
          </FormField>
          <FormField label="Unit price" required>
            <FormCurrency v-model="form.unitPrice" />
          </FormField>
          <FormField label="Discount %">
            <FormInput v-model="form.discount" type="number" placeholder="0" />
          </FormField>
          <FormField label="VAT rate" required>
            <FormSelect v-model="form.taxRate" :options="TAX_RATES" />
          </FormField>
          <div class="sm:col-span-2 lg:col-span-4">
            <FormField label="Notes">
              <FormInput v-model="form.notes" placeholder="Line notes" />
            </FormField>
          </div>
        </div>

        <!-- Preview -->
        <div class="mt-3 flex items-center gap-4 text-sm text-gray-600">
          <span>Net: <strong>{{ formatCurrency(preview.netAmount) }}</strong></span>
          <span>VAT: <strong>{{ formatCurrency(preview.taxAmount) }}</strong></span>
          <span>Total: <strong class="text-gray-900">{{ formatCurrency(preview.totalAmount) }}</strong></span>
        </div>

        <div class="mt-4 flex gap-2">
          <button class="btn-primary btn-sm" :disabled="saving" @click="save">
            <i v-if="saving" class="fa-solid fa-spinner fa-spin" />
            {{ editing ? 'Update' : 'Add' }}
          </button>
          <button class="btn-ghost btn-sm" @click="resetForm">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>
