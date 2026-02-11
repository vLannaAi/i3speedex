<script setup lang="ts">
import type { Sale } from '~/types'
import { INVOICE_LANGUAGES } from '~/utils/constants'

const props = defineProps<{
  sale: Sale
}>()

const { generatePdf, generateSdi, downloadInvoice } = useInvoices()
const toast = useToast()

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
    toast.success('PDF generato con successo')
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
    toast.success('XML SDI generato con successo')
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
    <div v-if="!canGenerate" class="text-sm text-gray-500">
      La vendita deve essere confermata prima di generare fatture.
    </div>

    <template v-else>
      <div class="flex items-center gap-3">
        <FormField label="Lingua">
          <FormSelect v-model="language" :options="INVOICE_LANGUAGES" />
        </FormField>
      </div>

      <div class="flex gap-2 flex-wrap">
        <button
          class="btn-primary btn-sm"
          :disabled="generating"
          @click="handleGeneratePdf"
        >
          <div :class="generating ? 'i-mdi-loading animate-spin' : 'i-mdi-file-pdf-box'" />
          Genera PDF
        </button>
        <button
          class="btn-secondary btn-sm"
          :disabled="generating"
          @click="handleGenerateSdi"
        >
          <div :class="generating ? 'i-mdi-loading animate-spin' : 'i-mdi-file-xml-box'" />
          Genera XML SDI
        </button>
        <button
          v-if="sale.invoiceGenerated"
          class="btn-ghost btn-sm"
          :disabled="downloading"
          @click="handleDownload"
        >
          <div :class="downloading ? 'i-mdi-loading animate-spin' : 'i-mdi-download'" />
          Scarica
        </button>
      </div>

      <div v-if="sale.invoiceGenerated" class="text-xs text-gray-400">
        Fattura generata il {{ sale.invoiceGeneratedAt }}
        <span v-if="sale.invoiceNumber"> — N. {{ sale.invoiceNumber }}</span>
      </div>
    </template>
  </div>
</template>
