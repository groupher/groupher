import type { TRichEditorValue } from '@groupher/rich-editor'
import type { FC } from 'react'

import RichEditor from '~/unit/RichEditor'

type TProps = {
  value: TRichEditorValue
  editorKey?: string
  onChange: (value: TRichEditorValue) => void
}

const Editor: FC<TProps> = ({ value, editorKey = '', onChange }) => {
  return <RichEditor key={editorKey} defaultValue={value} onChange={onChange} />
}

export default Editor
