import type { CommunityApplication } from '../spec'

export type ApplyCategory = 'PRODUCT' | 'GAMING' | 'TEACH' | 'GROUP'

export type ApplyDraft = {
  currentStep: number
  communityType: ApplyCategory
  slug: string
  title: string
  desc: string
  logoAssetRef: string
  logoUrl: string
  locale: string
  applyMessage: string
}

export type ApplyStore = ApplyDraft & {
  hydrated: boolean
  submitting: boolean
  submitError: string | null
  idempotencyKey: string
  submittedApplication: CommunityApplication | null
}
