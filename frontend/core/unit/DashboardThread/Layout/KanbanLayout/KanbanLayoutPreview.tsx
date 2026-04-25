import { KANBAN_LAYOUT } from '~/const/layout'
import type { TKanbanLayout } from '~/spec'

import useSalon, { cnMerge } from '../../salon/layout/kanban_layout/layout_selector'

const CLASSIC_COLUMNS = [
  ['opacity-35', 'opacity-20'],
  ['opacity-35', 'opacity-25', 'opacity-15', 'opacity-10'],
  ['opacity-35', 'opacity-25', 'opacity-15'],
] as const

const WATERFALL_GROUPS = [
  {
    headerWidth: 'w-full',
    titleWidth: 'w-16 opacity-30',
    rows: [
      { left: 'w-32 opacity-30', right: 'w-8 opacity-20' },
      { left: 'w-24 opacity-20', right: 'w-8 opacity-10' },
    ],
  },
  {
    headerWidth: 'w-full',
    titleWidth: 'w-10 opacity-40',
    rows: [
      { left: 'w-32 opacity-30', right: 'w-8 opacity-20' },
      { left: 'w-24 opacity-20', right: 'w-8 opacity-10' },
    ],
  },
  {
    headerWidth: 'w-full',
    titleWidth: 'w-12 opacity-25',
    rows: [{ left: 'w-12 opacity-10', right: 'w-8 opacity-10' }],
  },
] as const

type TProps = {
  layout: TKanbanLayout
}

function ClassicPreview() {
  const s = useSalon()

  return (
    <div className={s.boardGrid}>
      {CLASSIC_COLUMNS.map((cards) => (
        <div key={cards.join('|')} className={s.boardColumn}>
          <div className={s.boardContent}>
            {cards.map((opacity) => (
              <div key={opacity} className={cnMerge(s.card, opacity)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function WaterfallPreview() {
  const s = useSalon()

  return (
    <div className={s.waterfall}>
      {WATERFALL_GROUPS.map((group) => (
        <div key={`${group.headerWidth}-${group.titleWidth}`} className={s.waterfallGroup}>
          <div className={cnMerge(s.waterfallMain, group.headerWidth)}>
            <div className={cnMerge(s.waterfallTitle, group.titleWidth)} />
          </div>

          {group.rows.map((row) => (
            <div key={`${row.left}-${row.right}`} className={s.waterfallRow}>
              <div className={cnMerge(s.waterfallMeta, row.left)} />
              <div className={cnMerge(s.waterfallMeta, row.right)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function KanbanLayoutPreview({ layout }: TProps) {
  if (layout === KANBAN_LAYOUT.WATERFALL) {
    return <WaterfallPreview />
  }

  return <ClassicPreview />
}
