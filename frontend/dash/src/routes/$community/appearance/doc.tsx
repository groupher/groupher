import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/appearance/doc')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/doc/layout/cover',
      params: true,
    })
  },
})
