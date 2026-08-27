import type { TRichEditorHandle, TRichEditorValue } from '@groupher/rich-editor'
import { forwardRef } from 'react'

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

const Body = forwardRef<TRichEditorHandle, TProps>(function Body(
  { value, mode, disabled = false, editorKey = '', onChange },
  ref,
) {
  const s = useSalon()
  const previewVisible = mode === DOC_EDITOR_MODE.PREVIEW || disabled

  return (
    <div className={s.wrapper}>
      <div className={previewVisible ? 'hidden' : undefined}>
        <Editor ref={ref} editorKey={editorKey} value={value} onChange={onChange} />
      </div>
      {previewVisible ? <Preview value={value} /> : null}
      {disabled && <div className={s.disabledMask} />}
    </div>
  )
})

export default Body
