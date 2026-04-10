import { fetchWithTimeout } from '@/lib/utils'

interface HubSpotConnection {
  access_token: string
}

export async function createHubSpotBlogPost(
  connection: HubSpotConnection,
  post: { title: string; content: string; slug: string; metaDescription: string }
): Promise<{ post_id: string; url: string }> {
  const res = await fetchWithTimeout('https://api.hubapi.com/cms/v3/blogs/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: post.title,
      postBody: post.content,
      slug: post.slug,
      metaDescription: post.metaDescription,
      state: 'DRAFT',
    }),
    timeoutMs: 15000,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HubSpot API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return {
    post_id: String(data.id),
    url: data.url || `https://app.hubspot.com/blog/${data.id}`,
  }
}

export async function getHubSpotBlogs(
  connection: HubSpotConnection
): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetchWithTimeout('https://api.hubapi.com/cms/v3/blogs/posts?limit=1', {
      headers: { Authorization: `Bearer ${connection.access_token}` },
      timeoutMs: 10000,
    })
    if (!res.ok) return []
    return [{ id: 'default', name: 'Blog' }]
  } catch (e) {
    console.error('Failed to fetch HubSpot blogs:', e)
    return []
  }
}

export async function testHubSpotConnection(accessToken: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout('https://api.hubapi.com/oauth/v1/access-tokens/' + accessToken, {
      timeoutMs: 10000,
    })
    return res.ok
  } catch (e) {
    console.error('HubSpot connection test failed:', e)
    return false
  }
}
