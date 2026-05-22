import { clone, equals as defaultEquals } from 'ramda'

/**
 * Generic draft/original/touched field state machine for Valtio stores.
 *
 * This helper owns only field-level draft mechanics:
 * - write a current field value
 * - compare it against `original`
 * - mark or clear `touchedFields`
 * - accept current values as the new original after a successful save
 * - rollback current values from original on cancel
 *
 * It deliberately does not know about API calls, save bars, dashboard sections,
 * ThemePreset custom semantics, preview CSS vars, or demo mode. Callers define
 * their own field groups and decide when a group should be saved, accepted, or
 * rolled back.
 *
 * Example:
 *
 * ```ts
 * type TProfileFields = {
 *   title: string
 *   description: string
 * }
 *
 * const store = proxy({
 *   title: '',
 *   description: '',
 *   original: { title: '', description: '' },
 *   touchedFields: {},
 *   ...createDraftFieldActions<TProfileFields>(() => store),
 * })
 *
 * store.editField('title', 'Groupher')
 * store.isTouched('title') // true
 *
 * // After the backend save succeeds:
 * store.acceptFields(['title'])
 *
 * // On cancel:
 * store.rollbackFields(['description'])
 * ```
 */

type TDraftFieldKey<TFields> = keyof TFields

export type TDraftTouchedFields<TFields> = Partial<Record<TDraftFieldKey<TFields>, true>>

/**
 * Shape expected from the host store. The current fields live at the store root,
 * `original` keeps the saved baseline, and `touchedFields` is a sparse map of
 * fields that differ from that baseline.
 */
type TDraftStore<TFields extends object> = TFields & {
  original: TFields
  touchedFields: TDraftTouchedFields<TFields>
}

type TOptions = {
  /**
   * Override equality when a field needs normalized comparison.
   * The default is Ramda `equals`, which is enough for ordinary object/array
   * value comparison in the dashboard store.
   */
  equals?: (left: unknown, right: unknown) => boolean
}

export type TDraftFieldActions<TFields extends object> = {
  // Write one current field and refresh its touched state against original.
  editField: <K extends TDraftFieldKey<TFields>>(field: K, value: TFields[K]) => void
  // Batch version of editField. Undefined values are ignored.
  editFields: (patch: Partial<TFields>) => void
  // Accept current values as saved values and clear touched state for fields.
  acceptFields: (fields: readonly TDraftFieldKey<TFields>[]) => void
  // Backward-compatible alias for acceptFields used by older dashboard code.
  markFieldsToOriginal: (fields: readonly TDraftFieldKey<TFields>[]) => void
  // Replace original directly when a caller already computed the accepted patch.
  replaceOriginal: (patch: Partial<TFields>) => void
  // Restore current field values from original and clear touched state.
  rollbackFields: (fields: readonly TDraftFieldKey<TFields>[]) => void
  isTouched: (field: TDraftFieldKey<TFields>) => boolean
  anyTouched: (fields: readonly TDraftFieldKey<TFields>[]) => boolean
}

/**
 * Create draft field actions bound to a live store getter.
 *
 * `getStore` is a function rather than a direct store object so callers can
 * close over the Valtio proxy during store construction:
 *
 * ```ts
 * const store = proxy({
 *   ...initialFields,
 *   original: initialFields,
 *   touchedFields: {},
 *   ...createDraftFieldActions<TFields>(() => store),
 * })
 * ```
 */
export const createDraftFieldActions = <TFields extends object>(
  getStore: () => TDraftStore<TFields>,
  options: TOptions = {},
): TDraftFieldActions<TFields> => {
  const equals = options.equals ?? defaultEquals

  const actions: TDraftFieldActions<TFields> = {
    editField(field, value): void {
      const store = getStore()
      const storeFields = store as Record<TDraftFieldKey<TFields>, unknown>
      storeFields[field] = value

      if (equals(value, store.original[field])) {
        const { [field]: _removed, ...rest } = store.touchedFields
        store.touchedFields = rest as TDraftTouchedFields<TFields>
        return
      }

      store.touchedFields = { ...store.touchedFields, [field]: true }
    },
    editFields(patch): void {
      for (const field of Object.keys(patch) as Array<TDraftFieldKey<TFields>>) {
        const value = patch[field]
        if (value !== undefined) {
          actions.editField(field, value as TFields[typeof field])
        }
      }
    },
    acceptFields(fields): void {
      const store = getStore()
      const originalPatch = {} as Partial<TFields>
      const mutableOriginalPatch = originalPatch as Record<TDraftFieldKey<TFields>, unknown>
      const storeFields = store as Record<TDraftFieldKey<TFields>, unknown>
      let touchedFields = store.touchedFields

      for (const field of fields) {
        mutableOriginalPatch[field] = clone(storeFields[field])
        const { [field]: _removedTouched, ...nextTouchedFields } = touchedFields
        touchedFields = nextTouchedFields as TDraftTouchedFields<TFields>
      }

      store.original = { ...store.original, ...originalPatch }
      store.touchedFields = touchedFields
    },
    markFieldsToOriginal(fields): void {
      actions.acceptFields(fields)
    },
    replaceOriginal(patch): void {
      const store = getStore()
      store.original = { ...store.original, ...patch }
    },
    rollbackFields(fields): void {
      const store = getStore()
      const storeFields = store as Record<TDraftFieldKey<TFields>, unknown>
      let touchedFields = store.touchedFields

      for (const field of fields) {
        storeFields[field] = clone(store.original[field])
        const { [field]: _removedTouched, ...nextTouchedFields } = touchedFields
        touchedFields = nextTouchedFields as TDraftTouchedFields<TFields>
      }

      store.touchedFields = touchedFields
    },
    isTouched(field): boolean {
      return Boolean(getStore().touchedFields[field])
    },
    anyTouched(fields): boolean {
      return fields.some((field) => actions.isTouched(field))
    },
  }

  return actions
}
