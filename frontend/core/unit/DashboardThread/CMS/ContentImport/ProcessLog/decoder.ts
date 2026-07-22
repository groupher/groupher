/** Tolerant UI decoder for the shared import process projection.
 *
 * @see docs/bulk-import/import-process-log.md
 */
import type {
  TImportProcess,
  TImportProcessItem,
  TImportProcessStage,
  TImportProcessState,
  TImportProcessUnit,
} from './spec'

const PROCESS_STATES = new Set<TImportProcessState>(['queued', 'running', 'completed', 'failed'])
const PROCESS_STAGES = new Set<TImportProcessStage>([
  'analyzing',
  'building_preview',
  'preparing',
  'applying',
])
const PROCESS_UNITS = new Set<TImportProcessUnit>([
  'document',
  'release',
  'discussion',
  'post',
  'comment',
])
const ITEM_STATES = new Set<TImportProcessItem['state']>(['completed', 'failed', 'skipped'])

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const enumValue = <T extends string>(value: unknown, values: Set<T>, fallback: T): T => {
  const normalized = typeof value === 'string' ? value.toLowerCase() : ''
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
          unit: enumValue(progressInput.unit, PROCESS_UNITS, 'document'),
        }
      : undefined,
    recentBatch: recentBatch.slice(0, 5).map((item) => {
      const recent = record(item)
      return {
        label: typeof recent.label === 'string' ? recent.label : '',
        ref: typeof recent.ref === 'string' ? recent.ref : '',
        state: enumValue(recent.state, ITEM_STATES, 'completed'),
      }
    }),
    stage: enumValue(input.stage, PROCESS_STAGES, 'analyzing'),
    state: enumValue(input.state, PROCESS_STATES, 'running'),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date(0).toISOString(),
  }
}
