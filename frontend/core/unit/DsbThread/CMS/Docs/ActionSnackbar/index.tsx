'use client'

import { m } from 'motion/react'
import type { FC } from 'react'

import useOverlayDark from '~/hooks/useOverlayDark'
import useTrans from '~/hooks/useTrans'

import useDocsEditor from '../Editor/store/hooks'
import ArticleActions from './ArticleActions'
import { ACTION_SNACKBAR_LAYOUT_TRANSITION } from './constant'
import PostPublishConflict from './PostPublishConflict'
import QueueActions from './Publish/QueueActions'
import usePublishQueue from './Publish/usePublishQueue'
import useSalon from './salon'
import SyncDraft from './SyncDraft'

const ActionSnackbar: FC = () => {
  const s = useSalon()
  const overlayDark = useOverlayDark()
  const { t } = useTrans()
  const { publishView } = useDocsEditor()
  const queue = usePublishQueue()
  const treeOnly = publishView.surfaceMode === 'tree'

  if (publishView.surfaceMode === 'hidden') return null

  return (
    <m.div
      layout
      transition={{ layout: ACTION_SNACKBAR_LAYOUT_TRANSITION }}
      className={s.wrapper}
      data-theme={overlayDark ? 'dark' : undefined}
    >
      {treeOnly ? (
        <span>
          {t('dsb.doc.queue.review')}: {queue.count}
        </span>
      ) : (
        <div className={s.actionGroup}>
          <ArticleActions />
          <PostPublishConflict />
        </div>
      )}

      <div className={s.divider} />

      <div className={s.commitGroup}>
        {!treeOnly && <SyncDraft />}
        <QueueActions queue={queue} />
      </div>
    </m.div>
  )
}

export default ActionSnackbar
