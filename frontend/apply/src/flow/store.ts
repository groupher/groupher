import { proxy } from 'valtio'

import type { ApplyStore } from './spec'

export const emptyDraft = (): ApplyStore => ({
  currentStep: 0,
  communityType: 'PRODUCT',
  slug: '',
  title: '',
  desc: '',
  logoAssetRef: '',
  logoUrl: '',
  locale: 'en',
  applyMessage: '',
  hydrated: false,
  submitting: false,
  submitError: null,
  idempotencyKey: crypto.randomUUID(),
  submittedApplication: null,
})

export const createApplyStore = () => proxy<ApplyStore>(emptyDraft())
