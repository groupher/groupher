import type { FC } from 'react'
import { DOC_LAYOUT } from '~/const/layout'
import ToolSVG from '~/icons/Book'
import type { TDocLayout } from '~/spec'

import useSalon, { cnMerge } from '../../salon/layout/doc_layout/main_template'

type TProps = {
  layout: TDocLayout
}

const BLOCK_ITEMS = [
  { toneBg: 'redBg', toneFg: 'red', title: 'w-6', body1: 'w-8', body2: 'w-14', body3: 'w-10' },
  { toneBg: 'blueBg', toneFg: 'blue', title: 'w-6', body1: 'w-12', body2: 'w-14', body3: 'w-10' },
  { toneBg: 'purpleBg', toneFg: 'purple', title: 'w-6', body1: 'w-8', body2: 'w-16', body3: 'w-10' },
  { toneBg: 'brownBg', toneFg: 'brown', title: 'w-6', body1: 'w-10', body2: 'w-12', body3: 'w-10' },
  { toneBg: 'greenBg', toneFg: 'green', title: 'w-6', body1: 'w-12', body2: 'w-14', body3: 'w-8' },
] as const
const BLOCK_ROWS = [BLOCK_ITEMS.slice(0, 3), BLOCK_ITEMS.slice(3)] as const

const LIST_ITEMS = [
  { toneBg: 'redBg', toneFg: 'red', title: 'w-14', body1: 'w-28', body2: 'w-16' },
  { toneBg: 'blueBg', toneFg: 'blue', title: 'w-16', body1: 'w-24', body2: 'w-20' },
  { toneBg: 'purpleBg', toneFg: 'purple', title: 'w-20', body1: 'w-24', body2: 'w-10' },
  { toneBg: 'brownBg', toneFg: 'brown', title: 'w-14', body1: 'w-28', body2: 'w-10' },
  { toneBg: 'greenBg', toneFg: 'green', title: 'w-14', body1: 'w-28', body2: 'w-10' },
] as const

const CARD_ITEMS = [
  { title: 'w-6', subtitle: 'w-10', body1: 'w-12', body2: 'w-16', body3: 'w-10' },
  { title: 'w-6', subtitle: 'w-8', body1: 'w-10', body2: 'w-8', body3: 'w-8' },
  { title: 'w-6', subtitle: 'w-8', body1: 'w-6', body2: 'w-10', body3: 'w-8' },
  { title: 'w-6', subtitle: 'w-6', body1: 'w-14', body2: 'w-12', body3: 'w-8' },
  { title: 'w-6', subtitle: 'w-12', body1: 'w-12', body2: 'w-16', body3: 'w-10' },
] as const
const CARD_ROWS = [CARD_ITEMS.slice(0, 3), CARD_ITEMS.slice(3)] as const

const MainTemplate: FC<TProps> = ({ layout }) => {
  const s = useSalon()

  if (layout === DOC_LAYOUT.CARDS) {
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

  if (layout === DOC_LAYOUT.LISTS) {
    return (
      <div className={s.block}>
        <div className={s.list}>
          {LIST_ITEMS.map((item, index) => (
            <div key={index} className={s.listEntry}>
              <div className={cnMerge(s.iconBox, s[item.toneBg])}>
                <ToolSVG className={cnMerge(s.icon, s[item.toneFg])} />
              </div>

              <div className={s.listCopy}>
                <div className={cnMerge(s.bar, item.title)} />
                <div className={cnMerge(s.bar, 'h-1', item.body1, 'opacity-20')} />
                <div className={cnMerge(s.bar, 'h-1', item.body2, 'opacity-10')} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cnMerge(s.block, 'justify-center')}>
      <div className={s.blocksRows}>
        {BLOCK_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className={s.blocksRow}>
            {row.map((item, index) => (
              <div key={index} className={s.blocksCard}>
                <div className={s.blocksIconWrap}>
                  <div className={cnMerge(s.iconBox, s[item.toneBg])}>
                    <ToolSVG className={cnMerge(s.icon, s[item.toneFg])} />
                  </div>
                </div>

                <div className={s.blocksText}>
                  <div className={cnMerge(s.bar, 'h-1', item.title, 'opacity-20')} />
                  <div className={cnMerge(s.bar, item.body1, 'opacity-30')} />
                  <div className={cnMerge(s.bar, 'h-1', item.body2, 'opacity-20')} />
                  <div className={cnMerge(s.bar, 'h-1', item.body3, 'opacity-10')} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MainTemplate
