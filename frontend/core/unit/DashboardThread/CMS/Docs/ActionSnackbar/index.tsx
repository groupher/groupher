'use client'

import { m } from 'motion/react'
import type { FC } from 'react'

import useOverlayDark from '~/hooks/useOverlayDark'

import Comment from './Comment'
import { ACTION_SNACKBAR_LAYOUT_TRANSITION } from './constant'
import ContentCheck from './ContentCheck'
import DiffStatus from './DiffStatus'
import DocInfo from './DocInfo'
import EditToggle from './EditToggle'
import ImportContent from './ImportContent'
import More from './More'
import Publish from './Publish'
import useSalon from './salon'
import SyncDraft from './SyncDraft'

const ActionSnackbar: FC = () => {
  const s = useSalon()
  const overlayDark = useOverlayDark()

  return (
    <m.div
      layout
      transition={{ layout: ACTION_SNACKBAR_LAYOUT_TRANSITION }}
      className={s.wrapper}
      data-theme={overlayDark ? 'dark' : undefined}
    >
      <div className={s.actionGroup}>
        <EditToggle />
        <DocInfo />
        <DiffStatus />
        <ImportContent />
        <ContentCheck />
        <Comment />
        <More />
      </div>

      <div className={s.divider} />

      <div className={s.commitGroup}>
        <SyncDraft />
        <Publish />
      </div>
    </m.div>
  )
}

export default ActionSnackbar
