'use client'

import { m } from 'motion/react'
import type { FC } from 'react'

import useOverlayDark from '~/hooks/useOverlayDark'

import useDocsEditor from '../Editor/store/hooks'
import ArticleActions from './ArticleActions'
import { ACTION_SNACKBAR_LAYOUT_TRANSITION } from './constant'
import Publish from './Publish'
import usePublishChecklist from './Publish/usePublishChecklist'
import useSalon from './salon'
import SyncDraft from './SyncDraft'
import TreeChangeStatus from './TreeChangeStatus'

const ActionSnackbar: FC = () => {
  const s = useSalon()
  const overlayDark = useOverlayDark()
  const { publishView } = useDocsEditor()
  const publishChecklist = usePublishChecklist()
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
        <TreeChangeStatus publishChecklist={publishChecklist.publishChecklist} />
      ) : (
        <div className={s.actionGroup}>
          <ArticleActions />
        </div>
      )}

      <div className={s.divider} />

      <div className={s.commitGroup}>
        {!treeOnly && <SyncDraft />}
        <Publish variant={treeOnly ? 'tree' : 'article'} checklist={publishChecklist} />
      </div>
    </m.div>
  )
}

export default ActionSnackbar
