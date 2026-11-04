import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contract = JSON.parse(readFileSync(path.join(root, 'review-ai.contract.json'), 'utf8'))
const request = contract.definitions.request.properties
const response = contract.definitions.response.properties
const literals = (values) => values.map((value) => `'${value}'`).join(' | ')
const statuses = literals(response.status.enum)
const modalities = literals(request.requiredModalities.items.enum)
const coverages = literals(response.coverage.properties.text.enum)
const noteTypes = literals(response.susNotes.items.properties.type.enum)
const arrayLiteral = (values) => {
  const inline = `[${values.map((value) => `'${value}'`).join(', ')}]`
  return inline.length <= 55
    ? inline
    : `[\n${values.map((value) => `  '${value}',`).join('\n')}\n]`
}
const objectLiteral = (values) =>
  `{
${values.map((value) => `  ${value}: '${value}',`).join('\n')}
} as const`

const output = `/** Generated from review-ai.contract.json by scripts/generate-review-ai-contract.mjs. */
export type ReviewAIStatus = ${statuses}
export type ReviewAIModality = ${modalities}
export type ReviewAICoverage = ${coverages}
export type ReviewAINoteType = ${noteTypes}

export const REVIEW_AI_STATUSES = ${arrayLiteral(response.status.enum)} as const
export const REVIEW_AI_MODALITIES = ${arrayLiteral(request.requiredModalities.items.enum)} as const
export const REVIEW_AI_COVERAGES = ${arrayLiteral(response.coverage.properties.text.enum)} as const
export const REVIEW_AI_NOTE_TYPES = ${arrayLiteral(response.susNotes.items.properties.type.enum)} as const
export const REVIEW_AI_STATUS = ${objectLiteral(response.status.enum)}
export const REVIEW_AI_MODALITY = ${objectLiteral(request.requiredModalities.items.enum)}
export const REVIEW_AI_COVERAGE = ${objectLiteral(response.coverage.properties.text.enum)}
export const REVIEW_AI_NOTE_TYPE = ${objectLiteral(response.susNotes.items.properties.type.enum)}

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
`

const outputPath = path.join(root, 'src/review-ai.generated.ts')
if (process.argv.includes('--check')) {
  if (readFileSync(outputPath, 'utf8') !== output) {
    console.error('Stale src/review-ai.generated.ts; run pnpm --filter @groupher/contracts generate:review-ai.')
    process.exit(1)
  }
  console.log('Review AI contract types are up to date.')
} else {
  writeFileSync(outputPath, output)
  console.log('Wrote src/review-ai.generated.ts.')
}
