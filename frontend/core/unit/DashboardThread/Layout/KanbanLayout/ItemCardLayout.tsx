import { KANBAN_CARD_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CommentSVG from '~/icons/Comment'
import UpvoteSVG from '~/icons/Upvote'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useKanban from '../../logic/useKanban'
import useSalon, { cnMerge } from '../../salon/layout/kanban_layout/item_card_layout'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'

const KANBAN_CARD_LAYOUT_OPTIONS = [
  {
    value: KANBAN_CARD_LAYOUT.SIMPLE,
    titleKey: 'dsb.layout.kanban.card.option.simple',
  },
  {
    value: KANBAN_CARD_LAYOUT.FULL,
    titleKey: 'dsb.layout.kanban.card.option.full',
  },
] as const

function SimplePreview({ isActive }: { isActive: boolean }) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.frame}>
        <div className={s.header}>
          <div className={cnMerge(s.bar, s.titleBar)} />
          <div className={cnMerge(s.bar, s.bodyBar)} />
        </div>

        <div className={s.footer}>
          <div className={s.footerLeft}>
            <UpvoteSVG className={s.icon} />
            <CommentSVG className={s.commentIcon} />
          </div>
          <div className={cnMerge(s.bar, s.simpleMetric)} />
        </div>
      </div>
    </div>
  )
}

function FullPreview({ isActive }: { isActive: boolean }) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.frame}>
        <div className={s.header}>
          <div className={cnMerge(s.bar, s.titleBar)} />
          <div className={s.headerRow}>
            <div className={cnMerge(s.bar, s.bodyBar)} />
            <div className={cnMerge(s.bar, s.sideBar)} />
          </div>
        </div>

        <div className={s.footer}>
          <div className={s.footerLeft}>
            <UpvoteSVG className={s.icon} />
            <div className={s.avatarList}>
              <div className={s.userAvatar} />
              <div className={cnMerge(s.userAvatar, 'opacity-30')} />
              <div className={cnMerge(s.userAvatar, 'opacity-20')} />
            </div>
          </div>

          <div className={s.footerRight}>
            <CommentSVG className={s.commentIcon} />
            <div className={cnMerge(s.bar, s.tinyMetric)} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ItemCardLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { kanbanCardLayout: cardLayout, isKanbanCardLayoutTouched: isTouched, edit } = useKanban()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.kanban.card.title')}
        desc={t('dsb.layout.kanban.card.desc')}
      />
      <div className={s.select}>
        {KANBAN_CARD_LAYOUT_OPTIONS.map(({ value, titleKey }) => {
          const isActive = cardLayout === value

          return (
            <button
              key={value}
              type='button'
              className={s.layout}
              aria-pressed={isActive}
              onClick={() => edit(value, FIELD.KANBAN_CARD_LAYOUT)}
            >
              {value === KANBAN_CARD_LAYOUT.SIMPLE ? (
                <SimplePreview isActive={isActive} />
              ) : (
                <FullPreview isActive={isActive} />
              )}
              <CheckLabel title={t(titleKey)} active={isActive} top={2} />
            </button>
          )
        })}
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.KANBAN_CARD_LAYOUT} top={10} />
    </div>
  )
}
