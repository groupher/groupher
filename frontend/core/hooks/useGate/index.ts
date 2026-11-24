'use client'

import {
  GATE_PERMISSION,
  type TGateAction,
  type TGatePermissionScope,
  type TGateThread,
} from '@groupher/contracts/gate'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import { viewerQueryKeys } from '~/query/key'
import { currentCommunityGateFacts, currentGlobalPassport } from '~/schemas/pages/passport'
import useAccount from '~/stores/account/hooks'

export type TGlobalGateContext = {
  scope?: 'global'
  community?: never
  thread?: never
  article?: never
}
export type TCommunityGateContext = {
  scope: 'community'
  community: string
  thread?: TGateThread
  article?: never
}
export type TArticleGateContext = {
  scope: 'article'
  thread?: TGateThread
  community?: string
  article: { permissions: Partial<Record<TGateAction, boolean>> }
}
export type TGateContext = TGlobalGateContext | TCommunityGateContext | TArticleGateContext

type TUseGateOptions = { community?: { slug: string; ref: string } }
type TGlobalFacts = { isRoot: boolean; permissions: readonly string[] }
type TCommunityFacts = { isLord: boolean; permissions: readonly string[] }

const contextScope = (context: TGateContext): TGatePermissionScope => context.scope ?? 'global'
const passportAction = (action: TGateAction): string => action.replaceAll('.', '_').toUpperCase()

const directlyGranted = (
  global: TGlobalFacts | undefined,
  community: TCommunityFacts | null | undefined,
  action: TGateAction,
  scope: TGatePermissionScope,
  context: TGateContext,
): boolean => {
  if (scope !== contextScope(context)) return false

  if (scope === 'global') {
    return global?.isRoot === true || global?.permissions.includes(passportAction(action)) === true
  }

  if (scope === 'community') {
    if (context.scope !== 'community') return false
    return (
      global?.isRoot === true ||
      community?.isLord === true ||
      community?.permissions.includes(passportAction(action)) === true
    )
  }

  return context.scope === 'article' && context.article.permissions[action] === true
}

const granted = (
  global: TGlobalFacts | undefined,
  community: TCommunityFacts | null | undefined,
  action: TGateAction,
  context: TGateContext,
): boolean => {
  const metadata = GATE_PERMISSION[action]
  if (!metadata || metadata.scope !== contextScope(context)) return false

  const threadRequirements = Object.keys(metadata.requires_thread).length > 0
  if (threadRequirements && !context.thread) return false

  if (!directlyGranted(global, community, action, metadata.scope, context)) return false

  const required = [
    ...metadata.requires,
    ...(context.thread ? (metadata.requires_thread[context.thread] ?? []) : []),
  ]

  return required.every((requiredAction) => {
    const requiredMetadata = GATE_PERMISSION[requiredAction]
    return (
      requiredMetadata.scope === metadata.scope &&
      directlyGranted(global, community, requiredAction, requiredMetadata.scope, context)
    )
  })
}

/** Reads server-owned Passport facts for conservative, early UI admission decisions. */
export default function useGate(options: TUseGateOptions = {}) {
  const { isLogin, accountScope } = useAccount()
  const globalPassport = useQuery({
    queryKey: viewerQueryKeys.globalPassport(accountScope || 'anonymous'),
    queryFn: async () => (await browserGraphQLRequest(currentGlobalPassport)).currentGlobalPassport,
    enabled: isLogin && !!accountScope,
    staleTime: 30_000,
  })
  const currentAdmin = useQuery({
    queryKey: viewerQueryKeys.communityGateFacts(
      accountScope || 'anonymous',
      options.community?.slug || '',
    ),
    queryFn: async () =>
      (
        await browserGraphQLRequest(currentCommunityGateFacts, {
          communityRef: options.community?.ref ?? '',
        })
      ).currentCommunityAdmin,
    enabled: isLogin && !!accountScope && !!options.community?.slug && !!options.community.ref,
    staleTime: 30_000,
  })
  const global: TGlobalFacts | undefined = globalPassport.data
    ? {
        isRoot: globalPassport.data.isRoot,
        permissions: globalPassport.data.permissions,
      }
    : undefined
  const community: TCommunityFacts | null =
    currentAdmin.data != null
      ? {
          isLord: currentAdmin.data.isLord,
          permissions: currentAdmin.data.permissions,
        }
      : null
  const can = useCallback(
    (action: TGateAction, context: TGateContext = {}): boolean =>
      isLogin &&
      (context.scope !== 'community' || context.community === options.community?.slug) &&
      granted(global, community, action, context),
    [community, global, isLogin, options.community?.slug],
  )

  return useMemo(() => ({ can, isLogin }), [can, isLogin])
}
