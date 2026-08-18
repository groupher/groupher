/**
 * Primitive decoders for untrusted PreviewStore and GraphQL JSON contracts.
 *
 *   untrusted JSON -> primitive decoder -> typed contract or ContractError
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
/** Identifies the exact contract path that rejected an untrusted value. */
export class ContractError extends Error {
  /** Creates a decoder failure qualified by its contract path. */
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`)
    this.name = 'ContractError'
  }
}

/** Decodes a non-null, non-array object. */
export const record = (value: unknown, path: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractError(path, 'expected an object')
  }

  return value as Record<string, unknown>
}

/** Decodes an array before item-specific limits are applied. */
export const array = (value: unknown, path: string): unknown[] => {
  if (!Array.isArray(value)) throw new ContractError(path, 'expected an array')
  return value
}

/** Decodes a bounded non-empty string. */
export const string = (value: unknown, path: string, maxLength = 2_048): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ContractError(path, 'expected a non-empty string')
  }
  if (value.length > maxLength) throw new ContractError(path, `exceeds ${maxLength} characters`)
  return value
}

/** Decodes a bounded string or an absent optional value. */
export const optionalString = (
  value: unknown,
  path: string,
  maxLength = 2_048,
): string | undefined => (value == null ? undefined : string(value, path, maxLength))

/** Decodes a boolean or an absent optional value. */
export const optionalBoolean = (value: unknown, path: string): boolean | undefined => {
  if (value == null) return undefined
  if (typeof value !== 'boolean') throw new ContractError(path, 'expected a boolean')
  return value
}

/** Decodes a safe integer at or above the supplied minimum. */
export const integer = (value: unknown, path: string, min = 0): number => {
  if (!Number.isSafeInteger(value) || (value as number) < min) {
    throw new ContractError(path, `expected an integer greater than or equal to ${min}`)
  }
  return value as number
}

/** Decodes one exact schema-version or discriminator literal. */
export const literal = <T extends string | number>(
  value: unknown,
  expected: T,
  path: string,
): T => {
  if (value !== expected) throw new ContractError(path, `expected ${JSON.stringify(expected)}`)
  return expected
}

/** Decodes one member of a bounded string enum. */
export const oneOf = <T extends string>(value: unknown, values: readonly T[], path: string): T => {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new ContractError(path, `expected one of ${values.join(', ')}`)
  }
  return value as T
}
