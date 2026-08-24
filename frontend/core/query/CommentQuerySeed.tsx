'use client'

import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import type { TPagedComments, TThread } from '~/spec'

import { Q } from './client'

export default function CommentQuerySeed({
  children,
  community,
  initialComments,
  innerId,
  thread,
}: {
  children: ReactNode
  community: string
  initialComments?: TPagedComments
  innerId: string | number
  thread: TThread
}) {
  useQuery({
    ...Q.comment.list(community, thread, innerId),
    initialData: initialComments,
  })
  return children
}
