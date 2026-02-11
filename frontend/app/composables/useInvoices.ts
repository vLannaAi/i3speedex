import type { InvoiceGenerationResponse } from '~/types'

export function useInvoices() {
  const { post, get } = useApi()

  async function generateHtml(saleId: string, language: string = 'it') {
    return post<InvoiceGenerationResponse>(`/api/sales/${saleId}/invoice/html`, { language })
  }

  async function generatePdf(saleId: string, language: string = 'it') {
    return post<InvoiceGenerationResponse>(`/api/sales/${saleId}/invoice/pdf`, { language })
  }

  async function generateSdi(saleId: string) {
    return post<InvoiceGenerationResponse>(`/api/sales/${saleId}/invoice/sdi`)
  }

  async function downloadInvoice(saleId: string) {
    return get<{ downloadUrl: string }>(`/api/sales/${saleId}/invoice/download`)
  }

  return { generateHtml, generatePdf, generateSdi, downloadInvoice }
}
