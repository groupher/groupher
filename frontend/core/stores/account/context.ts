'use client'

import { createContext } from 'react'

import type { TUser } from '~/spec'

import type { TInit } from './spec'

export const SessionSeedContext = createContext<TInit | null>(null)
SessionSeedContext.displayName = 'AccountSessionSeed'

export type TAccountContext = {
  user: TUser | null
  accountRef: string | null
  loading: boolean
  isLogin: boolean
  accountInfo: Partial<TUser> & {
    isLogin: boolean
    isValidSession: boolean
    isModerator: boolean
  }
}

export const AccountContext = createContext<TAccountContext | null>(null)
AccountContext.displayName = 'Account'
