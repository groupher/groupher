import { proxy } from 'valtio'

import type { ApplyStore } from './spec'

/** Runs the empty draft operation at the frontend shared boundary. */
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

/** Creates apply store from typed frontend shared inputs. */
export const createApplyStore = () => proxy<ApplyStore>(emptyDraft())
