import { KANBAN_LAYOUT } from '~/const/layout'

import CheckLabel from '~/widgets/CheckLabel'

import { SETTING_FIELD } from '../../constant'
import SectionLabel from '../../SectionLabel'
import SavingBar from '../../SavingBar'

import useKanban from '../../logic/useKanban'
import useSalon, { cn } from '../../salon/layout/kanban_layout/global_layout'

export default () => {
  const s = useSalon()

  const { kanbanLayout: layout, getKanbanLayoutTouched, saving, edit } = useKanban()
  const isTouched = getKanbanLayoutTouched()

  return (
    <>
      <SectionLabel title="整体布局" desc="「看板」的整体布局，切换不影响内容。" />
      <div className={s.select}>
        <div className={s.layout} onClick={() => edit(KANBAN_LAYOUT.CLASSIC, 'kanbanLayout')}>
          <div className={cn(s.block, layout === KANBAN_LAYOUT.CLASSIC && s.blockActive)}>
            <div className={cn(s.bar, 'w-10')} />
            <div className={cn(s.bar, 'w-6 right-5 opacity-30')} />

            <div className={cn(s.bar, s.board, 'left-3')} />
            <div className={cn(s.bar, s.item, 'left-5 top-14 opacity-35')} />
            <div className={cn(s.bar, s.item, 'left-5 top-24 opacity-20 -mt-1')} />

            <div className={cn(s.bar, s.board, 'left-24 ml-1')} />
            <div className={cn(s.bar, s.item, 'left-24 top-14 opacity-35 ml-3')} />
            <div className={cn(s.bar, s.item, 'left-24 top-24 opacity-25 -mt-1 ml-3')} />
            <div className={cn(s.bar, s.item, 'left-24 bottom-9 opacity-15 ml-3')} />
            <div className={cn(s.bar, s.item, 'left-24 bottom-0 opacity-10 ml-3')} />

            <div className={cn(s.bar, s.board, 'right-4 ml-1')} />
            <div className={cn(s.bar, s.item, 'right-6 top-14 opacity-35')} />
            <div className={cn(s.bar, s.item, 'right-6 top-24 opacity-25 -mt-1')} />
            <div className={cn(s.bar, s.item, 'right-6 bottom-9 opacity-15')} />
          </div>
          <CheckLabel title="经典" active={layout === KANBAN_LAYOUT.CLASSIC} top={4} />
        </div>
        <div className={s.layout} onClick={() => edit(KANBAN_LAYOUT.WATERFALL, 'kanbanLayout')}>
          <div className={cn(s.block, layout === KANBAN_LAYOUT.WATERFALL && s.blockActive)}>
            <div className={cn(s.bar, 'w-10')} />
            <div className={cn(s.bar, 'w-6 right-5 opacity-30')} />

            <div className={cn(s.bar, 'w-64 h-3.5 left-4 top-12 opacity-10')} />
            <div className={cn(s.bar, 'w-8 h-1.5 left-6 top-12 mt-1 opacity-30')} />

            <div className={cn(s.bar, 'w-32 h-1.5 left-6 top-16 mt-2 opacity-30')} />
            <div className={cn(s.bar, 'w-24 h-1.5 left-6 top-20 mt-2 opacity-20')} />
            <div className={cn(s.bar, 'w-8 h-1.5 right-4 top-16 mt-2 opacity-20')} />
            <div className={cn(s.bar, 'w-8 h-1.5 right-4 top-20 mt-1.5 opacity-10')} />

            <div className={cn(s.bar, 'w-64 h-3.5 left-4 top-24 mt-2 opacity-10')} />
            <div className={cn(s.bar, 'w-10 h-1.5 left-6 top-24 mt-3 opacity-40')} />

            <div className={cn(s.bar, 'w-32 h-1.5 left-6 top-28 mt-3.5 opacity-30')} />
            <div className={cn(s.bar, 'w-24 h-1.5 left-6 top-32 mt-3.5 opacity-20')} />
            <div className={cn(s.bar, 'w-8 h-1.5 right-4 top-28 mt-3.5 opacity-20')} />
            <div className={cn(s.bar, 'w-8 h-1.5 right-4 top-32 mt-3 opacity-10')} />

            <div className={cn(s.bar, 'w-64 h-3.5 left-4 bottom-5 opacity-10')} />
            <div className={cn(s.bar, 'w-8 h-1.5 left-6 bottom-6 opacity-25')} />

            <div className={cn(s.bar, 'w-12 h-1.5 left-6 bottom-2 mt-3.5 opacity-10')} />
            <div className={cn(s.bar, 'w-8 h-1.5 right-4 bottom-2 mt-3 opacity-10')} />
          </div>
          <CheckLabel title="瀑布" active={layout === KANBAN_LAYOUT.WATERFALL} top={4} />
        </div>
      </div>

      <SavingBar
        width="w-11/12"
        isTouched={isTouched}
        field={SETTING_FIELD.KANBAN_LAYOUT}
        loading={saving}
        top={8}
        bottom={20}
      />
    </>
  )
}
