import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/doc/layout/')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/doc/layout/cover',
      params: true,
    })
  },
})
