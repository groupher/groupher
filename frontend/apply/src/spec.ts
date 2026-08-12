export type ApplicationStatus =
  | 'SUBMITTED'
  | 'REVIEWING'
  | 'APPROVED'
  | 'CREATION_FAILED'
  | 'SETTING_UP'
  | 'SETUP_FAILED'
  | 'CREATED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'

export type ApplicationLogo = {
  applicationUploadRef: string
  communityAssetRef: string | null
  url: string
}

export type CommunityApplication = {
  publicRef: string
  status: ApplicationStatus
  version: number
  title: string
  slug: string
  desc: string
  logo: ApplicationLogo
  locale: string
  applyCategory: 'PRODUCT' | 'GAMING' | 'TEACH' | 'GROUP'
  applyMessage?: string | null
  submittedAt: string
  completedAt?: string | null
  updatedAt: string
  decisionReasonCode?: string | null
  community?: { publicRef?: string; slug: string } | null
}

export type ApplyInitialData = {
  account: { publicRef: string } | null
  canApply: { allowed: boolean; reasonCode: string | null; retryAt: string | null }
  currentApplication: CommunityApplication | null
  latestFailedApplication: Pick<
    CommunityApplication,
    'publicRef' | 'status' | 'title' | 'slug' | 'updatedAt'
  > | null
}

export type ApplicationEvent = {
  fromStatus: ApplicationStatus | null
  toStatus: ApplicationStatus
  actorType: 'APPLICANT' | 'REVIEWER' | 'JOB' | 'SYSTEM'
  actor: { publicRef: string } | null
  reasonCode: string | null
  operationRef: string | null
  occurredAt: string
}

export type ReviewApplication = CommunityApplication & {
  applicant: { publicRef: string }
  reviewer: { publicRef: string } | null
  expiresAt: string | null
  reviewedAt: string | null
  setupStartedAt: string | null
  decisionNote: string | null
  lastJobError: {
    reasonCode: string
    message: string
    operationRef: string | null
    occurredAt: string | null
  } | null
  events: { edges: Array<{ cursor: string; node: ApplicationEvent }> }
}
