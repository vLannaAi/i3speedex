export const SALE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

export const PAYMENT_METHODS = [
  { value: 'bonifico', label: 'Bank Transfer' },
  { value: 'contanti', label: 'Cash' },
  { value: 'assegno', label: 'Check' },
  { value: 'carta', label: 'Credit Card' },
  { value: 'riba', label: 'Ri.Ba.' },
  { value: 'altro', label: 'Other' },
] as const

export const PAYMENT_TERMS = [
  { value: 'immediato', label: 'Immediate' },
  { value: '30gg', label: '30 days' },
  { value: '60gg', label: '60 days' },
  { value: '90gg', label: '90 days' },
  { value: '30-60gg', label: '30/60 days' },
  { value: '30-60-90gg', label: '30/60/90 days' },
] as const

export const TAX_RATES = [
  { value: 22, label: '22% (Standard)' },
  { value: 10, label: '10% (Reduced)' },
  { value: 5, label: '5% (Super reduced)' },
  { value: 4, label: '4% (Minimum)' },
  { value: 0, label: '0% (Exempt)' },
] as const

export const UNITS_OF_MEASURE = [
  { value: 'pz', label: 'Pieces (pz)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'lt', label: 'Liters (lt)' },
  { value: 'm', label: 'Meters (m)' },
  { value: 'mq', label: 'Square meters (mq)' },
  { value: 'mc', label: 'Cubic meters (mc)' },
  { value: 'ore', label: 'Hours' },
  { value: 'gg', label: 'Days' },
] as const

export const ITALIAN_PROVINCES = [
  'AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO',
  'BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ',
  'EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE',
  'LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU',
  'OG','OR','OT','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV',
  'PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS',
  'SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE',
  'VI','VR','VS','VT','VV',
] as const

export const COUNTRIES = [
  { value: 'IT', label: 'Italy' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'AT', label: 'Austria' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'SI', label: 'Slovenia' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'ES', label: 'Spain' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
] as const

export const INVOICE_LANGUAGES = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Fran\u00e7ais' },
] as const
