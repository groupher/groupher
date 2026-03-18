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

export default function BgColorsSetter() {
  const s = useSalon()
  const { t } = useTrans()

  const { kanbanLayout: layout, kanbanBgColors, isKanbanColorsTouched, saving, edit } = useKanban()

  const [board1Ref, isBoard1Hovered] = useHover<HTMLDivElement>()
  const [board2Ref, isBoard2Hovered] = useHover<HTMLDivElement>()
  const [board3Ref, isBoard3Hovered] = useHover<HTMLDivElement>()
  const [board4Ref, isBoard4Hovered] = useHover<HTMLDivElement>()
  const [board5Ref, isBoard5Hovered] = useHover<HTMLDivElement>()

  const [BG1, BG2, BG3, BG4, BG5] =
    kanbanBgColors.length === INIT_KANBAN_COLORS.length ? kanbanBgColors : INIT_KANBAN_COLORS

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
            onChange={(color) => edit([color, BG2, BG3, BG4, BG5], 'kanbanBgColors')}
            placement='right'
            offset={[-2, 1]}
            excepts={[COLOR.CYAN]}
            bgMode
          >
            <div className={cn(s.colorBall, s.backlogBall)} ref={board1Ref} />
          </ColorSelector>

          <ColorSelector
            activeColor={BG2}
            onChange={(color) => edit([BG1, color, BG3, BG4, BG5], 'kanbanBgColors')}
            placement='right'
            offset={[-2, 1]}
            excepts={[COLOR.CYAN]}
            bgMode
          >
            <div className={cn(s.colorBall, s.todoBall)} ref={board2Ref} />
          </ColorSelector>

          <ColorSelector
            activeColor={BG3}
            onChange={(color) => edit([BG1, BG2, color, BG4, BG5], 'kanbanBgColors')}
            placement='right'
            offset={[-2, 1]}
            excepts={[COLOR.CYAN]}
            bgMode
          >
            <div className={cn(s.colorBall, s.wipBall)} ref={board3Ref} />
          </ColorSelector>

          <ColorSelector
            activeColor={BG4}
            onChange={(color) => edit([BG1, BG2, BG3, color, BG5], 'kanbanBgColors')}
            placement='right'
            offset={[-2, 1]}
            excepts={[COLOR.CYAN]}
            bgMode
          >
            <div className={cn(s.colorBall, s.doneBall)} ref={board4Ref} />
          </ColorSelector>

          <ColorSelector
            activeColor={BG5}
            onChange={(color) => edit([BG1, BG2, BG3, BG4, color], 'kanbanBgColors')}
            placement='right'
            offset={[-2, 1]}
            excepts={[COLOR.CYAN]}
            bgMode
          >
            <div className={cn(s.colorBall, s.rejectedBall)} ref={board5Ref} />
          </ColorSelector>
        </div>
        <div className='grow' />
        <button type='button' className={s.action} onClick={() => edit(INIT_KANBAN_COLORS, 'kanbanBgColors')}>
          <ResetSVG className={s.resetIcon} />
          {t('dsb.layout.kanban.bg.reset')}
        </button>
        <button
          type='button'
          className={s.action}
          onClick={() => {
            edit(randomBgNames(5, [COLOR.CYAN]), 'kanbanBgColors')
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
          isBoard4Hovered={isBoard4Hovered}
          isBoard5Hovered={isBoard5Hovered}
        />
      ) : (
        <WaterfallLayout
          isBoard1Hovered={isBoard1Hovered}
          isBoard2Hovered={isBoard2Hovered}
          isBoard3Hovered={isBoard3Hovered}
          isBoard4Hovered={isBoard4Hovered}
          isBoard5Hovered={isBoard5Hovered}
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
