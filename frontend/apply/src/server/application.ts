import { createServerFn } from '@tanstack/react-start'

import type { ApplyInitialData, CommunityApplication, ReviewApplication } from '../spec'
import { requestGraphQL } from './graphql'

const applicationFields = `
  publicRef status version title slug desc locale applyCategory applyMessage
  submittedAt completedAt updatedAt decisionReasonCode
  logo { applicationUploadRef communityAssetRef url }
  community { publicRef slug }
`

export const loadApplyState = createServerFn({ method: 'GET', strict: false }).handler(
  async (): Promise<ApplyInitialData> => {
    const accountData = await requestGraphQL<{ me: { login: string } | null }>(
      `query ApplyAccount { me { login } }`,
    )
    if (!accountData.me) {
      return {
        account: null,
        canApply: { allowed: false, reasonCode: 'login_required', retryAt: null },
        currentApplication: null,
        latestFailedApplication: null,
      }
    }

    const data = await requestGraphQL<{
      communityApplicationState: {
        canApply: ApplyInitialData['canApply']
        currentApplication: CommunityApplication | null
        latestFailedApplication: CommunityApplication | null
      }
    }>(`
      query ApplyInitialState {
        communityApplicationState {
          canApply { allowed reasonCode retryAt }
          currentApplication { ${applicationFields} }
          latestFailedApplication { publicRef status title slug updatedAt }
        }
      }
    `)

    return {
      account: { publicRef: accountData.me.login },
      ...data.communityApplicationState,
    }
  },
)

export const loadOwnedApplication = createServerFn({ method: 'GET', strict: false })
  .validator((data: { ref: string }) => data)
  .handler(async ({ data }): Promise<CommunityApplication | null> => {
    const result = await requestGraphQL<{ communityApplication: CommunityApplication | null }>(
      `query OwnedApplication($ref: ID!) {
        communityApplication(ref: $ref) { ${applicationFields} }
      }`,
      data,
    )
    return result.communityApplication
  })

export const loadReviewQueue = createServerFn({ method: 'GET', strict: false }).handler(
  async (): Promise<CommunityApplication[]> => {
    const result = await requestGraphQL<{
      pagedCommunityApplications: { edges: Array<{ node: CommunityApplication }> }
    }>(`
      query ReviewQueue {
        pagedCommunityApplications(
          filter: { statuses: [SUBMITTED, REVIEWING, APPROVED, CREATION_FAILED, SETUP_FAILED] }
          first: 100
        ) {
          edges { node { publicRef status version title slug submittedAt reviewer { publicRef } } }
        }
      }
    `)
    return result.pagedCommunityApplications.edges.map(({ node }) => node)
  },
)

export const loadReviewApplication = createServerFn({ method: 'GET', strict: false })
  .validator((data: { ref: string }) => data)
  .handler(async ({ data }): Promise<ReviewApplication | null> => {
    const result = await requestGraphQL<{ reviewCommunityApplication: ReviewApplication | null }>(
      `query ReviewApplication($ref: ID!) {
        reviewCommunityApplication(ref: $ref) {
          ${applicationFields}
          applicant { publicRef }
          reviewer { publicRef }
          expiresAt reviewedAt setupStartedAt decisionNote
          lastJobError { reasonCode message operationRef occurredAt }
          events(first: 100) {
            edges { cursor node { fromStatus toStatus actorType actor { publicRef } reasonCode operationRef occurredAt } }
          }
        }
      }`,
      data,
    )
    return result.reviewCommunityApplication
  })
