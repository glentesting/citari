// Shared helpers
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

/**
 * Safe fetch + JSON parse. Returns parsed data or throws with a readable error.
 */
export async function safeFetchJson(url: string, options: RequestInit): Promise<any> {
  const res = await fetch(url, options)
  const text = await res.text()
  if (!text) throw new Error('Server returned empty response — it may have timed out. Try again.')
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid response from server. Try again.')
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}
