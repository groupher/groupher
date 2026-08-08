import AuthRequired from '@dash/components/AuthRequired'
import DocEditorRoutePage from '@dash/components/DocEditorRoutePage'
import EditorLayout from '@dash/components/layouts/doc.editor'
import { loadDocEditorData } from '@dash/server/doc-editor'
import { createFileRoute } from '@tanstack/react-router'

import { DOC_EDITOR_QUERY_PARAM } from '~/unit/DashboardThread/CMS/Docs/Editor/constant'

export const Route = createFileRoute('/$community/dash/doc/editor')({
  staleTime: 60_000,
  loader: ({ location, params }) =>
    loadDocEditorData({
      data: {
        community: params.community,
        docId: new URLSearchParams(location.search).get(DOC_EDITOR_QUERY_PARAM.DOC_ID),
      },
    }),
  component: DocEditorPage,
})

function DocEditorPage() {
  const initialData = Route.useLoaderData()

  if (initialData.authRequired) {
    return (
      <EditorLayout>
        <AuthRequired action='edit documentation' />
      </EditorLayout>
    )
  }

  return (
    <EditorLayout>
      <DocEditorRoutePage initialData={initialData} />
    </EditorLayout>
  )
}
