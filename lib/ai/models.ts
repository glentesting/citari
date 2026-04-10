/** Centralized AI model IDs — change once here, updates everywhere. */
export const MODELS = {
  /** Claude Sonnet 4.6 — primary model for complex generation */
  sonnet: 'claude-sonnet-4-6',
  /** Claude Haiku 4.5 — fast model for simple extraction */
  haiku: 'claude-haiku-4-5-20251001',
  /** OpenAI GPT-4o Mini — used for multi-provider AI scans */
  openai: 'gpt-4o-mini',
} as const
