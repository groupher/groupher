import {
  ApplyAccountDocument,
  ApplyInitialStateDocument,
  OwnedApplicationDocument,
  ReviewApplicationDocument,
  ReviewQueueDocument,
} from '@groupher/frontend-core/graphql/generated'
import { createServerFn } from '@tanstack/react-start'

import type { ApplyInitialData, CommunityApplication, ReviewApplication } from '../spec'
import { requestGraphQL } from './graphql'

export const loadApplyState = createServerFn({ method: 'GET', strict: false }).handler(
  async (): Promise<ApplyInitialData> => {
    const accountData = await requestGraphQL(ApplyAccountDocument)
    if (!accountData.me) {
      return {
        account: null,
        canApply: { allowed: false, reasonCode: 'login_required', retryAt: null },
        currentApplication: null,
        latestFailedApplication: null,
      }
    }

    const data = await requestGraphQL(ApplyInitialStateDocument)

    return {
      account: { publicRef: accountData.me.login },
      ...data.communityApplicationState,
    }
  },
)

export const loadOwnedApplication = createServerFn({ method: 'GET', strict: false })
  .validator((data: { ref: string }) => data)
  .handler(async ({ data }): Promise<CommunityApplication | null> => {
    const result = await requestGraphQL(OwnedApplicationDocument, data)
    return result.communityApplication
  })

export const loadReviewQueue = createServerFn({ method: 'GET', strict: false }).handler(
  async (): Promise<CommunityApplication[]> => {
    const result = await requestGraphQL(ReviewQueueDocument)
    return result.pagedCommunityApplications.edges.map(({ node }) => node)
  },
)

export const loadReviewApplication = createServerFn({ method: 'GET', strict: false })
  .validator((data: { ref: string }) => data)
  .handler(async ({ data }): Promise<ReviewApplication | null> => {
    const result = await requestGraphQL(ReviewApplicationDocument, data)
    return result.reviewCommunityApplication
  })
