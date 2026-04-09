interface ShopifyConnection {
  site_url: string // e.g. "mystore.myshopify.com"
  access_token: string
}

export async function getShopifyBlogs(
  connection: ShopifyConnection
): Promise<{ id: number; title: string }[]> {
  try {
    const res = await fetch(`https://${connection.site_url}/admin/api/2024-01/blogs.json`, {
      headers: { 'X-Shopify-Access-Token': connection.access_token },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.blogs || []).map((b: any) => ({ id: b.id, title: b.title }))
  } catch {
    return []
  }
}

export async function createShopifyArticle(
  connection: ShopifyConnection,
  blogId: number,
  article: { title: string; body_html: string; author: string; tags: string }
): Promise<{ article_id: string; url: string }> {
  const res = await fetch(`https://${connection.site_url}/admin/api/2024-01/blogs/${blogId}/articles.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': connection.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      article: {
        title: article.title,
        body_html: article.body_html,
        author: article.author,
        tags: article.tags,
        published: false,
      },
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Shopify API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  const created = data.article
  return {
    article_id: String(created?.id || ''),
    url: `https://${connection.site_url}/blogs/${blogId}/${created?.handle || ''}`,
  }
}

export async function testShopifyConnection(siteUrl: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${siteUrl}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}
