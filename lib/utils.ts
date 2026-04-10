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
 * Build a rich context string from client data for AI prompts.
 * Combines all available fields into a single descriptive block.
 */
export function buildClientContext(client: {
  name: string
  industry?: string | null
  specialization?: string | null
  location?: string | null
  description?: string | null
  target_clients?: string | null
  differentiators?: string | null
}): string {
  return [
    client.name,
    client.industry,
    client.specialization,
    client.location ? `Location: ${client.location}` : null,
    client.description,
    client.target_clients ? `Target clients: ${client.target_clients}` : null,
    client.differentiators ? `Differentiators: ${client.differentiators}` : null,
  ].filter(Boolean).join(' | ')
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
  } catch (e) {
    console.error('Failed to parse JSON response:', e)
    throw new Error('Invalid response from server. Try again.')
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}
