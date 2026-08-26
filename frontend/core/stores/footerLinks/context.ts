'use client'

import { createContext } from 'react'

import type { TFooterLinks } from './spec'

export const FooterLinksContext = createContext<TFooterLinks | null>(null)
FooterLinksContext.displayName = 'FooterLinks'
