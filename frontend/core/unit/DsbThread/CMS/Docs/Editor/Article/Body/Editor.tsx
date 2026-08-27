import type { TRichEditorHandle, TRichEditorValue } from '@groupher/rich-editor'
import { forwardRef } from 'react'

import RichEditor from '~/unit/RichEditor'

type TProps = {
  value: TRichEditorValue
  editorKey?: string
  onChange: (value: TRichEditorValue) => void
}

const Editor = forwardRef<TRichEditorHandle, TProps>(function Editor(
  { value, editorKey = '', onChange },
  ref,
) {
  return <RichEditor key={editorKey} ref={ref} fluid defaultValue={value} onChange={onChange} />
})

export default Editor
