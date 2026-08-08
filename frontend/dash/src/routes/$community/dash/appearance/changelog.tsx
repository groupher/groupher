import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/appearance/changelog')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/dash/changelog',
      params: true,
    })
  },
})
