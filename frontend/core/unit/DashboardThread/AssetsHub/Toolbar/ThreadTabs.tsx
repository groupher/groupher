'use client'

import { useMemo } from 'react'

import { THREAD_PATH } from '~/const/thread'
import usePublicThreads from '~/hooks/usePublicThreads'
import Tabs from '~/ui/Switcher/Tabs'
import type { TTabItem } from '~/ui/Switcher/Tabs/spec'
import { path2Thread } from '~/utils/thread'

import { ASSETS_HUB_THREAD_FILTER } from '../constant'
import type { TAssetThreadFilter } from '../spec'
import useSalon from './salon/thread_tabs'

type TProps = {
  activeThread: TAssetThreadFilter
  onThreadChange: (thread: TAssetThreadFilter) => void
}

const ASSET_THREAD_PATHS: readonly string[] = [
  THREAD_PATH.POST,
  THREAD_PATH.CHANGELOG,
  THREAD_PATH.DOC,
]

export default function ThreadTabs({ activeThread, onThreadChange }: TProps) {
  const s = useSalon()
  const publicThreads = usePublicThreads()
  const items = useMemo<TTabItem[]>(
    () => [
      { label: 'All', slug: ASSETS_HUB_THREAD_FILTER.ALL },
      ...publicThreads
        .filter((thread) => ASSET_THREAD_PATHS.includes(thread.slug))
        .map((thread) => ({
          label: thread.title,
          slug: path2Thread(thread.slug),
        })),
    ],
    [publicThreads],
  )

  return (
    <div className={s.wrapper}>
      <Tabs
        items={items}
        activeKey={activeThread}
        size='small'
        bottomSpace={1.5}
        onChange={(key) => onThreadChange(key as TAssetThreadFilter)}
      />
    </div>
  )
}
