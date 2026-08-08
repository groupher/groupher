import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/kanban/')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/dash/kanban/content',
      params: true,
      replace: true,
    })
  },
})
