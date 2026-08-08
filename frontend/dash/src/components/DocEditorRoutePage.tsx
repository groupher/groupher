import type { TDocEditorInitialData } from '@dash/server/doc-editor'

import Editor from '~/unit/DashboardThread/CMS/Docs/Editor'

type TProps = {
  initialData: TDocEditorInitialData
}

export default function DocEditorRoutePage({ initialData }: TProps) {
  return <Editor initialData={initialData} />
}
