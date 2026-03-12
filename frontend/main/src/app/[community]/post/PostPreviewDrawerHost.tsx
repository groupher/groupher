'use client'

import { useParams, useSelectedLayoutSegment } from 'next/navigation'
import type { ReactNode } from 'react'
import Drawer from '~/widgets/@Drawer'

type TProps = {
  children: ReactNode
}

export default function PostPreviewDrawerHost({ children }: TProps) {
  const activeSegment = useSelectedLayoutSegment('previewer')
  const params = useParams<{ id?: string | string[] }>()
  const resetKey = Array.isArray(params.id) ? params.id[0] : params.id

  if (!activeSegment) return null

  return <Drawer resetKey={resetKey ?? activeSegment}>{children}</Drawer>
}
