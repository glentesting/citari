import { createHmac } from 'crypto'

/**
 * Ghost Admin API uses JWT tokens signed with the Admin API key.
 * Key format: "id:secret" — split and use HMAC-SHA256.
 */
function createGhostToken(adminKey: string): string {
  const [id, secret] = adminKey.split(':')
  if (!id || !secret) throw new Error('Invalid Ghost Admin API key format. Expected "id:secret".')

  const iat = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iat, exp: iat + 300, aud: '/admin/' })).toString('base64url')
  const signature = createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

export async function createGhostPost(
  siteUrl: string,
  adminKey: string,
  post: { title: string; html: string; status: 'draft' | 'published'; tags?: string[] }
): Promise<{ post_id: string; url: string }> {
  const token = createGhostToken(adminKey)
  const baseUrl = siteUrl.replace(/\/$/, '')

  const res = await fetch(`${baseUrl}/ghost/api/admin/posts/?source=html`, {
    method: 'POST',
    headers: {
      Authorization: `Ghost ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      posts: [{
        title: post.title,
        html: post.html,
        status: post.status,
        tags: post.tags?.map((t) => ({ name: t })) || [],
      }],
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ghost API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  const created = data.posts?.[0]
  return {
    post_id: created?.id || '',
    url: created?.url || `${baseUrl}/`,
  }
}

export async function testGhostConnection(siteUrl: string, adminKey: string): Promise<boolean> {
  try {
    const token = createGhostToken(adminKey)
    const baseUrl = siteUrl.replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/ghost/api/admin/site/`, {
      headers: { Authorization: `Ghost ${token}` },
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}
