import { COUNTRIES, ITALIAN_PROVINCES, PAYMENT_METHODS, PAYMENT_TERMS } from './constants'

const ISO3_TO_ISO2: Record<string, string> = {
  ITA: 'IT', DEU: 'DE', FRA: 'FR', AUT: 'AT', CHE: 'CH',
  SVN: 'SI', GBR: 'GB', ESP: 'ES', NLD: 'NL', BEL: 'BE',
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
