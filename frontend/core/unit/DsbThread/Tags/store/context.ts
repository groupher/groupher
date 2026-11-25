'use client'

import { createContext } from 'react'

import type { TTagsEditorStore } from './index'

export const TagsEditorContext = createContext<TTagsEditorStore | null>(null)
