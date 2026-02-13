import type { Buyer } from '~/types'

export type TokenDomain = 'docType' | 'status' | 'year' | 'buyer' | 'amount' | 'freeText'

export interface ParsedToken {
  raw: string
  domain: TokenDomain
  value: string | string[] | { min?: number; max?: number } | { from: string; to: string }
  display: string
  negated: boolean
}

export interface ActiveFilters {
  docTypes: string[]
  statuses: string[]
  years: string[]
  yearRange?: { from: string; to: string }
  buyerIds: string[]
  amountMin?: number
  amountMax?: number
  freeText: string[]
  sortKey?: string
  sortDir?: 'asc' | 'desc'
}

const DOC_TYPE_KEYWORDS: Record<string, string> = {
  pro: 'proforma',
  inv: 'invoice',
}

const STATUS_KEYWORDS = new Set(['proforma', 'sent', 'paid', 'cancelled'])

const RELATIVE_DATE_KEYWORDS = new Set(['today', 'week', 'month'])
const QUARTER_RE = /^Q([1-4])(?:\/(\d{4}))?$/i
const HALF_RE = /^H([12])(?:\/(\d{4}))?$/i

function isPlausibleYear(n: number): boolean {
  return n >= 1900 && n <= 2099
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('it-IT', { useGrouping: true, maximumFractionDigits: 0 }).format(n)
}

/** Strip cosmetic formatting to recover raw editable form */
function stripFormatting(display: string): string {
  let s = display
  // Remove euro sign and grouping separators (Italian uses . for thousands)
  s = s.replace(/€\s?/g, '')
  s = s.replace(/\./g, '')
  // Replace en-dash with hyphen
  s = s.replace(/–/g, '-')
  // Replace minus sign (−) with trailing -
  s = s.replace(/−$/, '-')
  // Remove trailing +
  s = s.replace(/\+$/, '')
  return s.trim()
}

export function useSearchQuery(
  rawInput: Ref<string>,
  buyers: Ref<Buyer[]>,
) {
  // Build lookup maps from buyers
  const buyerCodeToId = computed(() => {
    const map = new Map<string, string>()
    for (const b of buyers.value) {
      if (b.code) map.set(b.code.toUpperCase(), b.buyerId)
    }
    return map
  })

  const buyerIdToCode = computed(() => {
    const map = new Map<string, string>()
    for (const b of buyers.value) {
      if (b.code) map.set(b.buyerId, b.code.toUpperCase())
    }
    return map
  })

  // Parse a single token
  function classifyToken(raw: string): ParsedToken {
    const negated = raw.startsWith('-') && raw.length > 1
    const clean = negated ? raw.slice(1) : raw
    const lower = clean.toLowerCase()

    // 1. Doc type keywords (PRO, INV)
    if (DOC_TYPE_KEYWORDS[lower]) {
      return {
        raw,
        domain: 'docType',
        value: DOC_TYPE_KEYWORDS[lower],
        display: clean.toUpperCase(),
        negated,
      }
    }

    // 2. Status keywords (sent, paid, cancelled, proforma)
    if (STATUS_KEYWORDS.has(lower)) {
      return {
        raw,
        domain: 'status',
        value: lower,
        display: lower,
        negated,
      }
    }

    // 3. Known buyer code
    const buyerId = buyerCodeToId.value.get(clean.toUpperCase())
    if (buyerId) {
      return {
        raw,
        domain: 'buyer',
        value: buyerId,
        display: clean.toUpperCase(),
        negated,
      }
    }

    // 4. Euro-prefixed amount (€5000, €5000+, €5000-)
    const euroMatch = clean.match(/^€([\d.,]+)([+-]?)$/)
    if (euroMatch) {
      const num = parseFloat(euroMatch[1]!.replace(/\./g, '').replace(',', '.'))
      if (!isNaN(num)) {
        const suffix = euroMatch[2]!
        if (suffix === '-') {
          return { raw, domain: 'amount', value: { max: num }, display: `€${formatAmount(num)}−`, negated }
        }
        // Default: >= (+ or no suffix)
        return { raw, domain: 'amount', value: { min: num }, display: `€${formatAmount(num)}+`, negated }
      }
    }

    // 5. Explicit amount with + suffix (e.g. 2025+ forces amount, not year)
    const amountPlusMatch = clean.match(/^(\d+)\+$/)
    if (amountPlusMatch) {
      const num = parseInt(amountPlusMatch[1]!, 10)
      return { raw, domain: 'amount', value: { min: num }, display: `€${formatAmount(num)}+`, negated }
    }

    // 6. Relative date keywords
    if (RELATIVE_DATE_KEYWORDS.has(lower)) {
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      if (lower === 'today') {
        const d = `${yyyy}-${mm}-${dd}`
        return { raw, domain: 'year', value: [d], display: lower, negated }
      }
      if (lower === 'week') {
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        const from = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`
        const to = `${yyyy}-${mm}-${dd}`
        return { raw, domain: 'year', value: { from, to } as any, display: lower, negated }
      }
      if (lower === 'month') {
        const from = `${yyyy}-${mm}-01`
        const to = `${yyyy}-${mm}-${dd}`
        return { raw, domain: 'year', value: { from, to } as any, display: lower, negated }
      }
    }

    // 7. Quarter keywords (Q1, Q2/2025)
    const qMatch = lower.match(QUARTER_RE)
    if (qMatch) {
      const q = parseInt(qMatch[1]!, 10)
      const year = qMatch[2] ? parseInt(qMatch[2]!, 10) : new Date().getFullYear()
      const startMonth = (q - 1) * 3 + 1
      const endMonth = startMonth + 2
      const from = `${year}-${String(startMonth).padStart(2, '0')}-01`
      const lastDay = new Date(year, endMonth, 0).getDate()
      const to = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      return { raw, domain: 'year', value: { from, to } as any, display: clean.toUpperCase(), negated }
    }

    // 8. Half keywords (H1, H2/2025)
    const hMatch = lower.match(HALF_RE)
    if (hMatch) {
      const h = parseInt(hMatch[1]!, 10)
      const year = hMatch[2] ? parseInt(hMatch[2]!, 10) : new Date().getFullYear()
      const from = h === 1 ? `${year}-01-01` : `${year}-07-01`
      const to = h === 1 ? `${year}-06-30` : `${year}-12-31`
      return { raw, domain: 'year', value: { from, to } as any, display: clean.toUpperCase(), negated }
    }

    // 9. Sort tokens (sort:total, ↑total, ↓date)
    const sortMatch = clean.match(/^(?:sort:|([↑↓]))(\w+)$/i)
    if (sortMatch) {
      const dir = sortMatch[1] === '↓' ? 'desc' : 'asc'
      const key = sortMatch[2]!
      // Store as a special token — won't filter, just sets sort
      return { raw, domain: 'freeText', value: `sort:${key}:${dir}`, display: clean, negated: false }
    }

    // 10. 4-digit number → year (not amount)
    if (/^\d{4}$/.test(clean)) {
      const n = parseInt(clean, 10)
      if (isPlausibleYear(n)) {
        return { raw, domain: 'year', value: [clean], display: clean, negated }
      }
    }

    // 11. Range: digits-digits
    const rangeMatch = clean.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
      const a = parseInt(rangeMatch[1]!, 10)
      const b = parseInt(rangeMatch[2]!, 10)
      // Both 4-digit plausible years → year range
      if (rangeMatch[1]!.length === 4 && rangeMatch[2]!.length === 4 && isPlausibleYear(a) && isPlausibleYear(b)) {
        return {
          raw,
          domain: 'year',
          value: { from: `${a}`, to: `${b}` },
          display: `${a}–${b}`,
          negated,
        }
      }
      // Otherwise → amount range
      return {
        raw,
        domain: 'amount',
        value: { min: Math.min(a, b), max: Math.max(a, b) },
        display: `€${formatAmount(Math.min(a, b))}–${formatAmount(Math.max(a, b))}`,
        negated,
      }
    }

    // 12. Bare number 5+ digits → amount ≥
    if (/^\d{5,}$/.test(clean)) {
      const n = parseInt(clean, 10)
      return { raw, domain: 'amount', value: { min: n }, display: `€${formatAmount(n)}+`, negated }
    }

    // 13. Number with trailing - → amount ≤
    if (/^\d+-$/.test(clean)) {
      const n = parseInt(clean.slice(0, -1), 10)
      return { raw, domain: 'amount', value: { max: n }, display: `€${formatAmount(n)}−`, negated }
    }

    // 14. ID range (#100-200)
    const idRangeMatch = clean.match(/^#(\d+)(?:-(\d+))?(\+)?$/)
    if (idRangeMatch) {
      // Store as free text with special prefix for ID filtering
      const from = idRangeMatch[1]!
      const to = idRangeMatch[2] || (idRangeMatch[3] ? '999999' : from)
      return { raw, domain: 'freeText', value: `id:${from}-${to}`, display: clean, negated }
    }

    // 15. Producer filter (@code)
    if (clean.startsWith('@') && clean.length > 1) {
      return { raw, domain: 'freeText', value: `producer:${clean.slice(1)}`, display: clean, negated }
    }

    // Fallback: free text
    return { raw, domain: 'freeText', value: clean, display: clean, negated }
  }

  // Split input respecting comma-joined tokens
  function tokenize(input: string): string[] {
    if (!input.trim()) return []
    // Split on whitespace, but also handle comma-separated values within a "group"
    // e.g. "sent,paid" stays as one token, "sent paid" becomes two
    return input.trim().split(/\s+/).flatMap((part) => {
      // If it contains commas, split into individual tokens
      if (part.includes(',')) {
        return part.split(',').filter(Boolean)
      }
      return [part]
    })
  }

  // Core: parse all tokens from raw input
  const parsedTokens = computed<ParsedToken[]>(() => {
    const tokens = tokenize(rawInput.value)
    return tokens.map(t => classifyToken(t))
  })

  // Build structured filter from parsed tokens
  const activeFilters = computed<ActiveFilters>(() => {
    const filters: ActiveFilters = {
      docTypes: [],
      statuses: [],
      years: [],
      buyerIds: [],
      freeText: [],
    }

    for (const token of parsedTokens.value) {
      if (token.negated) continue // TODO: negation filtering later

      switch (token.domain) {
        case 'docType':
          filters.docTypes.push(token.value as string)
          break
        case 'status':
          filters.statuses.push(token.value as string)
          break
        case 'year': {
          const v = token.value
          if (Array.isArray(v)) {
            // Single year(s) or specific date(s)
            filters.years.push(...v)
          } else if (typeof v === 'object' && v !== null && 'from' in v && 'to' in v) {
            filters.yearRange = v as { from: string; to: string }
          }
          break
        }
        case 'buyer':
          filters.buyerIds.push(token.value as string)
          break
        case 'amount': {
          const v = token.value as { min?: number; max?: number }
          if (v.min !== undefined) filters.amountMin = v.min
          if (v.max !== undefined) filters.amountMax = v.max
          break
        }
        case 'freeText': {
          const v = token.value as string
          // Handle sort tokens
          if (v.startsWith('sort:')) {
            const parts = v.split(':')
            filters.sortKey = parts[1]
            filters.sortDir = parts[2] as 'asc' | 'desc'
          } else {
            filters.freeText.push(v)
          }
          break
        }
      }
    }

    return filters
  })

  // Build the display (formatted) version of the input
  const displayString = computed(() => {
    if (!rawInput.value.trim()) return ''

    // Group tokens by domain, coalesce same-domain with commas
    const groups = new Map<string, ParsedToken[]>()
    for (const t of parsedTokens.value) {
      const key = t.domain
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }

    const parts: string[] = []
    // Maintain original order by iterating parsedTokens and deduplicating domains
    const seen = new Set<string>()
    for (const t of parsedTokens.value) {
      if (seen.has(t.domain)) continue
      seen.add(t.domain)
      const group = groups.get(t.domain)!
      if (group.length === 1) {
        parts.push(group[0]!.display)
      } else {
        parts.push(group.map(g => g.display).join(','))
      }
    }

    return parts.join(' ')
  })

  // Toggle a token (for badge clicks)
  function toggleToken(domain: TokenDomain, value: string) {
    const tokens = tokenize(rawInput.value)
    const classified = tokens.map(t => classifyToken(t))

    // Find if this domain+value already exists
    const existingIdx = classified.findIndex((t) => {
      if (t.domain !== domain) return false
      if (domain === 'docType') return t.value === DOC_TYPE_KEYWORDS[value.toLowerCase()]
      if (domain === 'status') return t.value === value.toLowerCase()
      if (domain === 'buyer') return t.value === value
      if (domain === 'year') return Array.isArray(t.value) && t.value.includes(value)
      return false
    })

    if (existingIdx >= 0) {
      // Remove this token
      tokens.splice(existingIdx, 1)
    } else {
      // Add the token
      if (domain === 'docType') {
        // Use the keyword form (PRO/INV)
        const keyword = Object.entries(DOC_TYPE_KEYWORDS).find(([, v]) => v === value)?.[0]
        if (keyword) tokens.push(keyword.toUpperCase())
      } else if (domain === 'status') {
        tokens.push(value.toLowerCase())
      } else if (domain === 'buyer') {
        // Look up the buyer code from buyerId
        const code = buyerIdToCode.value.get(value)
        if (code) tokens.push(code)
      } else if (domain === 'year') {
        tokens.push(value)
      }
    }

    rawInput.value = tokens.join(' ')
  }

  // Check if a domain+value is active
  function isActive(domain: TokenDomain, value: string): boolean {
    const filters = activeFilters.value
    switch (domain) {
      case 'docType':
        return filters.docTypes.includes(value)
      case 'status':
        return filters.statuses.includes(value)
      case 'buyer':
        return filters.buyerIds.includes(value)
      case 'year':
        return filters.years.includes(value)
          || (!!filters.yearRange && value >= filters.yearRange.from && value <= filters.yearRange.to)
      default:
        return false
    }
  }

  // Check if any filter is active at all
  const hasActiveFilters = computed(() => {
    const f = activeFilters.value
    return f.docTypes.length > 0
      || f.statuses.length > 0
      || f.years.length > 0
      || !!f.yearRange
      || f.buyerIds.length > 0
      || f.amountMin !== undefined
      || f.amountMax !== undefined
      || f.freeText.length > 0
  })

  // Get the raw editable form (strip formatting) for when input gets focus
  function getRawForm(): string {
    const tokens = tokenize(rawInput.value)
    return tokens.map(t => stripFormatting(t) || t).join(' ')
  }

  // Apply display formatting (for blur)
  function applyDisplayFormat() {
    const formatted = displayString.value
    if (formatted && formatted !== rawInput.value) {
      rawInput.value = formatted
    }
  }

  return {
    parsedTokens,
    activeFilters,
    displayString,
    hasActiveFilters,
    toggleToken,
    isActive,
    getRawForm,
    applyDisplayFormat,
  }
}
