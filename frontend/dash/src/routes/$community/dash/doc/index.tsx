import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/doc/')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/dash/doc/editor',
      params: true,
    })
  },
})
