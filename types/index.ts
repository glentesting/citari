export interface Client {
  id: string
  workspace_id: string
  name: string
  domain: string | null
  industry: string | null
  notes: string | null
  avatar_url: string | null
  created_at: string
}

export interface Competitor {
  id: string
  client_id: string
  name: string
  domain: string | null
  created_at: string
}

export interface Prompt {
  id: string
  client_id: string
  text: string
  category: 'awareness' | 'evaluation' | 'purchase'
  is_active: boolean
  created_at: string
}

export interface ScanResult {
  id: string
  prompt_id: string
  client_id: string
  model: 'chatgpt' | 'claude' | 'gemini'
  mentioned: boolean
  mention_position: number | null
  sentiment: 'positive' | 'neutral' | 'negative'
  response_excerpt: string | null
  competitor_mentions: string[]
  scanned_at: string
}

export interface GeoContent {
  id: string
  client_id: string
  title: string
  content: string | null
  target_prompt: string | null
  content_type: 'article' | 'comparison' | 'faq' | 'landing'
  tone: string
  word_count_target: number
  status: 'draft' | 'published'
  published_url: string | null
  cited_by_gpt: boolean
  cited_by_claude: boolean
  cited_by_gemini: boolean
  citation_rate: number
  created_at: string
  published_at: string | null
}

export interface Keyword {
  id: string
  client_id: string
  keyword: string
  category: 'branded' | 'category' | 'competitor'
  monthly_volume: number | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  your_rank: number | null
  top_competitor_name: string | null
  top_competitor_rank: number | null
  ai_visible: 'yes' | 'partial' | 'no'
  trend: 'up' | 'down' | 'flat'
  opportunity: 'high' | 'medium' | 'low'
  last_updated: string
  created_at: string
}

export interface Report {
  id: string
  client_id: string
  workspace_id: string
  name: string
  report_type: 'full' | 'visibility' | 'competitor' | 'executive'
  date_range_start: string | null
  date_range_end: string | null
  sections: string[]
  accent_color: string
  pdf_url: string | null
  page_count: number | null
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface UserSettings {
  id: string
  user_id: string
  workspace_id: string | null
  active_client_id: string | null
  scan_frequency: string
  alert_on_drop: boolean
  weekly_digest: boolean
  timezone: string
  updated_at: string
}
