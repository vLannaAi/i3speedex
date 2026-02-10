/**
 * Type definitions for Template Renderer Lambda
 */

export type Language = 'it' | 'en' | 'de' | 'fr';

export interface Sale {
  id: number;
  number: number;
  year: number;
  status: 'new' | 'to verify' | 'proforma' | 'ready' | 'sent' | 'paid' | 'deleted';
  reg_date: string; // YYYYMMDD format
  reg_date_input?: string; // ISO date format
  full_id?: string;

  // Financial data
  currency: string;
  amount: number;
  eur_amount: number;
  vat_perc: number;
  vat: number;
  tax: number;
  total: number;
  to_pay: number;
  pay_load: number;
  eur_pay_load?: number;

  // References
  buyer_ref?: string;
  reference?: string;
  po_number?: string;
  po_date?: string; // YYYYMMDD

  // Delivery notes
  dn_number?: string;
  dn_date?: string; // YYYYMMDD
  dn_number2?: string;
  dn_date2?: string;
  dn_number3?: string;
  dn_date3?: string;

  // Payment
  payment?: string; // Payment method code (MP05, MP12, etc.)
  bank_id?: string;
  payment_bank?: string;
  payment_bank_iban?: string;
  payment_date?: string; // YYYYMMDD
  payment_note?: string;

  // Notes
  sale_note?: string;
  note?: string;

  // VAT
  vat_off?: string;
  vat_on?: number;
  tax_on?: number;

  // PA fields
  cup_contract_id?: string;
  cig_contract_id?: string;

  // Additional
  package?: string;
  delivery?: string;
  stamp?: number; // 0 or 1
  font_base?: number; // Base font size (default 12)

  // Contact override (from sale)
  email?: string;
  tel?: string;
  fax?: string;
}

export interface Buyer {
  id: number;
  code: string;
  name: string;
  sub_name?: string;
  country: string;
  prov?: string;
  address?: string;
  zip?: string;
  city?: string;
  box?: string;
  vat?: string;
  taxid?: string;
  vatoff?: string; // VAT exemption code or 'split' for split payment
  sdi_code?: string;
  tel?: string;
  fax?: string;
  email?: string;
  pec?: string;
  lang: Language;
  currency: string;
}

export interface Producer {
  id: number;
  code: string;
  name: string;
  sub_name?: string;
  address?: string;
  city?: string;
  prov?: string;
  zip?: string;
  country: string;
  vat?: string;
  tel?: string;
  fax?: string;
  email?: string;
}

export interface SaleLine {
  id: number;
  sale_id: number;
  pos: number;
  code?: string;
  description: string;
  qty: number;
  price: number;
  discount?: number; // Percentage (0-100)
  vat: number; // Percentage (0-100)
  vat_off?: string;
  vat_off_desc?: string;

  // Additional specs
  shipping?: string;
  lfz?: string;
  standard?: string;
  strength?: string;
  drive?: string;
  length?: string;
  finish?: string;
  sorting?: string;
  certificate?: string;
}

export interface Bank {
  id: string;
  name: string;
  branch_address?: string;
  iban: string;
  swift?: string;
}

export interface Country {
  code: string;
  name: string;
  it_name?: string;
}

export interface TemplateData {
  sale: Sale;
  buyer: Buyer;
  producer?: Producer;
  sale_lines: SaleLine[];
  banks?: Bank[];
  countries?: Country[];
}

export interface TemplateRendererRequest {
  template: 'invoice'; // Template name (extensible for future templates)
  language?: Language; // If not provided, use buyer.lang
  data: TemplateData;
  outputFormat?: 'html' | 'text'; // Default: html
}

export interface TemplateRendererResponse {
  success: boolean;
  html?: string;
  text?: string;
  language: Language;
  generationTime: number; // milliseconds
  error?: string;
  details?: string;
}

export interface LambdaContext {
  requestId: string;
  functionName: string;
  memoryLimitInMB: string;
  logGroupName: string;
  logStreamName: string;
}

export interface LineCalculations {
  cost: number; // After discount
  vat_amount: number;
  total: number; // With VAT
}
