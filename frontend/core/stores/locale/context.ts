'use client'

import { createContext } from 'react'

import type { TStore } from './spec'

export const StoreContext = createContext<TStore | null>(null)
StoreContext.displayName = 'Locale'
