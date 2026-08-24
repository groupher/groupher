'use client'

import { createContext } from 'react'

import type { TInit } from './spec'

export const SessionSeedContext = createContext<TInit | null>(null)
SessionSeedContext.displayName = 'AccountSessionSeed'
