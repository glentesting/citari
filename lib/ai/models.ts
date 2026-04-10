/**
 * Centralized AI model IDs — change once here, updates everywhere.
 * NOTE: This API key only has access to Haiku. When Sonnet access
 * is available, update the 'smart' model to a Sonnet model ID.
 */
export const MODELS = {
  /** Primary model for complex generation (intel briefs, competitor analysis, content) */
  smart: 'claude-haiku-4-5-20251001',
  /** Fast model for simple extraction and classification */
  fast: 'claude-haiku-4-5-20251001',
  /** Legacy aliases — point to smart/fast */
  sonnet: 'claude-haiku-4-5-20251001',
  haiku: 'claude-haiku-4-5-20251001',
  /** OpenAI GPT-4o Mini — used for multi-provider AI scans */
  openai: 'gpt-4o-mini',
} as const
