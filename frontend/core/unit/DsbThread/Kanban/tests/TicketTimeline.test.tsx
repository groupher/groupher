import { render, screen } from '@testing-library/react'

import TicketTimeline from '../TicketTimeline'

vi.mock('~/hooks/useKanbanBgColors', () => ({ default: () => ['todo', 'wip', 'done'] }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/hooks/useTwBelt', () => ({ default: () => ({ rainbow: (color: string) => color }) }))

describe('<TicketTimeline />', () => {
  it.each([
    ['', ''],
    ['2026-11-01', ''],
    ['', '2026-11-06'],
  ])('shows unscheduled state when either date is missing (%s, %s)', (startDate, endDate) => {
    render(
      <TicketTimeline
        startDate={startDate}
        endDate={endDate}
        status='TODO'
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('ticket.workbench.unscheduled')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a draggable range when both planned dates are present', () => {
    render(
      <TicketTimeline
        startDate='2026-11-01'
        endDate='2026-11-06'
        status='TODO'
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'ticket.workbench.timeline_drag' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
