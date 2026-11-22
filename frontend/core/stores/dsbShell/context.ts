'use client'

import { createContext } from 'react'

import type { TDsbShellContextValue } from './spec'

export const DsbShellContext = createContext<TDsbShellContextValue | null>(null)
DsbShellContext.displayName = 'DsbShell'
