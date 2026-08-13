'use client'

import { createContext, use } from 'react'

export type TExtraLocaleMessages = Record<string, string>

export const ExtraLocaleContext = createContext<TExtraLocaleMessages>({})
ExtraLocaleContext.displayName = 'ExtraLocale'

// Internal hook: business code should keep using useTrans(), which merges base and extra messages.
/** Exposes extra locale context state and actions through the shared React hook boundary. */
export const useExtraLocaleContext = (): TExtraLocaleMessages => use(ExtraLocaleContext)
