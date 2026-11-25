'use client'

import { createContext } from 'react'

import type { TStore } from '../spec'

export const CoverEditorContext = createContext<TStore | null>(null)
