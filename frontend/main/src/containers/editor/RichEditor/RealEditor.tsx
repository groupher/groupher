/*
 *
 * RichEditor
 *
 */

import type { FC } from 'react'

import TheRichEditor from '@groupher/react-editor'

import useSalon, { cn } from './salon'

type TProps = {
  placeholder?: string
  data?: string
  type?: 'article' | 'works' | 'job' | 'comment' | 'radar'
  reinitKey?: string
  onChange?: (json) => void
}

const RichEditor: FC<TProps> = ({
  data,
  placeholder = "// 正文内容（'Tab' 键插入富文本）",
  type = 'article',
  reinitKey = '',
  onChange = console.log,
}) => {
  const s = useSalon()

  // 使用模板 or 转载或翻译 or 请保持友善
  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        {/* {type !== 'comment' && <Options addon={addon} />} */}
        <div className={cn(s.editor, 'rich-editor')}>
          <TheRichEditor
            onData={onChange}
            reinitKey={reinitKey}
            data={JSON.parse(data || '{}')}
            placeholder={placeholder}
          />
        </div>
      </div>
      {/* <EditorWrapper id="codex-editor" /> */}
    </div>
  )
}

export default RichEditor
