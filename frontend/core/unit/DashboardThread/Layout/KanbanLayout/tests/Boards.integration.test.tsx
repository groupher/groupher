import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import { KANBAN_BOARD } from '~/const/thread'
import useDashboard from '~/stores/dashboard/hooks'
import useKanban from '../../../logic/useKanban'
import Boards from '../Boards'

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({
    t: (key: string) =>
      (
        ({
          'article.state.backlog': 'Backlog',
          'article.state.todo': 'Todo',
          'article.state.wip': 'In progress',
          REJECTED: 'Rejected',
          'article.state.done': 'Done',
        }) as Record<string, string>
      )[key] || key,
  }),
}))

vi.mock('~/hooks/useDsbDemoMode', () => ({
  default: () => false,
}))

vi.mock('~/hooks/useDsbTab', () => ({
  default: () => ({ subTab: 'basic' }),
}))

vi.mock('~/hooks/useGraphQLClient', () => ({
  default: () => ({
    mutate: vi.fn(),
    query: vi.fn(),
  }),
}))

function Probe() {
  const { kanbanBoards, original } = useDashboard()
  const { isKanbanBoardsTouched } = useKanban()

  return (
    <pre data-testid='probe'>
      {JSON.stringify({ kanbanBoards, original: original.kanbanBoards, isKanbanBoardsTouched })}
    </pre>
  )
}

describe('<Boards /> integration', () => {
  it('shows saving bar after kanban boards change', async () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        kanbanBoards: [KANBAN_BOARD.TODO, KANBAN_BOARD.WIP, KANBAN_BOARD.DONE],
      },
    })

    render(
      <>
        <Boards />
        <Probe />
      </>,
      { wrapper },
    )

    expect(screen.queryByText('dsb.saving_bar.save')).not.toBeInTheDocument()
    expect(screen.getByTestId('probe')).toHaveTextContent('"isKanbanBoardsTouched":false')

    fireEvent.click(screen.getByRole('button', { name: /Todo/i }))

    await waitFor(() => {
      expect(screen.getByTestId('probe')).toHaveTextContent('"kanbanBoards":["wip","done"]')
      expect(screen.getByTestId('probe')).toHaveTextContent('"isKanbanBoardsTouched":true')
      expect(screen.getByText('dsb.saving_bar.save')).toBeInTheDocument()
      expect(screen.getByText('dsb.saving_bar.cancel')).toBeInTheDocument()
    })
  })

  it('clears touched state after toggling a board off and back on', async () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        kanbanBoards: [KANBAN_BOARD.TODO, KANBAN_BOARD.WIP, KANBAN_BOARD.DONE],
      },
    })

    render(
      <>
        <Boards />
        <Probe />
      </>,
      { wrapper },
    )

    fireEvent.click(screen.getByRole('button', { name: /Todo/i }))

    await waitFor(() => {
      expect(screen.getByTestId('probe')).toHaveTextContent('"kanbanBoards":["wip","done"]')
      expect(screen.getByTestId('probe')).toHaveTextContent('"isKanbanBoardsTouched":true')
    })

    fireEvent.click(screen.getByRole('button', { name: /Todo/i }))

    await waitFor(() => {
      expect(screen.getByTestId('probe')).toHaveTextContent('"kanbanBoards":["todo","wip","done"]')
      expect(screen.getByTestId('probe')).toHaveTextContent('"isKanbanBoardsTouched":false')
    })
  })
})
