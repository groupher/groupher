import { cnMerge } from '../../salon/layout/doc_layout/cover_thumb_base'
import useSalon from '../../salon/layout/doc_layout/stack_cards_layout'

const CARD_ROWS = [
  [
    { title: 'w-6', subtitle: 'w-10', body1: 'w-12', body2: 'w-16', body3: 'w-10' },
    { title: 'w-6', subtitle: 'w-8', body1: 'w-10', body2: 'w-8', body3: 'w-8' },
    { title: 'w-6', subtitle: 'w-8', body1: 'w-6', body2: 'w-10', body3: 'w-8' },
  ],
  [
    { title: 'w-6', subtitle: 'w-6', body1: 'w-14', body2: 'w-12', body3: 'w-8' },
    { title: 'w-6', subtitle: 'w-12', body1: 'w-12', body2: 'w-16', body3: 'w-10' },
  ],
] as const

export default function StackCardsLayout() {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, 'justify-center')}>
      <div className={s.cardsRows}>
        {CARD_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className={s.cardsRow}>
            {row.map((item, index) => (
              <div key={index} className={s.cardBox}>
                <div className={s.cardBody}>
                  <div className={cnMerge(s.bar, 'h-1', item.title, 'opacity-20')} />
                  <div className={cnMerge(s.bar, item.subtitle, 'opacity-40')} />
                  <div className={cnMerge(s.bar, 'h-1', item.body1, 'opacity-20')} />
                  <div className={cnMerge(s.bar, 'h-1', item.body2, 'opacity-15')} />
                  <div className={cnMerge(s.bar, 'h-1', item.body3, 'opacity-10')} />
                </div>

                <div className={s.cardFooter}>
                  <div className={s.cardFooterBar} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
