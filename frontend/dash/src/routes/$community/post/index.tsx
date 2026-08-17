import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/post/')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/post/content',
      params: true,
    })
  },
})
