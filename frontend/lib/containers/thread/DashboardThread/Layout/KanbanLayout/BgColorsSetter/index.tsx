import { isEmpty } from 'ramda'

import { COLOR_NAME } from '~/const/colors'
import { KANBAN_LAYOUT } from '~/const/layout'
import { randomBgNames } from '~/helper'
import useHover from '~/hooks/useHover'

import { INIT_KANBAN_COLORS } from '~/const/dashboard'

import ResetSVG from '~/icons/Reset'
import DiceSVG from '~/icons/Dice'

import ColorSelector from '~/widgets/ColorSelector'

import { SETTING_FIELD } from '../../../constant'
import SectionLabel from '../../../SectionLabel'
import SavingBar from '../../../SavingBar'

import ClassicLayout from './ClassicLayout'
import WaterfallLayout from './WaterfallLayout'

import useKanban from '../../../logic/useKanban'

import useSalon, { cn } from '../../../salon/layout/kanban_layout/bg_colors_setter'

export default () => {
  const s = useSalon()

  const { kanbanLayout: layout, kanbanBgColors, getKanbanColorsTouched, saving, edit } = useKanban()

  const [board1Ref, isBoard1Hovered] = useHover<HTMLDivElement>()
  const [board2Ref, isBoard2Hovered] = useHover<HTMLDivElement>()
  const [board3Ref, isBoard3Hovered] = useHover<HTMLDivElement>()

  const isBgColorsTouched = getKanbanColorsTouched()
  const [BG1, BG2, BG3] = isEmpty(kanbanBgColors) ? INIT_KANBAN_COLORS : kanbanBgColors

  return (
    <>
      <SectionLabel title="看板背景色" desc="看板页面每列的背景版颜色，默认为浅灰色。" />

      <div className={s.colorsWrapper}>
        <div className={s.preset}>
          <ColorSelector
            activeColor={BG1}
            onChange={(color) => edit([color, BG2, BG3], 'kanbanBgColors')}
            placement="right"
            offset={[-2, 1]}
            excepts={[COLOR_NAME.CYAN, COLOR_NAME.GREEN]}
            bgMode
          >
            <div className={cn(s.colorBall, s.todoBall)} ref={board1Ref} />
          </ColorSelector>

          <ColorSelector
            activeColor={BG2}
            onChange={(color) => edit([BG1, color, BG3], 'kanbanBgColors')}
            placement="right"
            offset={[-2, 1]}
            excepts={[COLOR_NAME.CYAN, COLOR_NAME.GREEN]}
            bgMode
          >
            <div className={cn(s.colorBall, s.wipBall)} ref={board2Ref} />
          </ColorSelector>

          <ColorSelector
            activeColor={BG3}
            onChange={(color) => edit([BG1, BG2, color], 'kanbanBgColors')}
            placement="right"
            offset={[-2, 1]}
            excepts={[COLOR_NAME.CYAN, COLOR_NAME.GREEN]}
            bgMode
          >
            <div className={cn(s.colorBall, s.doneBall)} ref={board3Ref} />
          </ColorSelector>
        </div>
        <div className="grow" />
        <div className={s.action} onClick={() => edit(INIT_KANBAN_COLORS, 'kanbanBgColors')}>
          <ResetSVG className={s.resetIcon} />
          重置
        </div>
        <div
          className={s.action}
          onClick={() => {
            edit(randomBgNames(3), 'kanbanBgColors')
          }}
        >
          <DiceSVG className={cn(s.resetIcon, 'size-3.5')} /> 随缘
        </div>
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
        isTouched={isBgColorsTouched}
        field={SETTING_FIELD.KANBAN_BG_COLORS}
        loading={saving}
        top={10}
      />
    </>
  )
}
