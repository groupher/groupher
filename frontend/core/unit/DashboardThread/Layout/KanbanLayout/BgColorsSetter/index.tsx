import { useState } from 'react'
import { COLOR } from '~/const/colors'
import { INIT_KANBAN_COLORS } from '~/const/dashboard'
import { KANBAN_LAYOUT } from '~/const/layout'
import { KANBAN_BOARD } from '~/const/thread'
import { randomBgNames } from '~/helper'
import useTrans from '~/hooks/useTrans'
import DiceSVG from '~/icons/Dice'
import ResetSVG from '~/icons/Reset'
import type { TColorName } from '~/spec'

import ColorSelector from '~/widgets/ColorSelector'

import { FIELD } from '../../../constant'
import useKanban from '../../../logic/useKanban'
import SavingBar from '../../../SavingBar'
import SectionLabel from '../../../SectionLabel'
import useSalon, { cn } from '../../../salon/layout/kanban_layout/bg_colors_setter'
import ClassicLayout from './ClassicLayout'
import WaterfallLayout from './WaterfallLayout'

const BOARD_ORDER = [
  KANBAN_BOARD.BACKLOG,
  KANBAN_BOARD.TODO,
  KANBAN_BOARD.WIP,
  KANBAN_BOARD.DONE,
  KANBAN_BOARD.REJECTED,
] as const

const BOARD_COLOR_KEY = {
  [KANBAN_BOARD.BACKLOG]: 'backlogBall',
  [KANBAN_BOARD.TODO]: 'todoBall',
  [KANBAN_BOARD.WIP]: 'wipBall',
  [KANBAN_BOARD.DONE]: 'doneBall',
  [KANBAN_BOARD.REJECTED]: 'rejectedBall',
} as const

export default function BgColorsSetter() {
  const s = useSalon()
  const { t } = useTrans()
  const [hoveredBoard, setHoveredBoard] = useState<string | null>(null)

  const {
    kanbanLayout: layout,
    kanbanBoards,
    kanbanBgColors,
    isKanbanColorsTouched,
    saving,
    edit,
  } = useKanban()

  const colors =
    kanbanBgColors.length === INIT_KANBAN_COLORS.length ? kanbanBgColors : INIT_KANBAN_COLORS
  const activeBoards =
    kanbanBoards.length > 0
      ? kanbanBoards
      : [KANBAN_BOARD.TODO, KANBAN_BOARD.WIP, KANBAN_BOARD.DONE]
  const activeBoardConfigs = activeBoards.map((board) => ({
    board,
    index: BOARD_ORDER.indexOf(board),
    color: colors[BOARD_ORDER.indexOf(board)],
  }))

  const patchBoardColor = (board: string, color: TColorName) => {
    const index = BOARD_ORDER.indexOf(board as (typeof BOARD_ORDER)[number])
    if (index < 0) return

    const nextColors = [...colors]
    nextColors[index] = color
    edit(nextColors, FIELD.KANBAN_BG_COLORS)
  }

  const resetEnabledBoards = () => {
    const nextColors = [...colors]

    activeBoards.forEach((board) => {
      const index = BOARD_ORDER.indexOf(board)
      nextColors[index] = INIT_KANBAN_COLORS[index]
    })

    edit(nextColors, FIELD.KANBAN_BG_COLORS)
  }

  const randomizeEnabledBoards = () => {
    const nextColors = [...colors]
    const randomColors = randomBgNames(activeBoards.length, [COLOR.CYAN])

    activeBoards.forEach((board, idx) => {
      const index = BOARD_ORDER.indexOf(board)
      nextColors[index] = randomColors[idx]
    })

    edit(nextColors, FIELD.KANBAN_BG_COLORS)
  }

  return (
    <>
      <SectionLabel title={t('dsb.layout.kanban.bg.title')} desc={t('dsb.layout.kanban.bg.desc')} />

      <div className={s.colorsWrapper}>
        <div className={s.preset}>
          {activeBoardConfigs.map(({ board, color }) => (
            <ColorSelector
              key={board}
              activeColor={color}
              onChange={(nextColor) => patchBoardColor(board, nextColor)}
              placement='right'
              offset={[-2, 1]}
              excepts={[COLOR.CYAN]}
            >
              <div
                className={cn(s.colorBall, s[BOARD_COLOR_KEY[board]])}
                onMouseEnter={() => setHoveredBoard(board)}
                onMouseLeave={() => setHoveredBoard(null)}
              />
            </ColorSelector>
          ))}
        </div>
        <div className='grow' />
        <button type='button' className={s.action} onClick={resetEnabledBoards}>
          <ResetSVG className={s.resetIcon} />
          {t('dsb.layout.kanban.bg.reset')}
        </button>
        <button type='button' className={s.action} onClick={randomizeEnabledBoards}>
          <DiceSVG className={cn(s.resetIcon, 'size-3.5')} /> {t('dsb.layout.kanban.bg.random')}
        </button>
      </div>

      {layout === KANBAN_LAYOUT.CLASSIC ? (
        <ClassicLayout activeBoards={activeBoards} hoveredBoard={hoveredBoard} />
      ) : (
        <WaterfallLayout activeBoards={activeBoards} hoveredBoard={hoveredBoard} />
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
