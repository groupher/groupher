import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/changelog/')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/dash/changelog/content',
      params: true,
    })
  },
})
