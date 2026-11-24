import {
  ApplyAccountDocument,
  ApplyInitialStateDocument,
  OwnedApplicationDocument,
  ReviewApplicationDocument,
  ReviewQueueDocument,
} from '@groupher/frontend-core/graphql/generated'
import { createServerFn } from '@tanstack/react-start'

import { sessionState as sessionStateDocument } from '~/schemas/pages/user'
import type { TUser } from '~/spec'
import type { TInit as TAccountInit } from '~/stores/account/spec'

import type { ApplyInitialData, CommunityApplication, ReviewApplication } from '../spec'
import { GraphQLRequestError, requestGraphQL } from './graphql'

const AUTH_FAILURE_CODES = new Set([
  'ACCOUNT_BLOCKED',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
])

const resolveApplyAccount = async (): Promise<TAccountInit> => {
  try {
    const data = await requestGraphQL(sessionStateDocument, {})
    const session = data.sessionState
    return {
      loading: false,
      user: session?.isValid && session.user ? (session.user as TUser) : null,
    }
  } catch (error) {
    if (error instanceof GraphQLRequestError && AUTH_FAILURE_CODES.has(error.reasonCode || '')) {
      return { loading: false, user: null }
    }
    throw error
  }
}

/** Loads the request user once for the Apply root AccountStore seed. */
export const loadApplyAccount = createServerFn({ method: 'GET', strict: false }).handler(
  resolveApplyAccount,
)

/** Resolves reviewer admission before protected child route loaders run. */
export const loadReviewAdmission = createServerFn({ method: 'GET', strict: false }).handler(
  async (): Promise<boolean> => {
    const account = await resolveApplyAccount()
    const globalPassport = account.user?.passport?.global
    return Boolean(globalPassport?.god || globalPassport?.['community.application.review'])
  },
)

export const loadApplyState = createServerFn({ method: 'GET', strict: false }).handler(
  async (): Promise<ApplyInitialData> => {
    const accountData = await requestGraphQL(ApplyAccountDocument, {})
    if (!accountData.me?.login) {
      return {
        account: null,
        canApply: { allowed: false, reasonCode: 'login_required', retryAt: null },
        currentApplication: null,
        latestFailedApplication: null,
      }
    }

    const data = await requestGraphQL(ApplyInitialStateDocument, {})

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

export const loadReviewQueue = createServerFn({ method: 'GET', strict: false })
  .validator((data: { pagi?: import('~/spec').TPagiGraphQLInput }) => data)
  .handler(async ({ data }) => {
    const result = await requestGraphQL(ReviewQueueDocument, { pagi: data.pagi })
    return result.pagedCommunityApplications
  })

export const loadReviewApplication = createServerFn({ method: 'GET', strict: false })
  .validator((data: { ref: string; pagi?: import('~/spec').TPagiGraphQLInput }) => data)
  .handler(async ({ data }): Promise<ReviewApplication | null> => {
    const result = await requestGraphQL(ReviewApplicationDocument, data)
    return result.reviewCommunityApplication
  })
