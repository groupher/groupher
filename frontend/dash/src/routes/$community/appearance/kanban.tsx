import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/appearance/kanban')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/kanban/layout',
      params: true,
    })
  },
})
