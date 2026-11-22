import CommunityAccessDenied from '@dash/components/CommunityAccessDenied'
import DocEditorRoutePage from '@dash/components/DocEditorRoutePage'
import EditorLayout from '@dash/components/layouts/doc.editor'
import { loadDocEditorData } from '@dash/server/doc-editor'
import { validateDocEditorSearch } from '@dash/utils/route-search'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/doc/editor')({
  staleTime: 60_000,
  validateSearch: validateDocEditorSearch,
  loaderDeps: ({ search }) => ({
    docId: search.docId,
  }),
  loader: ({ deps, params }) =>
    loadDocEditorData({
      data: {
        community: params.community,
        docId: deps.docId ?? null,
      },
    }),
  component: DocEditorPage,
})

function DocEditorPage() {
  const initialData = Route.useLoaderData()

  if (initialData.accessDenied) {
    return (
      <EditorLayout>
        <CommunityAccessDenied />
      </EditorLayout>
    )
  }

  return (
    <EditorLayout>
      <DocEditorRoutePage />
    </EditorLayout>
  )
}
