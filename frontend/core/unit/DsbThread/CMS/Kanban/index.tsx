'use client'

import { useQuery } from '@tanstack/react-query'

import { Q } from '~/query'
import type { TPagedArticles } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import KanbanThread from '~/unit/KanbanThread'

type TGroupedKanbanPosts = {
  backlog: TPagedArticles
  todo: TPagedArticles
  wip: TPagedArticles
  done: TPagedArticles
  rejected: TPagedArticles
}

export default function Kanban({ initialData }: { initialData?: TGroupedKanbanPosts | null }) {
  const { slug: community } = useCommunity()
  useQuery({ ...Q.article.kanban(community), initialData: initialData || undefined })

  return <KanbanThread />
}
