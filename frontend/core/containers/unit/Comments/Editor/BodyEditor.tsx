import { type FC, memo } from 'react'

type TProps = {
  body?: string
  onChange?: (v: string) => void
  placeholder?: string
}

const CommentBodyEditor: FC<TProps> = (_props) => {
  return (
    <div className="comment-editor">
      <h2>todo</h2>
    </div>
  )
}

export default memo(CommentBodyEditor)
