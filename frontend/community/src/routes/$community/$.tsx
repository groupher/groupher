import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/$')({
  beforeLoad: () => {
    throw notFound()
  },
  component: () => null,
})
