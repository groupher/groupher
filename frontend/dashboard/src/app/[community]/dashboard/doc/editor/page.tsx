import Editor from '~/unit/DashboardThread/CMS/Docs/Editor'
import { DOC_EDITOR_QUERY_PARAM } from '~/unit/DashboardThread/CMS/Docs/Editor/constant'

import { getDocEditorInitialData, getSearchValue } from './helper'

export default async function DashboardDocEditorPage({ params, searchParams }) {
  const params$ = await params
  const searchParams$ = await searchParams
  const workspaceId = getSearchValue(searchParams$?.[DOC_EDITOR_QUERY_PARAM.WORKSPACE_ID])
  const initialData = await getDocEditorInitialData(params$.community, workspaceId)

  return <Editor initialData={initialData} />
}
