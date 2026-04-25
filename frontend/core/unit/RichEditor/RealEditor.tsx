/*
 *
 * RichEditor
 *
 */

import type { FC } from 'react'

import useSalon, { cn } from './salon'

type TProps = {
  placeholder?: string
  data?: string
  type?: 'article' | 'works' | 'job' | 'comment' | 'radar'
  reinitKey?: string
  onChange?: (json) => void
}

const RichEditor: FC<TProps> = ({
  _data,
  _placeholder = "// 正文内容（'Tab' 键插入富文本）",
  _type = 'article',
  _reinitKey = '',
  _onChange = console.log,
}) => {
  const s = useSalon()

  // 使用模板 or 转载或翻译 or 请保持友善
  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        {/* {type !== 'comment' && <Options addon={addon} />} */}
        <div className={cn(s.editor, 'rich-editor')}>
          <h2>Rich Editor</h2>
        </div>
      </div>
      {/* <EditorWrapper id="codex-editor" /> */}
    </div>
  )
}

export default RichEditor
