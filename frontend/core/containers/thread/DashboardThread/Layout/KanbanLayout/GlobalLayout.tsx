import { KANBAN_LAYOUT } from '~/const/layout'

import CheckLabel from '~/widgets/CheckLabel'
import useTrans from '~/hooks/useTrans'

import { FIELD } from '../../constant'
import useKanban from '../../logic/useKanban'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from '../../salon/layout/kanban_layout/global_layout'

export default () => {
  const s = useSalon()
  const { t } = useTrans()

  const { kanbanLayout: layout, isKanbanLayoutTouched: isTouched, saving, edit } = useKanban()

  return (
    <>
      <SectionLabel title={t('dsb.layout.kanban.global.title')} desc={t('dsb.layout.kanban.global.desc')} />
      <div className={s.select}>
        <button className={s.layout} onClick={() => edit(KANBAN_LAYOUT.CLASSIC, 'kanbanLayout')}>
          <div className={cnMerge(s.block, layout === KANBAN_LAYOUT.CLASSIC && s.blockActive)}>
            <div className={cnMerge(s.bar, 'w-10')} />
            <div className={cnMerge(s.bar, 'w-6 right-5 opacity-30')} />

            <div className={cnMerge(s.bar, s.board, 'left-3')} />
            <div className={cnMerge(s.bar, s.item, 'left-5 top-14 opacity-35')} />
            <div className={cnMerge(s.bar, s.item, 'left-5 top-24 opacity-20 -mt-1')} />
            <div className={cnMerge(s.bar, s.board, 'left-24 ml-1')} />
            <div className={cnMerge(s.bar, s.item, 'left-24 top-14 opacity-35 ml-3')} />
            <div className={cnMerge(s.bar, s.item, 'left-24 top-24 opacity-25 -mt-1 ml-3')} />
            <div className={cnMerge(s.bar, s.item, 'left-24 bottom-9 opacity-15 ml-3')} />
            <div className={cnMerge(s.bar, s.item, 'left-24 bottom-0 opacity-10 ml-3')} />
            <div className={cnMerge(s.bar, s.board, 'right-4 ml-1')} />
            <div className={cnMerge(s.bar, s.item, 'right-6 top-14 opacity-35')} />
            <div className={cnMerge(s.bar, s.item, 'right-6 top-24 opacity-25 -mt-1')} />
            <div className={cnMerge(s.bar, s.item, 'right-6 bottom-9 opacity-15')} />
          </div>
          <CheckLabel
            title={t('dsb.layout.kanban.global.option.classic')}
            active={layout === KANBAN_LAYOUT.CLASSIC}
            top={4}
          />
        </button>
        <button className={s.layout} onClick={() => edit(KANBAN_LAYOUT.WATERFALL, 'kanbanLayout')}>
          <div className={cnMerge(s.block, layout === KANBAN_LAYOUT.WATERFALL && s.blockActive)}>
            <div className={cnMerge(s.bar, 'w-10')} />
            <div className={cnMerge(s.bar, 'w-6 right-5 opacity-30')} />

            <div className={cnMerge(s.bar, 'w-64 h-3.5 left-4 top-12 opacity-10')} />
            <div className={cnMerge(s.bar, 'w-8 h-1.5 left-6 top-12 mt-1 opacity-30')} />

            <div className={cnMerge(s.bar, 'w-32 h-1.5 left-6 top-16 mt-2 opacity-30')} />
            <div className={cnMerge(s.bar, 'w-24 h-1.5 left-6 top-20 mt-2 opacity-20')} />
            <div className={cnMerge(s.bar, 'w-8 h-1.5 right-4 top-16 mt-2 opacity-20')} />
            <div className={cnMerge(s.bar, 'w-8 h-1.5 right-4 top-20 mt-1.5 opacity-10')} />

            <div className={cnMerge(s.bar, 'w-64 h-3.5 left-4 top-24 mt-2 opacity-10')} />
            <div className={cnMerge(s.bar, 'w-10 h-1.5 left-6 top-24 mt-3 opacity-40')} />

            <div className={cnMerge(s.bar, 'w-32 h-1.5 left-6 top-28 mt-3.5 opacity-30')} />
            <div className={cnMerge(s.bar, 'w-24 h-1.5 left-6 top-32 mt-3.5 opacity-20')} />
            <div className={cnMerge(s.bar, 'w-8 h-1.5 right-4 top-28 mt-3.5 opacity-20')} />
            <div className={cnMerge(s.bar, 'w-8 h-1.5 right-4 top-32 mt-3 opacity-10')} />

            <div className={cnMerge(s.bar, 'w-64 h-3.5 left-4 bottom-5 opacity-10')} />
            <div className={cnMerge(s.bar, 'w-8 h-1.5 left-6 bottom-6 opacity-25')} />

            <div className={cnMerge(s.bar, 'w-12 h-1.5 left-6 bottom-2 mt-3.5 opacity-10')} />
            <div className={cnMerge(s.bar, 'w-8 h-1.5 right-4 bottom-2 mt-3 opacity-10')} />
          </div>
          <CheckLabel
            title={t('dsb.layout.kanban.global.option.waterfall')}
            active={layout === KANBAN_LAYOUT.WATERFALL}
            top={4}
          />
        </button>
      </div>

      <SavingBar
        width='w-11/12'
        isTouched={isTouched}
        field={FIELD.KANBAN_LAYOUT}
        loading={saving}
        top={8}
        bottom={20}
      />
    </>
  )
}
