import { createFileRoute } from '@tanstack/react-router'

import ArticleEditor from '~/unit/DsbThread/Broadcast/Editor/Article'

export const Route = createFileRoute('/$community/broadcast/article')({
  component: BroadcastArticlePage,
})

function BroadcastArticlePage() {
  return <ArticleEditor />
}
