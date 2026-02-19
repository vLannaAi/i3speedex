/**
 * Common types for i2speedex Sale Module API
 */

// ========================================
// Base Types
// ========================================

export interface TimestampFields {
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  deletedAt?: string; // ISO 8601 timestamp (soft delete)
}

export interface UserFields {
  createdBy: string; // Cognito username
  updatedBy: string; // Cognito username
}

// ========================================
// Sale Types
// ========================================

export interface Sale extends TimestampFields, UserFields {
  PK: string; // SALE#{saleId}
  SK: string; // METADATA
  saleId: string; // Unique identifier
  saleNumber: number; // Sequential number
  regNumber?: string; // Registration number (e.g., "5/2026")
  docType?: string; // Document type: "proforma" | "invoice"
  saleDate: string; // ISO 8601 date

  // Buyer information
  buyerId: string;
  buyerName: string;
  buyerVatNumber?: string;
  buyerFiscalCode?: string;
  buyerAddress?: string;
  buyerCity?: string;
  buyerProvince?: string;
  buyerPostalCode?: string;
  buyerCountry: string;

  // Producer information
  producerId: string;
  producerName: string;
  producerVatNumber?: string;
  producerFiscalCode?: string;
  producerAddress?: string;
  producerCity?: string;
  producerProvince?: string;
  producerPostalCode?: string;
  producerCountry: string;

  // Totals
  subtotal: number; // Sum of all line amounts before tax
  taxAmount: number; // Total tax amount
  total: number; // Final total (subtotal + taxAmount)

  // Payment and delivery
  paymentMethod?: string;
  paymentTerms?: string;
  deliveryMethod?: string;
  deliveryDate?: string; // ISO 8601 date

  // Notes and references
  notes?: string;
  internalNotes?: string;
  referenceNumber?: string;

  // Purchase order
  poNumber?: string; // Purchase Order number
  poDate?: string; // Purchase Order date (ISO 8601)

  // Printed note & packaging
  printedNote?: string; // Note printed on invoice
  package?: string; // Packaging information

  // Delivery notes
  deliveryNote?: string; // Delivery terms/instructions (free text)
  dnNumber?: string; // Delivery Note number
  dnDate?: string; // Delivery Note date (ISO 8601)
  dnNumber2?: string; // Second DN number
  dnDate2?: string; // Second DN date (ISO 8601)
  dnNumber3?: string; // Third DN number
  dnDate3?: string; // Third DN date (ISO 8601)

  // Public Administration
  paCupNumber?: string; // PA CUP code
  paCigNumber?: string; // PA CIG code

  // Payment details
  paymentDate?: string; // Payment date (ISO 8601)
  paymentNote?: string; // Payment notes
  bank?: string; // Bank reference for bank transfer

  // Cash Order (C/O) properties
  coBankDescription?: string; // C/O bank description
  coBankIban?: string; // C/O bank IBAN

  // VAT & invoice options
  ivaPercentage?: number; // Default VAT percentage
  vatOff?: string; // VAT exemption option
  attachInvoice?: boolean; // Attach invoice to SDI XML

  // PDF generation
  pdfFontBase?: number; // PDF font base size

  // Numbering
  numberT?: number; // Sequential number within period (e.g., T5)
  year?: number; // Sale year
  registrationDate?: string; // Document registration date (ISO 8601)

  // Status
  status: 'proforma' | 'sent' | 'paid' | 'cancelled';

  // Invoice generation
  invoiceGenerated: boolean;
  invoiceGeneratedAt?: string; // ISO 8601 timestamp
  invoiceNumber?: string;

  // Metadata
  linesCount: number; // Number of sale lines
  currency: string; // ISO 4217 currency code (e.g., EUR)
}

export interface SaleLine extends TimestampFields, UserFields {
  PK: string; // SALE#{saleId}
  SK: string; // LINE#{lineId}
  saleId: string;
  lineId: string; // Unique line identifier
  lineNumber: number; // Line sequence number (1, 2, 3...)

  // Product information
  productCode?: string;
  productDescription: string;

  // Quantity and pricing
  quantity: number;
  unitPrice: number;
  discount: number; // Percentage (0-100)
  discountAmount: number; // Calculated discount amount
  netAmount: number; // quantity * unitPrice - discountAmount

  // Tax
  taxRate: number; // Percentage (e.g., 22 for 22% VAT)
  taxAmount: number; // Calculated tax amount
  totalAmount: number; // netAmount + taxAmount

  // Units
  unitOfMeasure?: string; // e.g., "pz", "kg", "m"

  // Notes
  notes?: string;
}

// ========================================
// Buyer Types
// ========================================

export interface Buyer extends TimestampFields, UserFields {
  PK: string; // BUYER#{buyerId}
  SK: string; // METADATA
  buyerId: string;
  code?: string;

  // Company information
  companyName: string;
  industrialGroup?: string;
  sector?: string;
  vatNumber?: string;
  fiscalCode?: string;
  vatExempt?: string; // 'standard' | 'split_payment' | 'exempt'
  currency?: string; // ISO 4217 currency code
  preferredLanguage?: string; // 'it' | 'en' | 'de' | 'fr'

  // Address
  subName?: string; // Address sub-name / c/o
  address: string;
  poBox?: string;
  city: string;
  province?: string;
  postalCode: string;
  country: string;

  // Contact information
  mainContact?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  pec?: string; // Italian certified email
  sdi?: string; // Italian SDI code (7-digit)

  // Payment preferences
  defaultPaymentMethod?: string;
  defaultPaymentTerms?: string;
  defaultOperator?: string;
  bankDetails?: string;

  // Notes
  notes?: string;

  // Status
  status: 'active' | 'inactive';

  // Statistics (denormalized for performance)
  totalSales?: number;
  totalRevenue?: number;
  lastSaleDate?: string; // ISO 8601 date
}

// ========================================
// Producer Types
// ========================================

export interface Producer extends TimestampFields, UserFields {
  PK: string; // PRODUCER#{producerId}
  SK: string; // METADATA
  producerId: string;
  code?: string;

  // Company information
  companyName: string;
  vatNumber?: string;
  fiscalCode?: string;
  sdi?: string; // Italian SDI code (7-digit)
  pec?: string; // Italian certified email
  preferredLanguage?: string; // 'it' | 'en' | 'de' | 'fr'

  // Address
  subName?: string; // Address sub-name / c/o
  address: string;
  poBox?: string;
  city: string;
  province?: string;
  postalCode: string;
  country: string;

  // Contact information
  mainContact?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  defaultOperator?: string;

  // Business terms
  revenuePercentage?: number; // Commission/revenue percentage
  bankDetails?: string;

  // Production information
  qualityAssurance?: string; // Multi-line: ISO certs, etc.
  productionArea?: string; // Multi-line: capabilities
  markets?: string; // Multi-line: target markets
  materials?: string; // Multi-line: materials worked
  products?: string; // Product descriptions
  standardProducts?: string;
  diameterRange?: string;
  maxLength?: string;
  quantity?: string; // 'any' | 'small' | 'medium' | 'large'

  // Notes
  notes?: string;

  // Status
  status: 'active' | 'inactive';

  // Statistics (denormalized for performance)
  totalSales?: number;
  lastSaleDate?: string; // ISO 8601 date
}

// ========================================
// Attachment Types
// ========================================

export interface Attachment extends TimestampFields, UserFields {
  PK: string; // SALE#{saleId} or BUYER#{buyerId}
  SK: string; // ATTACHMENT#{attachmentId}
  attachmentId: string;
  saleId: string;

  // File information
  fileName: string;
  fileType: string;
  fileSize: number; // bytes

  // S3 information
  s3Key: string;

  // Optional description
  description?: string;
}

// ========================================
// API Response Types
// ========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
    nextToken?: string;
  };
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  requestId: string;
}

// ========================================
// Request Types
// ========================================

export interface CreateSaleRequest {
  saleDate: string;
  buyerId: string;
  producerId: string;
  paymentMethod?: string;
  paymentTerms?: string;
  deliveryMethod?: string;
  deliveryDate?: string;
  notes?: string;
  internalNotes?: string;
  referenceNumber?: string;
  currency?: string;
  poNumber?: string;
  poDate?: string;
  printedNote?: string;
  package?: string;
  deliveryNote?: string;
  dnNumber?: string;
  dnDate?: string;
  dnNumber2?: string;
  dnDate2?: string;
  dnNumber3?: string;
  dnDate3?: string;
  paCupNumber?: string;
  paCigNumber?: string;
  paymentDate?: string;
  paymentNote?: string;
  bank?: string;
  coBankDescription?: string;
  coBankIban?: string;
  ivaPercentage?: number;
  vatOff?: string;
  attachInvoice?: boolean;
  pdfFontBase?: number;
  numberT?: number;
  year?: number;
  registrationDate?: string;
}

export interface UpdateSaleRequest {
  saleDate?: string;
  buyerId?: string;
  producerId?: string;
  paymentMethod?: string;
  paymentTerms?: string;
  deliveryMethod?: string;
  deliveryDate?: string;
  notes?: string;
  internalNotes?: string;
  referenceNumber?: string;
  status?: 'draft' | 'confirmed' | 'invoiced' | 'paid' | 'cancelled';
  poNumber?: string;
  poDate?: string;
  printedNote?: string;
  package?: string;
  deliveryNote?: string;
  dnNumber?: string;
  dnDate?: string;
  dnNumber2?: string;
  dnDate2?: string;
  dnNumber3?: string;
  dnDate3?: string;
  paCupNumber?: string;
  paCigNumber?: string;
  paymentDate?: string;
  paymentNote?: string;
  bank?: string;
  coBankDescription?: string;
  coBankIban?: string;
  ivaPercentage?: number;
  vatOff?: string;
  attachInvoice?: boolean;
  pdfFontBase?: number;
  numberT?: number;
  year?: number;
  registrationDate?: string;
}

export interface CreateSaleLineRequest {
  productCode?: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate: number;
  unitOfMeasure?: string;
  notes?: string;
}

export interface UpdateSaleLineRequest {
  productCode?: string;
  productDescription?: string;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  taxRate?: number;
  unitOfMeasure?: string;
  notes?: string;
}

export interface CreateBuyerRequest {
  code?: string;
  companyName: string;
  industrialGroup?: string;
  sector?: string;
  vatNumber?: string;
  fiscalCode?: string;
  vatExempt?: string;
  currency?: string;
  preferredLanguage?: string;
  subName?: string;
  address: string;
  poBox?: string;
  city: string;
  province?: string;
  postalCode: string;
  country: string;
  mainContact?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  pec?: string;
  sdi?: string;
  defaultPaymentMethod?: string;
  defaultPaymentTerms?: string;
  defaultOperator?: string;
  bankDetails?: string;
  notes?: string;
}

export interface UpdateBuyerRequest {
  code?: string;
  companyName?: string;
  industrialGroup?: string;
  sector?: string;
  vatNumber?: string;
  fiscalCode?: string;
  vatExempt?: string;
  currency?: string;
  preferredLanguage?: string;
  subName?: string;
  address?: string;
  poBox?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  mainContact?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  pec?: string;
  sdi?: string;
  defaultPaymentMethod?: string;
  defaultPaymentTerms?: string;
  defaultOperator?: string;
  bankDetails?: string;
  notes?: string;
  status?: 'active' | 'inactive';
}

export interface CreateProducerRequest {
  code?: string;
  companyName: string;
  vatNumber?: string;
  fiscalCode?: string;
  sdi?: string;
  pec?: string;
  preferredLanguage?: string;
  subName?: string;
  address: string;
  poBox?: string;
  city: string;
  province?: string;
  postalCode: string;
  country: string;
  mainContact?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  defaultOperator?: string;
  revenuePercentage?: number;
  bankDetails?: string;
  qualityAssurance?: string;
  productionArea?: string;
  markets?: string;
  materials?: string;
  products?: string;
  standardProducts?: string;
  diameterRange?: string;
  maxLength?: string;
  quantity?: string;
  notes?: string;
}

export interface UpdateProducerRequest {
  code?: string;
  companyName?: string;
  vatNumber?: string;
  fiscalCode?: string;
  sdi?: string;
  pec?: string;
  preferredLanguage?: string;
  subName?: string;
  address?: string;
  poBox?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  mainContact?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  defaultOperator?: string;
  revenuePercentage?: number;
  bankDetails?: string;
  qualityAssurance?: string;
  productionArea?: string;
  markets?: string;
  materials?: string;
  products?: string;
  standardProducts?: string;
  diameterRange?: string;
  maxLength?: string;
  quantity?: string;
  notes?: string;
  status?: 'active' | 'inactive';
}

// ========================================
// Invoice Generation Types
// ========================================

export interface InvoiceGenerationRequest {
  language?: 'it' | 'en' | 'de' | 'fr';
  format?: 'html' | 'pdf' | 'sdi';
}

export interface InvoiceGenerationResponse {
  success: boolean;
  saleId: string;
  format: 'html' | 'pdf' | 'sdi';
  s3Bucket: string;
  s3Key: string;
  downloadUrl?: string; // Pre-signed URL
  expiresIn?: number; // Seconds
}

// ========================================
// User Context (from Cognito JWT)
// ========================================

export interface UserContext {
  username: string;
  email?: string;
  groups: string[];
  operatorId?: string;
  role?: string;
}

// ========================================
// Lambda Event Context
// ========================================

export interface LambdaContext {
  requestId: string;
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  getRemainingTimeInMillis(): number;
}
