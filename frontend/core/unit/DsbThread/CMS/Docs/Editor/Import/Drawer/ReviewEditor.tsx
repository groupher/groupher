import type { TRichEditorValue } from '@groupher/rich-editor'
import type { FC } from 'react'

import RichEditor from '~/unit/RichEditor'

import useSalon from './salon/review_editor'

type TProps = {
  defaultValue: TRichEditorValue
  onChange: (value: TRichEditorValue) => void
}

const ReviewEditor: FC<TProps> = ({ defaultValue, onChange }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <RichEditor fluid defaultValue={defaultValue} onChange={onChange} />
    </div>
  )
}

export default ReviewEditor
