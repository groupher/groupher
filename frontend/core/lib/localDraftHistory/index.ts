/**
 * Exposes LocalDraftHistory without coupling shared storage to a product editor.
 *
 *   product adapter -> public repository API -> IndexedDB implementation
 */

export * from './canonical'
export * from './repository'
export * from './types'
