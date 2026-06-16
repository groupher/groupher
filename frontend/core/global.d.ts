declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '@groupher/rich-editor' {
  import type { ComponentType } from 'react'

  export type TRichEditorValue = Array<Record<string, unknown>>

  export type TRichEditorProps = {
    value?: TRichEditorValue
    defaultValue?: TRichEditorValue
    onChange?: (value: TRichEditorValue) => void
    className?: string
    debugMode?: boolean
    locale?: 'en' | 'zh-CN'
    mentionOptions?: Array<{ value: string; label?: string; group?: string; keywords?: string[] }>
    onMentionSearch?: (query: string) => void
  }

  const RichEditor: ComponentType<TRichEditorProps>
  export default RichEditor
}
