import { fetchWithTimeout } from '@/lib/utils'

/**
 * Meta Ad Library API
 * Requires META_AD_LIBRARY_TOKEN from developers.facebook.com
 * Fetches active ads for a given page or search term.
 */

export interface MetaAd {
  ad_text: string
  ad_url: string
  first_seen: string
  last_seen: string
  page_name: string
}

export async function fetchMetaAds(searchTerm: string): Promise<MetaAd[]> {
  const token = process.env.META_AD_LIBRARY_TOKEN
  if (!token) return []

  try {
    const params = new URLSearchParams({
      access_token: token,
      search_terms: searchTerm,
      ad_type: 'ALL',
      ad_reached_countries: "['US']",
      ad_active_status: 'ACTIVE',
      fields: 'ad_creative_bodies,ad_delivery_start_time,ad_delivery_stop_time,page_name,ad_snapshot_url',
      limit: '20',
    })

    const res = await fetchWithTimeout(
      `https://graph.facebook.com/v18.0/ads_archive?${params.toString()}`,
      { timeoutMs: 15000 }
    )

    if (!res.ok) return []

    const data = await res.json()

    if (!data.data) return []

    return data.data.map((ad: any) => ({
      ad_text: ad.ad_creative_bodies?.[0] || '',
      ad_url: ad.ad_snapshot_url || '',
      first_seen: ad.ad_delivery_start_time?.split('T')[0] || '',
      last_seen: ad.ad_delivery_stop_time?.split('T')[0] || new Date().toISOString().split('T')[0],
      page_name: ad.page_name || searchTerm,
    }))
  } catch (e) {
    console.error('Failed to fetch Meta ads:', e)
    return []
  }
}
