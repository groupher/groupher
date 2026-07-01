import { type FC, type ReactNode, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import Img from '~/Img'
import Button from '~/widgets/Buttons/Button'

import { REVISION_LABEL_KEY } from '../constant'
import {
  formatRelativeRevisionTime,
  getRevisionAuthorInitial,
  getRevisionAuthorName,
} from './helper'
import type { TRevisionDiffStats } from './helper'
import useSalon, { cn } from './salon/item'
import type { TArticleSnapshot } from './spec'

type TProps = {
  revision: TArticleSnapshot
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
  const { t } = useTrans()
  const [confirming, setConfirming] = useState(false)
  const selectRevision = (): void => onSelect(revision.id)
  const hasStats = stats.additions > 0 || stats.deletions > 0

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
          <span>{formatRelativeRevisionTime(t, revision.insertedAt)}</span>
          {hasStats && (
            <>
              <span className={s.additions}>+{stats.additions}</span>
              <span className={s.deletions}>-{stats.deletions}</span>
            </>
          )}
        </div>

        <div className={s.authorLine}>
          {revision.author?.avatar ? (
            <Img src={revision.author.avatar} className={s.avatar} />
          ) : (
            <span className={s.avatarFallback}>{getRevisionAuthorInitial(revision.author)}</span>
          )}
          <span>
            {t(REVISION_LABEL_KEY.BY)} {getRevisionAuthorName(t, revision.author)}
          </span>
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
              {confirming ? t(REVISION_LABEL_KEY.CONFIRM_RESTORE) : t(REVISION_LABEL_KEY.RESTORE)}
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}

export default RevisionItem
