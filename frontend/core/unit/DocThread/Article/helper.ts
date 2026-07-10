import type { Value } from 'platejs'

export const EMPTY_DOC_VALUE: Value = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
]

const fallbackValue = (text?: string | null): Value => [
  {
    type: 'p',
    children: [{ text: text || 'No content' }],
  },
]

export const parseDocValue = (json?: string | null, fallback?: string | null): Value => {
  if (!json) return fallbackValue(fallback)

  try {
    const value = JSON.parse(json)
    return Array.isArray(value) ? (value as Value) : fallbackValue(fallback)
  } catch {
    return fallbackValue(fallback)
  }
}
