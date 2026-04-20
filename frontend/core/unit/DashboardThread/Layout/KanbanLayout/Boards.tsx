import { INIT_KANBAN_BOARDS } from '~/const/dashboard'
import { KANBAN_BOARD } from '~/const/thread'
import usePrimaryColor from '~/hooks/usePrimaryColor'
import useTrans from '~/hooks/useTrans'
import useTwBelt from '~/hooks/useTwBelt'
import CheckedSVG from '~/icons/CheckBold'
import type { TKanbanBoard } from '~/spec'
import { FIELD } from '../../constant'
import useKanban from '../../logic/useKanban'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon from '../../salon/layout/kanban_layout/boards'

export default function Boards() {
  const s = useSalon()
  const { t } = useTrans()
  const primaryColor = usePrimaryColor()
  const { cn, fg, fill, rainbow } = useTwBelt()
  const { kanbanBoards, isKanbanBoardsTouched: isTouched, edit } = useKanban()
  const activeBoards = kanbanBoards.length > 0 ? kanbanBoards : INIT_KANBAN_BOARDS

  const boards = [
    { value: KANBAN_BOARD.BACKLOG, title: t('article.state.backlog') },
    { value: KANBAN_BOARD.TODO, title: t('article.state.todo') },
    { value: KANBAN_BOARD.WIP, title: t('article.state.wip') },
    { value: KANBAN_BOARD.REJECTED, title: t('REJECTED') },
    { value: KANBAN_BOARD.DONE, title: t('article.state.done') },
  ] as const
  const boardOrder = boards.map(({ value }) => value)

  const handleToggle = (board: TKanbanBoard) => {
    const toggledBoards = activeBoards.includes(board)
      ? activeBoards.filter((item) => item !== board)
      : [...activeBoards, board]
    const nextBoards = boardOrder.filter((item) => toggledBoards.includes(item))

    edit(nextBoards, FIELD.KANBAN_BOARDS)
  }

  return (
    <>
      <SectionLabel
        title={t('dsb.layout.kanban.global.title')}
        desc={t('dsb.layout.kanban.global.desc')}
      />
      <div className={s.select}>
        {boards.map(({ title, value }) => (
          <button
            key={value}
            type='button'
            className={s.block}
            aria-pressed={activeBoards.includes(value)}
            onClick={() => handleToggle(value)}
          >
            <div
              className={cn(
                s.box,
                activeBoards.includes(value) ? rainbow(primaryColor, 'bg') : 'bg-transparent',
                rainbow(primaryColor, 'border'),
              )}
            >
              <CheckedSVG
                className={cn(
                  'size-3.5',
                  activeBoards.includes(value) ? fill('button.fg') : 'hidden',
                )}
              />
            </div>
            <span
              className={cn(
                'size-sm ml-2',
                activeBoards.includes(value) ? fg('title') : fg('digest'),
              )}
            >
              {title}
            </span>
          </button>
        ))}
      </div>

      <SavingBar
        isTouched={isTouched}
        field={FIELD.KANBAN_BOARDS}
       
        top={8}
        bottom={20}
      />
    </>
  )
}
