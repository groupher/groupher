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
        docFaq: {
          title: 'FAQ',
          desc: '',
          grouped: false,
          groups: [],
        },
        mediaReports: [],
        headerLinks: [],
        footerLinks: [],
        layout: {
          kanbanBoards: ['TODO', 'WIP', 'DONE'],
        },
      },
    } as unknown as TCommunity)

    expect(dashboard.kanbanBoards).toEqual([KANBAN_BOARD.TODO, KANBAN_BOARD.WIP, KANBAN_BOARD.DONE])
    expect(dashboard.original.kanbanBoards).toEqual([
      KANBAN_BOARD.TODO,
      KANBAN_BOARD.WIP,
      KANBAN_BOARD.DONE,
    ])
  })
})
