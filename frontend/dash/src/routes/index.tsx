import { loadDefaultCommunity } from '@dash/server/default-community'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const community = await loadDefaultCommunity()
    throw redirect({
      to: '/$community/overview',
      params: { community },
    })
  },
})
