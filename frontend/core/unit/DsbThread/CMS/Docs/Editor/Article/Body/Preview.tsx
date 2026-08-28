import type { TRichEditorValue } from '@groupher/rich-editor'
import { PlateView, usePlateViewEditor } from '@platejs/core/react'
import type { FC } from 'react'

import useSalon from './salon/preview'

type TProps = {
  value: TRichEditorValue
}

const Preview: FC<TProps> = ({ value }) => {
  const s = useSalon()
  const editor = usePlateViewEditor({ value }, [value])

  return <PlateView editor={editor} value={value} className={s.wrapper} />
}

export default Preview
