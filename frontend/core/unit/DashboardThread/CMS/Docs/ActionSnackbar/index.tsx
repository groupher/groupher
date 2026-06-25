'use client'

import type { FC } from 'react'

import useOverlayDark from '~/hooks/useOverlayDark'

import Comment from './Comment'
import ContentCheck from './ContentCheck'
import DiffStatus from './DiffStatus'
import DocInfo from './DocInfo'
import EditToggle from './EditToggle'
import ImportContent from './ImportContent'
import More from './More'
import useSalon from './salon'
import SaveZone from './SaveZone'

const ActionSnackbar: FC = () => {
  const s = useSalon()
  const overlayDark = useOverlayDark()

  return (
    <div className={s.wrapper} data-theme={overlayDark ? 'dark' : undefined}>
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
        <SaveZone />
      </div>
    </div>
  )
}

export default ActionSnackbar
