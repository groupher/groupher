import type { TRichEditorValue } from '@groupher/rich-editor'
import type { FC } from 'react'

import RichEditor from '~/unit/RichEditor'

import useSalon from './salon/body'

type TProps = {
  value: TRichEditorValue
  disabled?: boolean
  editorKey?: string
  onChange: (value: TRichEditorValue) => void
}

const Body: FC<TProps> = ({ value, disabled = false, editorKey = '', onChange }) => {
  const s = useSalon()

  if (disabled) return <div className={s.wrapper} />

  return (
    <div className={s.wrapper}>
      <RichEditor key={editorKey} defaultValue={value} onChange={onChange} />
    </div>
  )
}

export default Body
