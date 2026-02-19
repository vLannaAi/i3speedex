import { COUNTRIES, ITALIAN_PROVINCES, PAYMENT_METHODS, PAYMENT_TERMS, SECTORS, VAT_EXEMPT_OPTIONS, CURRENCIES, INVOICE_LANGUAGES, QUANTITY_OPTIONS } from './constants'

const ISO3_TO_ISO2: Record<string, string> = {
  ITA: 'IT', DEU: 'DE', FRA: 'FR', AUT: 'AT', CHE: 'CH',
  SVN: 'SI', GBR: 'GB', ESP: 'ES', NLD: 'NL', BEL: 'BE',
  POL: 'PL', CZE: 'CZ', HRV: 'HR', ROU: 'RO', PRT: 'PT',
  SWE: 'SE', DNK: 'DK', GRC: 'GR', HUN: 'HU', IRL: 'IE',
  SVK: 'SK', BGR: 'BG', USA: 'US', CAN: 'CA', TUR: 'TR',
  DZA: 'DZ', EGY: 'EG', MAR: 'MA', TUN: 'TN', LBY: 'LY',
  SAU: 'SA', ARE: 'AE', QAT: 'QA', KWT: 'KW', CHN: 'CN',
  IND: 'IN', RUS: 'RU', BRA: 'BR', MEX: 'MX',
}

export function getCountryDisplay(code: string) {
  const normalized = ISO3_TO_ISO2[code] || code
  const country = COUNTRIES.find(c => c.value === normalized)
  if (!country) return { flag: '', label: code, code, eu: false }
  return { flag: country.flag, label: country.label, code: country.value, eu: country.eu }
}

export function getProvinceDisplay(code: string) {
  const province = ITALIAN_PROVINCES.find(p => p.value === code)
  if (!province) return { label: code, code }
  return { label: province.label, code: province.value }
}

export function getPaymentMethodLabel(value: string): string {
  return PAYMENT_METHODS.find(m => m.value === value)?.label || value || '\u2014'
}

export function getPaymentTermsLabel(value: string): string {
  return PAYMENT_TERMS.find(t => t.value === value)?.label || value || '\u2014'
}

export function getSectorLabel(value: string): string {
  return SECTORS.find(s => s.value === value)?.label || value || '\u2014'
}

export function getVatExemptLabel(value: string): string {
  return VAT_EXEMPT_OPTIONS.find(v => v.value === value)?.label || value || '\u2014'
}

export function getCurrencyLabel(value: string): string {
  return CURRENCIES.find(c => c.value === value)?.label || value || '\u2014'
}

export function getLanguageLabel(value: string): string {
  return INVOICE_LANGUAGES.find(l => l.value === value)?.label || value || '\u2014'
}

export function getQuantityLabel(value: string): string {
  return QUANTITY_OPTIONS.find(q => q.value === value)?.label || value || '\u2014'
}
