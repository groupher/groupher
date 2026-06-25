/*
 *
 * RichEditor
 *
 */

import GroupherRichEditor, {
  type TRichEditorValue,
  type TRichEditorProps as TGroupherRichEditorProps,
} from '@groupher/rich-editor'
import type { FC } from 'react'

import useSalon, { cn } from './salon'

type TProps = {
  placeholder?: string
  data?: string
  type?: 'article' | 'works' | 'job' | 'comment' | 'radar'
  reinitKey?: string
  value?: TRichEditorValue
  defaultValue?: TRichEditorValue
  onChange?: (value: TRichEditorValue) => void
  locale?: TGroupherRichEditorProps['locale']
  mentionOptions?: TGroupherRichEditorProps['mentionOptions']
  onMentionSearch?: TGroupherRichEditorProps['onMentionSearch']
  fluid?: boolean
}

const RichEditor: FC<TProps> = ({
  data: _data,
  placeholder: _placeholder = "// 正文内容（'Tab' 键插入富文本）",
  type: _type = 'article',
  reinitKey: _reinitKey = '',
  value,
  defaultValue,
  onChange,
  locale = 'zh-CN',
  mentionOptions,
  onMentionSearch,
  fluid = false,
}) => {
  const s = useSalon({ fluid })

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={cn(s.editor, 'rich-editor')}>
          <GroupherRichEditor
            value={value}
            defaultValue={defaultValue}
            locale={locale}
            mentionOptions={mentionOptions}
            onMentionSearch={onMentionSearch}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  )
}

export default RichEditor
