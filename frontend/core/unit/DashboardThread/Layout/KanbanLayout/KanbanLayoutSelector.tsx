import { KANBAN_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useKanban from '../../logic/useKanban'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from '../../salon/layout/kanban_layout/layout_selector'
import KanbanLayoutPreview from './KanbanLayoutPreview'

export default function KanbanLayoutSelector() {
  const s = useSalon()
  const { t } = useTrans()

  const { kanbanLayout: layout, isKanbanLayoutTouched: isTouched, edit } = useKanban()

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
              <KanbanLayoutPreview layout={KANBAN_LAYOUT.CLASSIC} />
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
              <KanbanLayoutPreview layout={KANBAN_LAYOUT.WATERFALL} />
            </div>
          </div>
          <CheckLabel
            title={t('dsb.layout.kanban.global.option.waterfall')}
            active={layout === KANBAN_LAYOUT.WATERFALL}
            top={4}
          />
        </button>
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.KANBAN_LAYOUT} top={8} bottom={20} />
    </>
  )
}
