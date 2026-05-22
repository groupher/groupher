import { KANBAN_CARD_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useKanban from '../../logic/useKanban'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import FullCardPreview from './FullCardPreview'
import useSalon from './salon/item_card_layout'
import SimpleCardPreview from './SimpleCardPreview'

const KANBAN_CARD_LAYOUT_OPTIONS = [
  {
    value: KANBAN_CARD_LAYOUT.SIMPLE,
    titleKey: 'dsb.appearance.kanban.card.option.simple',
  },
  {
    value: KANBAN_CARD_LAYOUT.FULL,
    titleKey: 'dsb.appearance.kanban.card.option.full',
  },
] as const

export default function ItemCardLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { kanbanCardLayout: cardLayout, isKanbanCardLayoutTouched: isTouched, edit } = useKanban()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.appearance.kanban.card.title')}
        desc={t('dsb.appearance.kanban.card.desc')}
        touched={isTouched}
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
                <SimpleCardPreview isActive={isActive} />
              ) : (
                <FullCardPreview isActive={isActive} />
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
