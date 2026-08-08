import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/')({
  beforeLoad: () => {
    throw redirect({
      to: '/$community/dash/overview',
      params: true,
    })
  },
})
