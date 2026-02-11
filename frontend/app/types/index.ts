// Frontend types — mirrors backend, without DynamoDB keys (PK/SK/GSI*)

export interface Sale {
  saleId: string
  saleNumber: number
  saleDate: string

  buyerId: string
  buyerName: string
  buyerVatNumber?: string
  buyerFiscalCode?: string
  buyerAddress?: string
  buyerCity?: string
  buyerProvince?: string
  buyerPostalCode?: string
  buyerCountry: string

  producerId: string
  producerName: string
  producerVatNumber?: string
  producerFiscalCode?: string
  producerAddress?: string
  producerCity?: string
  producerProvince?: string
  producerPostalCode?: string
  producerCountry: string

  subtotal: number
  taxAmount: number
  total: number

  paymentMethod?: string
  paymentTerms?: string
  deliveryMethod?: string
  deliveryDate?: string

  notes?: string
  internalNotes?: string
  referenceNumber?: string

  status: SaleStatus
  invoiceGenerated: boolean
  invoiceGeneratedAt?: string
  invoiceNumber?: string

  linesCount: number
  currency: string

  createdAt: string
  updatedAt: string
  deletedAt?: string
  createdBy: string
  updatedBy: string
}

export type SaleStatus = 'draft' | 'confirmed' | 'invoiced' | 'paid' | 'cancelled'

export interface SaleLine {
  saleId: string
  lineId: string
  lineNumber: number

  productCode?: string
  productDescription: string

  quantity: number
  unitPrice: number
  discount: number
  discountAmount: number
  netAmount: number

  taxRate: number
  taxAmount: number
  totalAmount: number

  unitOfMeasure?: string
  notes?: string

  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

export interface Buyer {
  buyerId: string
  companyName: string
  vatNumber?: string
  fiscalCode?: string

  address: string
  city: string
  province?: string
  postalCode: string
  country: string

  email?: string
  phone?: string
  pec?: string
  sdi?: string

  defaultPaymentMethod?: string
  defaultPaymentTerms?: string
  notes?: string

  status: 'active' | 'inactive'
  totalSales?: number
  totalRevenue?: number
  lastSaleDate?: string

  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

export interface Producer {
  producerId: string
  companyName: string
  vatNumber?: string
  fiscalCode?: string

  address: string
  city: string
  province?: string
  postalCode: string
  country: string

  email?: string
  phone?: string
  website?: string
  notes?: string

  status: 'active' | 'inactive'
  totalSales?: number
  lastSaleDate?: string

  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

export interface Attachment {
  attachmentId: string
  saleId: string
  fileName: string
  fileType: string
  fileSize: number
  s3Key: string
  description?: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

export interface UserContext {
  username: string
  email?: string
  groups: string[]
  operatorId?: string
  role?: string
}

// Request types
export interface CreateSaleRequest {
  saleDate: string
  buyerId: string
  producerId: string
  paymentMethod?: string
  paymentTerms?: string
  deliveryMethod?: string
  deliveryDate?: string
  notes?: string
  internalNotes?: string
  referenceNumber?: string
  currency?: string
}

export interface UpdateSaleRequest {
  saleDate?: string
  buyerId?: string
  producerId?: string
  paymentMethod?: string
  paymentTerms?: string
  deliveryMethod?: string
  deliveryDate?: string
  notes?: string
  internalNotes?: string
  referenceNumber?: string
  status?: SaleStatus
}

export interface CreateSaleLineRequest {
  productCode?: string
  productDescription: string
  quantity: number
  unitPrice: number
  discount?: number
  taxRate: number
  unitOfMeasure?: string
  notes?: string
}

export interface UpdateSaleLineRequest {
  productCode?: string
  productDescription?: string
  quantity?: number
  unitPrice?: number
  discount?: number
  taxRate?: number
  unitOfMeasure?: string
  notes?: string
}

export interface CreateBuyerRequest {
  companyName: string
  vatNumber?: string
  fiscalCode?: string
  address: string
  city: string
  province?: string
  postalCode: string
  country: string
  email?: string
  phone?: string
  pec?: string
  sdi?: string
  defaultPaymentMethod?: string
  defaultPaymentTerms?: string
  notes?: string
}

export interface UpdateBuyerRequest {
  companyName?: string
  vatNumber?: string
  fiscalCode?: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  email?: string
  phone?: string
  pec?: string
  sdi?: string
  defaultPaymentMethod?: string
  defaultPaymentTerms?: string
  notes?: string
  status?: 'active' | 'inactive'
}

export interface CreateProducerRequest {
  companyName: string
  vatNumber?: string
  fiscalCode?: string
  address: string
  city: string
  province?: string
  postalCode: string
  country: string
  email?: string
  phone?: string
  website?: string
  notes?: string
}

export interface UpdateProducerRequest {
  companyName?: string
  vatNumber?: string
  fiscalCode?: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  email?: string
  phone?: string
  website?: string
  notes?: string
  status?: 'active' | 'inactive'
}

export interface InvoiceGenerationRequest {
  language?: 'it' | 'en' | 'de' | 'fr'
  format?: 'html' | 'pdf' | 'sdi'
}

export interface InvoiceGenerationResponse {
  success: boolean
  saleId: string
  format: 'html' | 'pdf' | 'sdi'
  s3Bucket: string
  s3Key: string
  downloadUrl?: string
  expiresIn?: number
}
