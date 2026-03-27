import { KANBAN_CARD_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CommentSVG from '~/icons/Comment'
import UpvoteSVG from '~/icons/Upvote'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useKanban from '../../logic/useKanban'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from '../../salon/layout/kanban_layout/item_card_layout'

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

export default function ItemCardLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const {
    kanbanCardLayout: cardLayout,
    isKanbanCardLayoutTouched: isTouched,
    saving,
    edit,
  } = useKanban()

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
              <div className={cnMerge(s.block, isActive && s.blockActive)}>
                <div className={cnMerge(s.bar, 'w-16')} />
                <div className={cnMerge(s.bar, 'top-8 w-28 h-2.5 opacity-40')} />

                {value === KANBAN_CARD_LAYOUT.SIMPLE ? (
                  <>
                    <div className={cnMerge(s.bar, 'bottom-4 right-4 w-10 opacity-30')} />

                    <UpvoteSVG className={cnMerge(s.icon, 'bottom-3 left-4')} />
                    <CommentSVG className={cnMerge(s.icon, 'size-3.5 bottom-3.5 left-12')} />
                  </>
                ) : (
                  <>
                    <div className={cnMerge(s.bar, 'bottom-12 right-4 w-10 mb-1 opacity-20')} />

                    <UpvoteSVG className={cnMerge(s.icon, 'bottom-3 left-4')} />
                    <div className={cnMerge(s.userAvatar, 'left-10 bottom-3.5')} />
                    <div className={cnMerge(s.userAvatar, 'left-16 bottom-3.5 -ml-1 opacity-30')} />
                    <div className={cnMerge(s.userAvatar, 'left-20 bottom-3.5 opacity-20')} />

                    <CommentSVG className={cnMerge(s.icon, 'size-3.5 bottom-3.5 right-10')} />

                    <div className={cnMerge(s.bar, 'w-4 bottom-5 right-4 mt-1 opacity-20')} />
                  </>
                )}
              </div>
              <CheckLabel title={t(titleKey)} active={isActive} top={2} />
            </button>
          )
        })}
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.KANBAN_CARD_LAYOUT} loading={saving} top={10} />
    </div>
  )
}
