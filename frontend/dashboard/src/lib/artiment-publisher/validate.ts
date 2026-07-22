import { validateValue } from '@groupher/rich-editor/node'

import { ArtimentPublisherError } from './error'

export const ARTIMENT_MAX_INPUT_BYTES = 2 * 1024 * 1024
export const ARTIMENT_MAX_NODE_COUNT = 20_000
export const ARTIMENT_MAX_VALUE_DEPTH = 64

type TPendingValue = {
  depth: number
  value: unknown
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const assertStructureLimits = (value: unknown): void => {
  const pending: TPendingValue[] = [{ depth: 0, value }]
  const seen = new WeakSet<object>()
  let nodeCount = 0

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || !isObject(current.value)) continue

    if (current.depth > ARTIMENT_MAX_VALUE_DEPTH) {
      throw new ArtimentPublisherError(
        'value_too_deep',
        `Editor value exceeds the maximum depth of ${ARTIMENT_MAX_VALUE_DEPTH}.`,
      )
    }

    if (seen.has(current.value)) {
      throw new ArtimentPublisherError('invalid_json', 'Editor value must be JSON-serializable.')
    }
    seen.add(current.value)

    if (!Array.isArray(current.value) && ('text' in current.value || 'type' in current.value)) {
      nodeCount += 1
      if (nodeCount > ARTIMENT_MAX_NODE_COUNT) {
        throw new ArtimentPublisherError(
          'too_many_nodes',
          `Editor value exceeds the maximum node count of ${ARTIMENT_MAX_NODE_COUNT}.`,
        )
      }
    }

    const children = Array.isArray(current.value) ? current.value : Object.values(current.value)

    for (const child of children) {
      if (isObject(child)) {
        pending.push({ depth: current.depth + 1, value: child })
      }
    }
  }
}

const assertEncodedSize = (value: unknown): void => {
  let encoded: string | undefined

  try {
    encoded = JSON.stringify(value)
  } catch {
    throw new ArtimentPublisherError('invalid_json', 'Editor value must be JSON-serializable.')
  }

  if (encoded === undefined) {
    throw new ArtimentPublisherError('invalid_json', 'Editor value must be JSON-serializable.')
  }

  if (Buffer.byteLength(encoded, 'utf8') > ARTIMENT_MAX_INPUT_BYTES) {
    throw new ArtimentPublisherError(
      'payload_too_large',
      `Editor value exceeds the maximum size of ${ARTIMENT_MAX_INPUT_BYTES} bytes.`,
      { status: 413 },
    )
  }
}

/** Enforces shared byte, depth, node-count, and rich-editor schema limits. */
export const assertValidArtimentValue = (value: unknown): void => {
  assertStructureLimits(value)
  assertEncodedSize(value)

  const validation = validateValue(value)
  if (!validation.valid) {
    throw new ArtimentPublisherError('invalid_value', 'Editor value is invalid.', {
      diagnostics: validation.diagnostics,
    })
  }
}
