import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/appearance/post')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/dash/post/content',
      params: true,
    })
  },
})
