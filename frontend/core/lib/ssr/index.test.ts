import { KANBAN_BOARD } from '~/const/thread'
import type { TCommunity } from '~/spec'
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
    } satisfies Partial<TCommunity> as TCommunity)

    expect(dashboard.kanbanBoards).toEqual([KANBAN_BOARD.TODO, KANBAN_BOARD.WIP, KANBAN_BOARD.DONE])
    expect(dashboard.original.kanbanBoards).toEqual([
      KANBAN_BOARD.TODO,
      KANBAN_BOARD.WIP,
      KANBAN_BOARD.DONE,
    ])
  })
})
