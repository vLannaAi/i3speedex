export function useFormatters() {
  function formatDate(iso: string | undefined | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function formatDateTime(iso: string | undefined | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function formatCurrency(value: number | string | undefined | null): string {
    if (value === undefined || value === null) return '—'
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return '—'
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: true }).format(num)
  }

  function formatNumber(value: number | string | undefined | null, decimals = 2): string {
    if (value === undefined || value === null) return '—'
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return '—'
    return new Intl.NumberFormat('it-IT', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    }).format(num)
  }

  function formatPercent(value: number | undefined | null): string {
    if (value === undefined || value === null) return '—'
    return new Intl.NumberFormat('it-IT', { style: 'percent', minimumFractionDigits: 1 }).format(value / 100)
  }

  function toISODate(ddmmyyyy: string): string {
    const parts = ddmmyyyy.split('/')
    if (parts.length !== 3) return ddmmyyyy
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return { formatDate, formatDateTime, formatCurrency, formatNumber, formatPercent, toISODate, formatFileSize }
}
