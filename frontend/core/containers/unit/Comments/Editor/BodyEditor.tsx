import { type FC, memo } from 'react'

import RichEditor from '~/containers/editor/RichEditor'
import useTrans from '~/hooks/useTrans'

type TProps = {
  body?: string
  onChange?: (v: string) => void
  placeholder?: string
}

const CommentBodyEditor: FC<TProps> = ({
  body,
  onChange,
  placeholder,
}) => {
  const { t } = useTrans()
  const resolvedPlaceholder = placeholder ?? t('comment.editor.placeholder')

  return (
    <div className="comment-editor">
      {/* @ts-ignore */}
      <RichEditor
        data={body}
        type="comment"
        placeholder={resolvedPlaceholder}
        onChange={(v) => onChange(JSON.stringify(v))}
      />
    </div>
  )
}

export default memo(CommentBodyEditor)
