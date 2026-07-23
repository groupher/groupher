/*
 *
 * RichEditor
 *
 */

import GroupherRichEditor, {
  type TRichEditorHandle,
  type TRichEditorValue,
  type TRichEditorProps as TGroupherRichEditorProps,
} from '@groupher/rich-editor'
import { forwardRef } from 'react'

import useSalon, { cn } from './salon'

type TProps = {
  placeholder?: string
  data?: string
  type?: 'article' | 'works' | 'job' | 'comment' | 'radar'
  reinitKey?: string
  defaultValue?: TRichEditorValue
  onChange?: (value: TRichEditorValue) => void
  locale?: TGroupherRichEditorProps['locale']
  mentionOptions?: TGroupherRichEditorProps['mentionOptions']
  onMentionSearch?: TGroupherRichEditorProps['onMentionSearch']
  fluid?: boolean
}

const RichEditor = forwardRef<TRichEditorHandle, TProps>(function RichEditor(
  {
    data: _data,
    placeholder: _placeholder = "// 正文内容（'Tab' 键插入富文本）",
    type: _type = 'article',
    reinitKey: _reinitKey = '',
    defaultValue,
    onChange,
    locale = 'zh-CN',
    mentionOptions,
    onMentionSearch,
    fluid = false,
  },
  ref,
) {
  const s = useSalon({ fluid })

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={cn(s.editor, 'rich-editor')}>
          <GroupherRichEditor
            ref={ref}
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
})

export default RichEditor
