import type { ApplyDraft, ApplyStore } from './spec'

const key = (accountScope: string) => `groupher.apply.draft.v1:${accountScope}`

const persistedFields = (store: ApplyStore): ApplyDraft => ({
  currentStep: store.currentStep,
  communityType: store.communityType,
  slug: store.slug,
  title: store.title,
  desc: store.desc,
  logoAssetRef: store.logoAssetRef,
  logoUrl: store.logoUrl,
  locale: store.locale,
  applyMessage: store.applyMessage,
})

/** Runs the restore draft operation at the frontend shared boundary. */
export const restoreDraft = (accountScope: string): Partial<ApplyDraft> | null => {
  try {
    const raw = localStorage.getItem(key(accountScope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { version?: number; draft?: Partial<ApplyDraft> }
    return parsed.version === 1 ? (parsed.draft ?? null) : null
  } catch {
    return null
  }
}

/** Runs the persist draft operation at the frontend shared boundary. */
export const persistDraft = (accountScope: string, store: ApplyStore): void => {
  localStorage.setItem(
    key(accountScope),
    JSON.stringify({ version: 1, draft: persistedFields(store) }),
  )
}

/** Runs the remove draft operation at the frontend shared boundary. */
export const removeDraft = (accountScope: string): void =>
  localStorage.removeItem(key(accountScope))
