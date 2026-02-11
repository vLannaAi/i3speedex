export const SALE_STATUSES = [
  { value: 'draft', label: 'Bozza' },
  { value: 'confirmed', label: 'Confermata' },
  { value: 'invoiced', label: 'Fatturata' },
  { value: 'paid', label: 'Pagata' },
  { value: 'cancelled', label: 'Annullata' },
] as const

export const PAYMENT_METHODS = [
  { value: 'bonifico', label: 'Bonifico Bancario' },
  { value: 'contanti', label: 'Contanti' },
  { value: 'assegno', label: 'Assegno' },
  { value: 'carta', label: 'Carta di Credito' },
  { value: 'riba', label: 'Ri.Ba.' },
  { value: 'altro', label: 'Altro' },
] as const

export const PAYMENT_TERMS = [
  { value: 'immediato', label: 'Immediato' },
  { value: '30gg', label: '30 giorni' },
  { value: '60gg', label: '60 giorni' },
  { value: '90gg', label: '90 giorni' },
  { value: '30-60gg', label: '30/60 giorni' },
  { value: '30-60-90gg', label: '30/60/90 giorni' },
] as const

export const TAX_RATES = [
  { value: 22, label: '22% (Ordinaria)' },
  { value: 10, label: '10% (Ridotta)' },
  { value: 5, label: '5% (Super ridotta)' },
  { value: 4, label: '4% (Minima)' },
  { value: 0, label: '0% (Esente)' },
] as const

export const UNITS_OF_MEASURE = [
  { value: 'pz', label: 'Pezzi (pz)' },
  { value: 'kg', label: 'Chilogrammi (kg)' },
  { value: 'lt', label: 'Litri (lt)' },
  { value: 'm', label: 'Metri (m)' },
  { value: 'mq', label: 'Metri quadri (mq)' },
  { value: 'mc', label: 'Metri cubi (mc)' },
  { value: 'ore', label: 'Ore' },
  { value: 'gg', label: 'Giorni' },
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
  { value: 'IT', label: 'Italia' },
  { value: 'DE', label: 'Germania' },
  { value: 'FR', label: 'Francia' },
  { value: 'AT', label: 'Austria' },
  { value: 'CH', label: 'Svizzera' },
  { value: 'SI', label: 'Slovenia' },
  { value: 'GB', label: 'Regno Unito' },
  { value: 'ES', label: 'Spagna' },
  { value: 'NL', label: 'Paesi Bassi' },
  { value: 'BE', label: 'Belgio' },
] as const

export const INVOICE_LANGUAGES = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
] as const
