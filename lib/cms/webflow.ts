interface WebflowConnection {
  access_token: string
  site_id: string
}

export async function getWebflowSites(accessToken: string): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetch('https://api.webflow.com/v2/sites', {
      headers: { Authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.sites || []).map((s: any) => ({ id: s.id, name: s.displayName || s.shortName }))
  } catch (e) {
    console.error('Failed to fetch Webflow sites:', e)
    return []
  }
}

export async function getWebflowCollections(
  accessToken: string,
  siteId: string
): Promise<{ id: string; name: string; slug: string }[]> {
  try {
    const res = await fetch(`https://api.webflow.com/v2/sites/${siteId}/collections`, {
      headers: { Authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.collections || []).map((c: any) => ({ id: c.id, name: c.displayName, slug: c.slug }))
  } catch (e) {
    console.error('Failed to fetch Webflow collections:', e)
    return []
  }
}

export async function createWebflowItem(
  accessToken: string,
  collectionId: string,
  item: { name: string; slug: string; postBody: string }
): Promise<{ item_id: string; slug: string }> {
  const res = await fetch(`https://api.webflow.com/v2/collections/${collectionId}/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      isArchived: false,
      isDraft: true,
      fieldData: {
        name: item.name,
        slug: item.slug,
        'post-body': item.postBody,
      },
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Webflow API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return { item_id: data.id, slug: data.fieldData?.slug || item.slug }
}

export async function testWebflowConnection(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.webflow.com/v2/token/introspect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch (e) {
    console.error('Webflow connection test failed:', e)
    return false
  }
}
