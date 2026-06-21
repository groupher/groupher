import { type FC, type ReactNode, useState } from 'react'

import Img from '~/Img'
import Button from '~/widgets/Buttons/Button'

import { REVISION_DRAWER } from '../constant'
import {
  formatRelativeRevisionTime,
  getRevisionAuthorInitial,
  getRevisionAuthorName,
} from './helper'
import useSalon, { cn } from './salon/item'
import type { TArticleRevision } from './spec'
import type { TRevisionDiffStats } from './helper'

type TProps = {
  revision: TArticleRevision
  selected: boolean
  restoreDisabled: boolean
  restoring: boolean
  stats: TRevisionDiffStats
  children?: ReactNode
  onSelect: (revisionId: string) => void
  onRestore: (revisionId: string) => void
}

const RevisionItem: FC<TProps> = ({
  revision,
  selected,
  restoreDisabled,
  restoring,
  stats,
  children,
  onSelect,
  onRestore,
}) => {
  const s = useSalon()
  const [confirming, setConfirming] = useState(false)
  const selectRevision = (): void => onSelect(revision.id)

  return (
    <article className={cn(s.item, selected && s.itemSelected)}>
      <div
        role='button'
        tabIndex={0}
        className={s.selectButton}
        onClick={selectRevision}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          selectRevision()
        }}
      >
        <div className={s.summary}>
          <span>{formatRelativeRevisionTime(revision.insertedAt)}</span>
          <span className={s.additions}>+{stats.additions}</span>
          <span className={s.deletions}>-{stats.deletions}</span>
        </div>

        <div className={s.authorLine}>
          {revision.author?.avatar ? (
            <Img src={revision.author.avatar} className={s.avatar} />
          ) : (
            <span className={s.avatarFallback}>{getRevisionAuthorInitial(revision.author)}</span>
          )}
          <span>by {getRevisionAuthorName(revision.author)}</span>
        </div>
      </div>

      {selected && children && (
        <div className={s.diffSlot}>
          {children}
          <div className={s.actions}>
            <Button
              ghost
              noBorder
              size='tiny'
              disabled={restoreDisabled}
              loading={restoring}
              onClick={() => {
                if (!confirming) {
                  setConfirming(true)
                  return
                }

                onRestore(revision.id)
              }}
            >
              {confirming ? REVISION_DRAWER.CONFIRM_RESTORE : REVISION_DRAWER.RESTORE}
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}

export default RevisionItem
