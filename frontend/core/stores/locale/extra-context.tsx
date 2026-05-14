'use client'

import { createContext, useContext } from 'react'

export type TExtraLocaleMessages = Record<string, string>

export const ExtraLocaleContext = createContext<TExtraLocaleMessages>({})
ExtraLocaleContext.displayName = 'ExtraLocale'

// Internal hook: business code should keep using useTrans(), which merges base and extra messages.
export const useExtraLocaleContext = (): TExtraLocaleMessages => useContext(ExtraLocaleContext)
