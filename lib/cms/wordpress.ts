interface CMSConnection {
  site_url: string
  access_token: string // base64 encoded "username:application_password"
}

/**
 * Convert basic markdown to HTML for WordPress.
 */
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^(?!<[hulo])(.*)\n/gm, '<p>$1</p>\n')
    .replace(/\n{2,}/g, '\n')
}

function getAuthHeader(connection: CMSConnection): string {
  return `Basic ${connection.access_token}`
}

function getApiBase(connection: CMSConnection): string {
  const base = connection.site_url.replace(/\/$/, '')
  return `${base}/wp-json/wp/v2`
}

export async function testWordPressConnection(connection: CMSConnection): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase(connection)}/users/me`, {
      headers: { Authorization: getAuthHeader(connection) },
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function createWordPressDraft(
  connection: CMSConnection,
  content: { title: string; content: string; status: 'draft' | 'publish' }
): Promise<{ post_id: string; post_url: string }> {
  const html = markdownToHtml(content.content)

  const res = await fetch(`${getApiBase(connection)}/posts`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(connection),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: content.title,
      content: html,
      status: content.status,
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WordPress API error: ${res.status} ${err}`)
  }

  const post = await res.json()
  return {
    post_id: String(post.id),
    post_url: post.link || `${connection.site_url}/?p=${post.id}`,
  }
}

export async function updateWordPressPost(
  connection: CMSConnection,
  postId: string,
  content: { title?: string; content?: string }
): Promise<void> {
  const body: any = {}
  if (content.title) body.title = content.title
  if (content.content) body.content = markdownToHtml(content.content)

  const res = await fetch(`${getApiBase(connection)}/posts/${postId}`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(connection),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`WordPress update failed: ${res.status}`)
}

export async function getWordPressCategories(
  connection: CMSConnection
): Promise<{ id: number; name: string }[]> {
  try {
    const res = await fetch(`${getApiBase(connection)}/categories?per_page=50`, {
      headers: { Authorization: getAuthHeader(connection) },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.map((c: any) => ({ id: c.id, name: c.name }))
  } catch {
    return []
  }
}

export async function getWordPressTags(
  connection: CMSConnection
): Promise<{ id: number; name: string }[]> {
  try {
    const res = await fetch(`${getApiBase(connection)}/tags?per_page=50`, {
      headers: { Authorization: getAuthHeader(connection) },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.map((t: any) => ({ id: t.id, name: t.name }))
  } catch {
    return []
  }
}
