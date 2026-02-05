import { isEmpty } from 'ramda'

import { COLOR } from '~/const/colors'
import { INIT_KANBAN_COLORS } from '~/const/dashboard'
import { KANBAN_LAYOUT } from '~/const/layout'
import { randomBgNames } from '~/helper'
import useHover from '~/hooks/useHover'
import DiceSVG from '~/icons/Dice'
import ResetSVG from '~/icons/Reset'
import useTrans from '~/hooks/useTrans'

import ColorSelector from '~/widgets/ColorSelector'

import { FIELD } from '../../../constant'
import useKanban from '../../../logic/useKanban'
import SavingBar from '../../../SavingBar'
import SectionLabel from '../../../SectionLabel'
import useSalon, { cn } from '../../../salon/layout/kanban_layout/bg_colors_setter'
import ClassicLayout from './ClassicLayout'
import WaterfallLayout from './WaterfallLayout'

export default () => {
  const s = useSalon()
  const { t } = useTrans()

  const { kanbanLayout: layout, kanbanBgColors, isKanbanColorsTouched, saving, edit } = useKanban()

  const [board1Ref, isBoard1Hovered] = useHover<HTMLDivElement>()
  const [board2Ref, isBoard2Hovered] = useHover<HTMLDivElement>()
  const [board3Ref, isBoard3Hovered] = useHover<HTMLDivElement>()

  const [BG1, BG2, BG3] = isEmpty(kanbanBgColors) ? INIT_KANBAN_COLORS : kanbanBgColors

  return (
    <>
      <SectionLabel
        title={t('dsb.layout.kanban.bg.title')}
        desc={t('dsb.layout.kanban.bg.desc')}
      />

      <div className={s.colorsWrapper}>
        <div className={s.preset}>
          <ColorSelector
            activeColor={BG1}
            onChange={(color) => edit([color, BG2, BG3], 'kanbanBgColors')}
            placement='right'
            offset={[-2, 1]}
            excepts={[COLOR.CYAN, COLOR.GREEN]}
            bgMode
          >
            <div className={cn(s.colorBall, s.todoBall)} ref={board1Ref} />
          </ColorSelector>

          <ColorSelector
            activeColor={BG2}
            onChange={(color) => edit([BG1, color, BG3], 'kanbanBgColors')}
            placement='right'
            offset={[-2, 1]}
            excepts={[COLOR.CYAN, COLOR.GREEN]}
            bgMode
          >
            <div className={cn(s.colorBall, s.wipBall)} ref={board2Ref} />
          </ColorSelector>

          <ColorSelector
            activeColor={BG3}
            onChange={(color) => edit([BG1, BG2, color], 'kanbanBgColors')}
            placement='right'
            offset={[-2, 1]}
            excepts={[COLOR.CYAN, COLOR.GREEN]}
            bgMode
          >
            <div className={cn(s.colorBall, s.doneBall)} ref={board3Ref} />
          </ColorSelector>
        </div>
        <div className='grow' />
        <button className={s.action} onClick={() => edit(INIT_KANBAN_COLORS, 'kanbanBgColors')}>
          <ResetSVG className={s.resetIcon} />
          {t('dsb.layout.kanban.bg.reset')}
        </button>
        <button
          className={s.action}
          onClick={() => {
            edit(randomBgNames(3), 'kanbanBgColors')
          }}
        >
          <DiceSVG className={cn(s.resetIcon, 'size-3.5')} /> {t('dsb.layout.kanban.bg.random')}
        </button>
      </div>

      {layout === KANBAN_LAYOUT.CLASSIC ? (
        <ClassicLayout
          isBoard1Hovered={isBoard1Hovered}
          isBoard2Hovered={isBoard2Hovered}
          isBoard3Hovered={isBoard3Hovered}
        />
      ) : (
        <WaterfallLayout
          isBoard1Hovered={isBoard1Hovered}
          isBoard2Hovered={isBoard2Hovered}
          isBoard3Hovered={isBoard3Hovered}
        />
      )}

      <SavingBar
        isTouched={isKanbanColorsTouched}
        field={FIELD.KANBAN_BG_COLORS}
        loading={saving}
        top={10}
      />
    </>
  )
}
