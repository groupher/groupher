/** Tolerant UI decoder for the shared import process projection.
 *
 * @see docs/import/import-process-log.md
 */
import type {
  TImportProcess,
  TImportProcessItem,
  TImportProcessStage,
  TImportProcessState,
  TImportProcessUnit,
} from './spec'

const PROCESS_STATES = new Set<TImportProcessState>(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'])
const PROCESS_STAGES = new Set<TImportProcessStage>([
  'ANALYZING',
  'BUILDING_PREVIEW',
  'PREPARING',
  'APPLYING',
])
const PROCESS_UNITS = new Set<TImportProcessUnit>([
  'DOCUMENT',
  'RELEASE',
  'DISCUSSION',
  'POST',
  'COMMENT',
])
const ITEM_STATES = new Set<TImportProcessItem['state']>(['COMPLETED', 'FAILED', 'SKIPPED'])

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const enumValue = <T extends string>(value: unknown, values: Set<T>, fallback: T): T => {
  const normalized = typeof value === 'string' ? value.toUpperCase() : ''
  return values.has(normalized as T) ? (normalized as T) : fallback
}

/** Normalizes unknown GraphQL/HTTP process values into bounded render-safe state. */
export const decodeImportProcess = (value: unknown): TImportProcess => {
  const input = record(value)
  const progressInput = input.progress ? record(input.progress) : null
  const recentBatch = Array.isArray(input.recentBatch) ? input.recentBatch : []

  return {
    progress: progressInput
      ? {
          completed: typeof progressInput.completed === 'number' ? progressInput.completed : 0,
          total: typeof progressInput.total === 'number' ? progressInput.total : undefined,
          unit: enumValue(progressInput.unit, PROCESS_UNITS, 'DOCUMENT'),
        }
      : undefined,
    recentBatch: recentBatch.slice(0, 5).map((item) => {
      const recent = record(item)
      return {
        label: typeof recent.label === 'string' ? recent.label : '',
        ref: typeof recent.ref === 'string' ? recent.ref : '',
        state: enumValue(recent.state, ITEM_STATES, 'COMPLETED'),
      }
    }),
    stage: enumValue(input.stage, PROCESS_STAGES, 'ANALYZING'),
    state: enumValue(input.state, PROCESS_STATES, 'RUNNING'),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date(0).toISOString(),
  }
}
