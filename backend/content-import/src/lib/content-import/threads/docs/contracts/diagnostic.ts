/**
 * BadSmell contract decoders shared by analysis artifacts and Review UI.
 *
 *   analysis JSON -> diagnostic decoder -> bounded BadSmell[] -> Review UI/apply
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import type { TBadSmell } from '../../../core/contracts'
import { array, ContractError, oneOf, optionalString, record, string } from './decoder'

/** Decodes one source-locatable warning or error. */
export const decodeBadSmell = (value: unknown, path = 'badSmell'): TBadSmell => {
  const input = record(value, path)

  return {
    code: string(input.code, `${path}.code`, 128),
    level: oneOf(input.level, ['error', 'warning'] as const, `${path}.level`),
    message: string(input.message, `${path}.message`, 4_096),
    path: optionalString(input.path, `${path}.path`, 1_024),
    sourceRef: optionalString(input.sourceRef, `${path}.sourceRef`, 1_024),
  }
}

/** Decodes a bounded list of source diagnostics. */
export const decodeBadSmells = (value: unknown, path = 'badSmells'): TBadSmell[] => {
  const values = array(value, path)
  if (values.length > 1_000) throw new ContractError(path, 'exceeds 1000 bad smells')
  return values.map((item, index) => decodeBadSmell(item, `${path}[${index}]`))
}
