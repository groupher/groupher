import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/appearance/doc')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/dash/doc/layout/cover',
      params: true,
    })
  },
})
