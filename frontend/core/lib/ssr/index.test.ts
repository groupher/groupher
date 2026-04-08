import { KANBAN_BOARD } from '~/const/thread'
import { parseDashboard } from '.'

describe('parseDashboard', () => {
  it('normalizes uppercase kanban board enums from GraphQL into lowercase store values', () => {
    const dashboard = parseDashboard({
      slug: 'acme',
      threads: [],
      dashboard: {
        nameAlias: [],
        socialLinks: [],
        faqs: [],
        mediaReports: [],
        headerLinks: [],
        footerLinks: [],
        layout: {
          kanbanBoards: ['TODO', 'WIP', 'DONE'],
        },
      },
    } as any)

    expect(dashboard.kanbanBoards).toEqual([KANBAN_BOARD.TODO, KANBAN_BOARD.WIP, KANBAN_BOARD.DONE])
    expect(dashboard.original.kanbanBoards).toEqual([
      KANBAN_BOARD.TODO,
      KANBAN_BOARD.WIP,
      KANBAN_BOARD.DONE,
    ])
  })
})
