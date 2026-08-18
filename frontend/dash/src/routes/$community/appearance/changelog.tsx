import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/appearance/changelog')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/changelog',
      params: true,
    })
  },
})
