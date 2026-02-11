export function isValidVatNumber(value: string): boolean {
  if (!value) return false
  const vatRegex = /^[A-Z]{2}[0-9]{8,12}$/
  return vatRegex.test(value.toUpperCase().replace(/\s/g, ''))
}

export function isValidFiscalCode(value: string): boolean {
  if (!value) return false
  const fiscalCodeRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/
  return fiscalCodeRegex.test(value.toUpperCase())
}

export function isValidSdiCode(value: string): boolean {
  if (!value) return false
  const sdiRegex = /^[A-Z0-9]{7}$/
  return sdiRegex.test(value.toUpperCase())
}

export function isValidEmail(value: string): boolean {
  if (!value) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

export function isValidPostalCode(value: string, country?: string): boolean {
  if (!value) return false
  if (country?.toUpperCase() === 'IT') return /^[0-9]{5}$/.test(value)
  if (country?.toUpperCase() === 'DE') return /^[0-9]{5}$/.test(value)
  if (country?.toUpperCase() === 'FR') return /^[0-9]{5}$/.test(value)
  return /^[A-Z0-9]{3,10}$/i.test(value.replace(/[\s-]/g, ''))
}

export function isValidPhone(value: string): boolean {
  if (!value) return false
  return /^[\d\s+()-]{6,20}$/.test(value)
}
