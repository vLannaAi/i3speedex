<script setup lang="ts">
import type { Sale } from '~/types'
import { INVOICE_LANGUAGES } from '~/utils/constants'

const props = defineProps<{
  sale: Sale
}>()

const { generatePdf, generateSdi, downloadInvoice } = useInvoices()
const toast = useAppToast()

const language = ref('it')
const generating = ref(false)
const downloading = ref(false)

const canGenerate = computed(() =>
  ['confirmed', 'invoiced', 'paid'].includes(props.sale.status)
)

async function handleGeneratePdf() {
  generating.value = true
  try {
    await generatePdf(props.sale.saleId, language.value)
    toast.success('PDF generated successfully')
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    generating.value = false
  }
}

async function handleGenerateSdi() {
  generating.value = true
  try {
    await generateSdi(props.sale.saleId)
    toast.success('SDI XML generated successfully')
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    generating.value = false
  }
}

async function handleDownload() {
  downloading.value = true
  try {
    const res = await downloadInvoice(props.sale.saleId)
    if (res.success && res.data?.downloadUrl) {
      window.open(res.data.downloadUrl, '_blank')
    }
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="!canGenerate" class="text-sm text-(--ui-text-muted)">
      The sale must be confirmed before generating invoices.
    </div>

    <template v-else>
      <div class="flex items-center gap-3">
        <UFormField label="Language">
          <USelect v-model="language" :items="INVOICE_LANGUAGES" />
        </UFormField>
      </div>

      <div class="flex gap-2 flex-wrap">
        <UButton
          size="sm"
          icon="i-lucide-file-text"
          :loading="generating"
          @click="handleGeneratePdf"
        >
          Generate PDF
        </UButton>
        <UButton
          variant="outline"
          size="sm"
          icon="i-lucide-file-code"
          :loading="generating"
          @click="handleGenerateSdi"
        >
          Generate SDI XML
        </UButton>
        <UButton
          v-if="sale.invoiceGenerated"
          variant="ghost"
          size="sm"
          icon="i-lucide-download"
          :loading="downloading"
          @click="handleDownload"
        >
          Download
        </UButton>
      </div>

      <div v-if="sale.invoiceGenerated" class="text-xs text-(--ui-text-dimmed)">
        Invoice generated on {{ sale.invoiceGeneratedAt }}
        <span v-if="sale.invoiceNumber"> — No. {{ sale.invoiceNumber }}</span>
      </div>
    </template>
  </div>
</template>
