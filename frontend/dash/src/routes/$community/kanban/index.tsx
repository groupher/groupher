import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/kanban/')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/kanban/content',
      params: true,
      replace: true,
    })
  },
})
