import { KANBAN_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useKanban from '../../logic/useKanban'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from '../../salon/layout/kanban_layout/global_layout'

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

export default function GlobalLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { kanbanLayout: layout, isKanbanLayoutTouched: isTouched, saving, edit } = useKanban()

  return (
    <>
      <SectionLabel
        title={t('dsb.layout.kanban.global.title')}
        desc={t('dsb.layout.kanban.global.desc')}
      />
      <div className={s.select}>
        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === KANBAN_LAYOUT.CLASSIC}
          onClick={() => edit(KANBAN_LAYOUT.CLASSIC, FIELD.KANBAN_LAYOUT)}
        >
          <div className={cnMerge(s.block, layout === KANBAN_LAYOUT.CLASSIC && s.blockActive)}>
            <div className={s.frame}>
              <div className={s.toolbar}>
                <div className={cnMerge(s.bar, s.toolbarLeft)} />
                <div className={cnMerge(s.bar, s.toolbarRight)} />
              </div>

              <div className={s.boardGrid}>
                {CLASSIC_COLUMNS.map((cards, index) => (
                  <div key={index} className={s.boardColumn}>
                    <div className={s.boardSurface} />
                    <div className={s.boardContent}>
                      {cards.map((opacity, cardIndex) => (
                        <div key={`${index}-${cardIndex}`} className={cnMerge(s.card, opacity)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <CheckLabel
            title={t('dsb.layout.kanban.global.option.classic')}
            active={layout === KANBAN_LAYOUT.CLASSIC}
            top={4}
          />
        </button>
        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === KANBAN_LAYOUT.WATERFALL}
          onClick={() => edit(KANBAN_LAYOUT.WATERFALL, FIELD.KANBAN_LAYOUT)}
        >
          <div className={cnMerge(s.block, layout === KANBAN_LAYOUT.WATERFALL && s.blockActive)}>
            <div className={s.frame}>
              <div className={s.toolbar}>
                <div className={cnMerge(s.bar, s.toolbarLeft)} />
                <div className={cnMerge(s.bar, s.toolbarRight)} />
              </div>

              <div className={s.waterfall}>
                {WATERFALL_GROUPS.map((group, index) => (
                  <div key={index} className={s.waterfallGroup}>
                    <div className={cnMerge(s.waterfallMain, group.headerWidth)}>
                      <div className={cnMerge(s.waterfallTitle, group.titleWidth)} />
                    </div>

                    {group.rows.map((row, rowIndex) => (
                      <div key={`${index}-${rowIndex}`} className={s.waterfallRow}>
                        <div className={cnMerge(s.waterfallMeta, row.left)} />
                        <div className={cnMerge(s.waterfallMeta, row.right)} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <CheckLabel
            title={t('dsb.layout.kanban.global.option.waterfall')}
            active={layout === KANBAN_LAYOUT.WATERFALL}
            top={4}
          />
        </button>
      </div>

      <SavingBar
        isTouched={isTouched}
        field={FIELD.KANBAN_LAYOUT}
        loading={saving}
        top={8}
        bottom={20}
      />
    </>
  )
}
