'use client'

import type { TRichEditorValue } from '@groupher/rich-editor'
import { RichEditorStatic as RichEditorStaticBase } from '@groupher/rich-editor/static'
import type { FC } from 'react'

import useSalon from './salon/static'

type TProps = {
  value: TRichEditorValue
}

const RichEditorStatic: FC<TProps> = ({ value }) => {
  const s = useSalon()

  return <RichEditorStaticBase value={value} className={s.wrapper} />
}

export default RichEditorStatic
