/** Centralized AI model IDs — change once here, updates everywhere. */

export const MODELS = {
  /** Claude Sonnet — general-purpose, used for most generation tasks */
  sonnet: 'claude-3-5-sonnet-20241022',
  /** Claude Haiku — fast and cheap, used for analysis and simple generation */
  haiku: 'claude-haiku-4-5-20251001',
  /** OpenAI GPT-4o Mini — used for multi-provider AI scans */
  openai: 'gpt-4o-mini',
} as const
