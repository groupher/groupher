import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/changelog/')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/changelog/content',
      params: true,
    })
  },
})
