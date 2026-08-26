'use client'

import { createContext } from 'react'

import type { TShellStyle } from './spec'

export const ShellStyleContext = createContext<TShellStyle | null>(null)
ShellStyleContext.displayName = 'ShellStyle'
