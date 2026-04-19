export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: isFormData
      ? { ...(init?.headers ?? {}) }
      : {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
  })

  const data = (await response.json()) as T & { error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed.')
  }

  return data
}

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}

export function isLikelyPdfUrl(url: string): boolean {
  try {
    const pathname = new URL(url.trim()).pathname.toLowerCase()
    return pathname.endsWith('.pdf')
  } catch {
    return /\.pdf(?:\?|[#]|$)/i.test(url.trim())
  }
}

export function reportSourcePdfDownloadUrl(reportId: string): string {
  return `${API_BASE}/api/reports/source-pdf?id=${encodeURIComponent(reportId)}`
}
