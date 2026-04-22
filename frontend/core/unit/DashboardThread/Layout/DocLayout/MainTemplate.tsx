import type { FC } from 'react'
import { DOC_COVER_LAYOUT } from '~/const/layout'
import ToolSVG from '~/icons/Book'
import type { TDocCoverLayout } from '~/spec'

import useSalon, { cnMerge } from '../../salon/layout/doc_layout/main_template'

type TProps = {
  layout: TDocCoverLayout
}

const OUTLINE_ITEMS = [
  { toneBg: 'redBg', toneFg: 'red', title: 'w-10', line: 'w-12', num: 'w-2' },
  { toneBg: 'blueBg', toneFg: 'blue', title: 'w-12', line: 'w-14', num: 'w-2' },
  { toneBg: 'purpleBg', toneFg: 'purple', title: 'w-8', line: 'w-16', num: 'w-2' },
  { toneBg: 'brownBg', toneFg: 'brown', title: 'w-12', line: 'w-12', num: 'w-2' },
  { toneBg: 'greenBg', toneFg: 'green', title: 'w-10', line: 'w-14', num: 'w-2' },
  { toneBg: 'redBg', toneFg: 'red', title: 'w-8', line: 'w-10', num: 'w-2' },
] as const

const TOC_ITEMS = [
  { title: 'w-12', line: 'w-40', meta: 'w-7' },
  { title: 'w-14', line: 'w-44', meta: 'w-7' },
  { title: 'w-10', line: 'w-42', meta: 'w-7' },
  { title: 'w-12', line: 'w-40', meta: 'w-7' },
] as const

const BRIEF_GROUPS = [
  [
    { toneBg: 'redBg', toneFg: 'red' },
    { toneBg: 'blueBg', toneFg: 'blue' },
    { toneBg: 'greenBg', toneFg: 'green' },
  ],
  [
    { toneBg: 'purpleBg', toneFg: 'purple' },
    { toneBg: 'brownBg', toneFg: 'brown' },
    { toneBg: 'redBg', toneFg: 'red' },
  ],
] as const

const TILE_ITEMS = [
  { toneBg: 'redBg', toneFg: 'red' },
  { toneBg: 'blueBg', toneFg: 'blue' },
  { toneBg: 'purpleBg', toneFg: 'purple' },
  { toneBg: 'greenBg', toneFg: 'green' },
  { toneBg: 'brownBg', toneFg: 'brown' },
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

  if (layout === DOC_COVER_LAYOUT.OUTLINE_COLUMNS) {
    return (
      <div className={cnMerge(s.block, 'justify-center')}>
        <div className='grid w-full grid-cols-3 gap-5 px-5 py-6'>
          {[0, 1, 2].map((col) => (
            <div key={col} className='column gap-6'>
              {OUTLINE_ITEMS.filter((_, index) => index % 3 === col).map((item, index) => (
                <div key={index} className='column gap-2.5'>
                  <div className={cnMerge(s.bar, item.title, 'h-2 opacity-40')} />
                  <div className='row-center gap-2.5'>
                    <div className={cnMerge(s.bar, item.line, 'h-1 opacity-20 grow')} />
                    <div className={cnMerge(s.bar, item.num, 'h-1.5 opacity-45')} />
                  </div>
                  <div className='row-center gap-2.5'>
                    <div className={cnMerge(s.bar, item.line, 'h-1 opacity-20 grow')} />
                    <div className={cnMerge(s.bar, item.num, 'h-1.5 opacity-35')} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (layout === DOC_COVER_LAYOUT.OUTLINE_TOC) {
    return (
      <div className={cnMerge(s.block, 'justify-center')}>
        <div className='column w-full gap-5 px-7 py-5'>
          {TOC_ITEMS.map((item, index) => (
            <div key={index} className='column gap-2.5'>
              <div className={cnMerge(s.bar, item.title, 'h-2 opacity-40')} />
              <div className='row-center gap-3'>
                <div className={cnMerge(s.bar, item.line, 'h-1 opacity-20 grow')} />
                <div className={cnMerge(s.bar, item.meta, 'h-1.5 opacity-40')} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (layout === DOC_COVER_LAYOUT.BRIEF_CARDS) {
    return (
      <div className={cnMerge(s.block, 'justify-center')}>
        <div className='column w-full gap-7 px-6 py-6'>
          {BRIEF_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex} className='column gap-4'>
              <div className={cnMerge(s.bar, 'h-2 w-16 opacity-40')} />
              <div className='grid grid-cols-3 gap-x-6 gap-y-5'>
                {group.map((item, index) => (
                  <div key={index} className='row-start gap-3'>
                    <div className={cnMerge(s.iconBox, s[item.toneBg], 'mt-0.5 size-4')}>
                      <ToolSVG className={cnMerge(s.icon, s[item.toneFg], 'size-2.5')} />
                    </div>
                    <div className='column gap-1.5 pt-0.5'>
                      <div className={cnMerge(s.bar, 'h-2 w-11 opacity-40')} />
                      <div className={cnMerge(s.bar, 'h-1 w-16 opacity-25')} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (layout === DOC_COVER_LAYOUT.TILE_CARDS) {
    return (
      <div className={cnMerge(s.block, 'justify-center')}>
        <div className='grid w-full grid-cols-2 gap-4 px-5 py-4'>
          {TILE_ITEMS.slice(0, 4).map((item, index) => (
            <div
              key={index}
              className='column gap-3 rounded-xl border border-black/6 bg-white/80 px-4 py-3.5'
            >
              <div className={cnMerge(s.iconBox, s[item.toneBg], 'size-5')} />
              <div className={cnMerge(s.bar, 'h-2 w-12 opacity-40')} />
              <div className={cnMerge(s.bar, 'h-1 w-16 opacity-22')} />
              <div className='row-center gap-2 pt-1.5'>
                <div className={cnMerge(s.circle, 'size-3 opacity-25')} />
                <div className={cnMerge(s.bar, 'h-1 w-12 opacity-25')} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (layout === DOC_COVER_LAYOUT.COVER_CARDS) {
    return (
      <div className={cnMerge(s.block, 'justify-center')}>
        <div className='column w-full gap-4 px-5 py-5'>
          <div className={cnMerge(s.bar, 'h-2 w-16 opacity-40')} />
          <div className={cnMerge(s.bar, 'h-1 w-28 opacity-22')} />
          <div className='grid grid-cols-2 gap-4 pt-1'>
            {[0, 1].map((index) => (
              <div key={index} className='column gap-2.5'>
                <div className='h-12 rounded-xl bg-black/10' />
                <div className={cnMerge(s.bar, 'h-2 w-12 opacity-40')} />
                <div className={cnMerge(s.bar, 'h-1 w-16 opacity-22')} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (layout === DOC_COVER_LAYOUT.STACK_CARDS) {
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

  return null
}

export default MainTemplate
