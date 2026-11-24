'use client'

import {
  GATE_PERMISSION,
  type TGateAction,
  type TGatePermissionScope,
  type TGateThread,
} from '@groupher/contracts/gate'
import { useCallback, useMemo } from 'react'

import type { TPassport } from '~/spec'
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

type TCommunityPassport = { is_lord?: boolean; cms?: Record<string, boolean> }
type TGlobalPassport = { is_root?: boolean; [permission: string]: boolean | undefined }

const contextScope = (context: TGateContext): TGatePermissionScope => context.scope ?? 'global'

const directlyGranted = (
  passport: TPassport,
  action: TGateAction,
  scope: TGatePermissionScope,
  context: TGateContext,
): boolean => {
  if (scope !== contextScope(context)) return false

  if (scope === 'global') {
    const global = passport.global as TGlobalPassport | undefined
    return global?.is_root === true || global?.[action] === true
  }

  if (scope === 'community') {
    if (context.scope !== 'community') return false
    const community = passport[context.community] as TCommunityPassport | undefined
    return (
      (passport.global as TGlobalPassport | undefined)?.is_root === true ||
      community?.is_lord === true ||
      community?.cms?.[action] === true
    )
  }

  return context.scope === 'article' && context.article.permissions[action] === true
}

const granted = (
  passport: TPassport | undefined,
  action: TGateAction,
  context: TGateContext,
): boolean => {
  if (!passport) return false

  const metadata = GATE_PERMISSION[action]
  if (!metadata || metadata.scope !== contextScope(context)) return false

  const threadRequirements = Object.keys(metadata.requires_thread).length > 0
  if (threadRequirements && !context.thread) return false

  if (!directlyGranted(passport, action, metadata.scope, context)) return false

  const required = [
    ...metadata.requires,
    ...(context.thread ? (metadata.requires_thread[context.thread] ?? []) : []),
  ]

  return required.every((requiredAction) => {
    const requiredMetadata = GATE_PERMISSION[requiredAction]
    return (
      requiredMetadata.scope === metadata.scope &&
      directlyGranted(passport, requiredAction, requiredMetadata.scope, context)
    )
  })
}

/** Reads the current AccountStore Passport for early UI admission decisions. */
export default function useGate() {
  const { isLogin, user } = useAccount()
  const can = useCallback(
    (action: TGateAction, context: TGateContext = {}): boolean =>
      isLogin && granted(user?.passport, action, context),
    [isLogin, user?.passport],
  )

  return useMemo(() => ({ can, isLogin }), [can, isLogin])
}
