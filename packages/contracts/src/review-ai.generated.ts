/** Generated from review-ai.contract.json by scripts/generate-review-ai-contract.mjs. */
export type ReviewAIStatus = 'clear' | 'suspect' | 'uncertain'
export type ReviewAIModality = 'text' | 'image'
export type ReviewAICoverage = 'complete' | 'unsupported' | 'failed'
export type ReviewAINoteType = 'spam' | 'harassment' | 'illegal_content' | 'impersonation' | 'other'

export const REVIEW_AI_STATUSES = ['clear', 'suspect', 'uncertain'] as const
export const REVIEW_AI_MODALITIES = ['text', 'image'] as const
export const REVIEW_AI_COVERAGES = ['complete', 'unsupported', 'failed'] as const
export const REVIEW_AI_NOTE_TYPES = [
  'spam',
  'harassment',
  'illegal_content',
  'impersonation',
  'other',
] as const
export const REVIEW_AI_STATUS = {
  clear: 'clear',
  suspect: 'suspect',
  uncertain: 'uncertain',
} as const
export const REVIEW_AI_MODALITY = {
  text: 'text',
  image: 'image',
} as const
export const REVIEW_AI_COVERAGE = {
  complete: 'complete',
  unsupported: 'unsupported',
  failed: 'failed',
} as const
export const REVIEW_AI_NOTE_TYPE = {
  spam: 'spam',
  harassment: 'harassment',
  illegal_content: 'illegal_content',
  impersonation: 'impersonation',
  other: 'other',
} as const

export type ReviewAINote = {
  type: ReviewAINoteType
  evidence: string
  explanation: string
}

export type ReviewAIRequest = {
  model: string
  systemPrompt: string
  prompt: string
  banWords: string[]
  text: { title: string; body: string }
  images: Array<{
    assetId?: string | null
    immutableVersion?: string | null
    signedReadUrl?: string | null
  }>
  requiredModalities: ReviewAIModality[]
}

export type ReviewAIResponse = {
  status: ReviewAIStatus
  susNotes: ReviewAINote[]
  coverage: Record<ReviewAIModality, ReviewAICoverage>
  summary: string
}
