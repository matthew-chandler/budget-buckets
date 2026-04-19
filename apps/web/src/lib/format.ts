import type { CSSProperties } from 'react'

export function formatCurrency(amount: number | null, compact = false): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 2 : 0,
  }).format(amount)
}

export function formatPercent(value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatNumber(value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }

  return new Intl.NumberFormat('en-US').format(value)
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function perCapita(total: number | null, population: number | null): number | null {
  if (!total || !population) return null
  return total / population
}

/**
 * Helper for setting CSS custom properties inline without the usual
 * `as React.CSSProperties` cast. Use like: `style={cssVars({ bucketColor: '#...' })}`.
 */
export function cssVars(vars: Record<string, string>): CSSProperties {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(vars)) {
    const cssName = key.startsWith('--')
      ? key
      : '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase()
    out[cssName] = value
  }
  return out as CSSProperties
}
