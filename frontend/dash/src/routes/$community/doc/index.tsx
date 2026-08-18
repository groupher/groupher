import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/doc/')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/doc/editor',
      params: true,
    })
  },
})
