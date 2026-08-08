import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/appearance/kanban')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/dash/kanban/layout',
      params: true,
    })
  },
})
