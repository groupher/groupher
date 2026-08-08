export const ARTIMENT_DIGEST_LENGTH = 150

type TJsonPrimitive = boolean | null | number | string
type TJsonValue = TJsonPrimitive | TJsonValue[] | { [key: string]: TJsonValue }

const sortJsonValue = (value: unknown): TJsonValue => {
  if (value === null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value
  if (typeof value === 'string') return value

  if (Array.isArray(value)) {
    return value.map(sortJsonValue)
  }

  const record = value as Record<string, unknown>
  const sorted: Record<string, TJsonValue> = {}

  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortJsonValue(record[key])
  }

  return sorted
}

/** Serializes Plate JSON with stable object-key ordering while retaining editor node identities. */
export const serializePlateJson = (value: unknown): string => JSON.stringify(sortJsonValue(value))

/** Truncates plain text to the shared grapheme-safe Article digest limit. */
export const createDigest = (plainText: string): string => {
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(plainText)

  return Array.from(segments, ({ segment }) => segment)
    .slice(0, ARTIMENT_DIGEST_LENGTH)
    .join('')
}
