'use client'

import { createContext } from 'react'

import type { TAuthenticatedUser, TUser } from '~/spec'

import type { TInit } from './spec'

export const SessionSeedContext = createContext<TInit | null>(null)
SessionSeedContext.displayName = 'AccountSessionSeed'

export type TAccountContext = {
  user: TAuthenticatedUser | null
  accountScope: string | null
  loading: boolean
  isLogin: boolean
  refreshSession: () => Promise<void>
  accountInfo: Partial<TUser> & {
    isLogin: boolean
    isValidSession: boolean
    isModerator: boolean
  }
}

export const AccountContext = createContext<TAccountContext | null>(null)
AccountContext.displayName = 'Account'
