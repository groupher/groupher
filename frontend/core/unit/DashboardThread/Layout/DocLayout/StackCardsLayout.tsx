import useSalon, { cnMerge } from '../../salon/layout/doc_layout/stack_cards_layout'

export default function StackCardsLayout() {
  const s = useSalon()

  return (
    <div className={s.block}>
      <div className={s.cardsRows}>
        <div className={s.cardsRow}>
          <div className={s.cardBox}>
            <div className={s.cardBody}>
              <div className={cnMerge(s.bar, 'h-1 w-6 opacity-20')} />
              <div className={cnMerge(s.bar, 'w-10 opacity-40')} />
              <div className={cnMerge(s.bar, 'h-1 w-12 opacity-20')} />
              <div className={cnMerge(s.bar, 'h-1 w-8 opacity-15')} />
              <div className={cnMerge(s.bar, 'h-1 w-10 opacity-10')} />
            </div>
            <div className={s.cardFooter}>
              <div className={s.cardFooterBar} />
            </div>
          </div>

          <div className={s.cardBox}>
            <div className={s.cardBody}>
              <div className={cnMerge(s.bar, 'h-1 w-6 opacity-20')} />
              <div className={cnMerge(s.bar, 'w-8 opacity-40')} />
              <div className={cnMerge(s.bar, 'h-1 w-10 opacity-20')} />
              <div className={cnMerge(s.bar, 'h-1 w-8 opacity-15')} />
              <div className={cnMerge(s.bar, 'h-1 w-8 opacity-10')} />
            </div>
            <div className={s.cardFooter}>
              <div className={s.cardFooterBar} />
            </div>
          </div>

          <div className={s.cardBox}>
            <div className={s.cardBody}>
              <div className={cnMerge(s.bar, 'h-1 w-6 opacity-20')} />
              <div className={cnMerge(s.bar, 'w-8 opacity-40')} />
              <div className={cnMerge(s.bar, 'h-1 w-6 opacity-20')} />
              <div className={cnMerge(s.bar, 'h-1 w-10 opacity-15')} />
              <div className={cnMerge(s.bar, 'h-1 w-8 opacity-10')} />
            </div>
            <div className={s.cardFooter}>
              <div className={s.cardFooterBar} />
            </div>
          </div>
        </div>

        <div className={s.cardsRow}>
          <div className={s.cardBox}>
            <div className={s.cardBody}>
              <div className={cnMerge(s.bar, 'h-1 w-6 opacity-20')} />
              <div className={cnMerge(s.bar, 'w-6 opacity-40')} />
              <div className={cnMerge(s.bar, 'h-1 w-10 opacity-20')} />
              <div className={cnMerge(s.bar, 'h-1 w-12 opacity-15')} />
              <div className={cnMerge(s.bar, 'h-1 w-8 opacity-10')} />
            </div>
            <div className={s.cardFooter}>
              <div className={s.cardFooterBar} />
            </div>
          </div>

          <div className={s.cardBox}>
            <div className={s.cardBody}>
              <div className={cnMerge(s.bar, 'h-1 w-6 opacity-20')} />
              <div className={cnMerge(s.bar, 'w-12 opacity-40')} />
              <div className={cnMerge(s.bar, 'h-1 w-12 opacity-20')} />
              <div className={cnMerge(s.bar, 'h-1 w-8 opacity-15')} />
              <div className={cnMerge(s.bar, 'h-1 w-10 opacity-10')} />
            </div>
            <div className={s.cardFooter}>
              <div className={s.cardFooterBar} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
