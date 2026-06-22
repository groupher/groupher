import type { FC, SVGProps } from 'react'

import EditPenSVG from '~/icons/EditPen'
import JoinEyeSVG from '~/icons/JoinEye'
import type { TTransKey } from '~/spec'

import { DOC_EDITOR_MODE, type TDocEditorMode } from '../../Editor/constant'

type TModeItem = {
  key: TDocEditorMode
  label: TTransKey
  Icon: FC<SVGProps<SVGSVGElement>>
}

export const MODE_ITEMS: readonly TModeItem[] = [
  { key: DOC_EDITOR_MODE.EDIT, label: 'dsb.doc.action.edit', Icon: EditPenSVG },
  { key: DOC_EDITOR_MODE.PREVIEW, label: 'dsb.doc.action.preview', Icon: JoinEyeSVG },
]
