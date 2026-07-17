import type { TRichEditorDiffStats } from '@groupher/rich-editor/diff'
import { type FC, type ReactNode, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import ArrowSimpleSVG from '~/icons/ArrowSimple'
import Img from '~/Img'
import Button from '~/widgets/Buttons/Button'

import { REVISION_LABEL_KEY } from '../constant'
import {
  formatRelativeRevisionTime,
  getRevisionAuthorInitial,
  getRevisionAuthorName,
} from './display'
import useSalon, { cn } from './salon/item'
import type { TArticleSnapshot } from './spec'

type TProps = {
  revision: TArticleSnapshot
  selected: boolean
  restoreDisabled: boolean
  restoring: boolean
  stats: TRichEditorDiffStats
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

  return (
    <article className={cn(s.item, selected && s.itemSelected)}>
      <button
        type='button'
        className={s.selectButton}
        aria-expanded={selected}
        onClick={selectRevision}
      >
        <div className={s.summaryRow}>
          <div className={s.summary}>
            <span>{formatRelativeRevisionTime(t, revision.insertedAt)}</span>
            <span className={s.additions}>+{stats.additions}</span>
            <span className={s.deletions}>-{stats.deletions}</span>
          </div>
          <span className={cn(s.toggleIcon, selected && s.toggleIconExpanded)} aria-hidden='true'>
            <ArrowSimpleSVG className={s.toggleIconSvg} />
          </span>
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
      </button>

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
