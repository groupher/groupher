import { KANBAN_BOARD } from '~/const/thread'
import { parseDashboard } from '.'

describe('parseDashboard', () => {
  it('keeps uppercase kanban board enums aligned with GraphQL values', () => {
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
