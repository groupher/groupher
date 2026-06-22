import type { TRichEditorValue } from '@groupher/rich-editor'
import type { FC } from 'react'

import { DOC_EDITOR_MODE, type TDocEditorMode } from '../../constant'
import Editor from './Editor'
import Preview from './Preview'
import useSalon from './salon'

type TProps = {
  value: TRichEditorValue
  mode: TDocEditorMode
  disabled?: boolean
  editorKey?: string
  onChange: (value: TRichEditorValue) => void
}

const Body: FC<TProps> = ({ value, mode, disabled = false, editorKey = '', onChange }) => {
  const s = useSalon()

  if (disabled) return <div className={s.wrapper} />

  return (
    <div className={s.wrapper}>
      {mode === DOC_EDITOR_MODE.PREVIEW ? (
        <Preview value={value} />
      ) : (
        <Editor editorKey={editorKey} value={value} onChange={onChange} />
      )}
    </div>
  )
}

export default Body
