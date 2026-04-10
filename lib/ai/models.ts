/** Centralized AI model IDs — change once here, updates everywhere. */

export const MODELS = {
  /** Claude Haiku 4.5 — used for all generation tasks (fast + capable) */
  sonnet: 'claude-haiku-4-5-20251001',
  /** Claude Haiku 4.5 — used for analysis and simple generation */
  haiku: 'claude-haiku-4-5-20251001',
  /** OpenAI GPT-4o Mini — used for multi-provider AI scans */
  openai: 'gpt-4o-mini',
} as const
