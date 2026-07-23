import {
  RichEditorDiff as GroupherRichEditorDiff,
  type TRichEditorDiffValue,
} from '@groupher/rich-editor/diff-viewer'
import type { FC } from 'react'

type TProps = {
  diffValue: TRichEditorDiffValue
}

const RichEditorDiff: FC<TProps> = ({ diffValue }) => (
  <GroupherRichEditorDiff diffValue={diffValue} locale='zh-CN' />
)

export default RichEditorDiff
