import useTheme from '~/hooks/useTheme'
import GrabDotsSVG from '~/icons/GrabDots'
import SettingSVG from '~/icons/Setting'
import TrashSVG from '~/icons/Trash'
import { Link } from '~/platform'
import BgRenderer from '~/render/BgRenderer'
import ContentThumbnail from '~/unit/ArticleDocument/ContentThumbnail'

import type { TDocCoverPinnedDoc } from '../spec'
import { pinnedDocBackground } from './helper'
import useSalon from './salon'

type TProps = {
  doc: TDocCoverPinnedDoc
  editable?: boolean
  dragHandleRef?: (node: HTMLButtonElement | null) => void
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
  onEdit?: (doc: TDocCoverPinnedDoc) => void
  onUnpin?: (doc: TDocCoverPinnedDoc) => void
}

export default function PinnedDocCard({
  doc,
  editable = false,
  dragHandleRef,
  dragHandleProps,
  onEdit,
  onUnpin,
}: TProps) {
  const { isDarkTheme } = useTheme()
  const s = useSalon()
  const renderSpec = pinnedDocBackground(doc.appearance, isDarkTheme)

  return (
    <article className={s.card}>
      {renderSpec && <BgRenderer className={s.background} renderSpec={renderSpec} />}
      <div className={s.tint} aria-hidden='true' />
      {editable && (
        <div className={s.actions}>
          <button
            ref={dragHandleRef}
            type='button'
            className={s.action}
            aria-label='Drag pinned doc'
            {...dragHandleProps}
          >
            <GrabDotsSVG className={s.actionIcon} />
          </button>
          <button
            type='button'
            className={s.action}
            aria-label='Edit background'
            onClick={() => onEdit?.(doc)}
          >
            <SettingSVG className={s.actionIcon} />
          </button>
          <button
            type='button'
            className={s.action}
            aria-label='Unpin from cover'
            onClick={() => onUnpin?.(doc)}
          >
            <TrashSVG className={s.actionIcon} />
          </button>
        </div>
      )}
      <Link className={s.link} href={doc.href}>
        <div className={s.header}>
          <h3 className={s.title}>{doc.doc.title}</h3>
          {doc.doc.author?.nickname && <span className={s.author}>{doc.doc.author.nickname}</span>}
        </div>
        <div className={s.thumbnail}>
          <ContentThumbnail thumbnail={doc.doc.document?.thumbnail} />
        </div>
      </Link>
    </article>
  )
}
