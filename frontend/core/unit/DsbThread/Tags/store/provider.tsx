'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'

import useCommunity from '~/stores/community/hooks'

import { createTagsEditorStore } from '.'
import { TagsEditorContext } from './context'

type TProps = { children: ReactNode }

export default function TagsEditorProvider({ children }: TProps) {
  const { slug: community } = useCommunity()
  const store = useMemo(() => createTagsEditorStore(community), [community])

  return <TagsEditorContext.Provider value={store}>{children}</TagsEditorContext.Provider>
}
