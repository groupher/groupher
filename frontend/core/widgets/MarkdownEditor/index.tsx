import {
  type ChangeEvent,
  type FC,
  type KeyboardEvent,
  memo,
  useCallback,
  useRef,
  useState,
} from 'react'
import TextareaAutosize from 'react-textarea-autosize'

import useTrans from '~/hooks/useTrans'
import type { TSpace } from '~/spec'
import Markdown from '~/widgets/Markdown'

import { TAB } from './constant'
import type { TFormat } from './constant'
import useSalon, { cn } from './salon'
import type { TTab } from './spec'
import useFormats from './useFormats'
import { continueListOnEnter, safeValue } from './utils'

export type TProps = {
  value?: string
  placeholder?: string
  className?: string
  textareaClassName?: string
  previewClassName?: string
  minRows?: number
  maxRows?: number
  autoFocus?: boolean
  disabled?: boolean
  writeLabel?: string
  previewLabel?: string
  onChange?: (value: string, e?: ChangeEvent<HTMLTextAreaElement>) => void
} & TSpace

const MarkdownEditor: FC<TProps> = ({
  value = '',
  placeholder,
  className = '',
  textareaClassName = '',
  previewClassName = '',
  minRows = 7,
  maxRows,
  autoFocus = false,
  disabled = false,
  writeLabel,
  previewLabel,
  onChange,
  ...spacing
}) => {
  const s = useSalon({ className, ...spacing })
  const { t } = useTrans()
  const formats = useFormats()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<TTab>(TAB.WRITE)

  const writeLabelTxt = writeLabel ?? t('widgets.markdown_editor.tab.write')
  const previewLabelTxt = previewLabel ?? t('widgets.markdown_editor.tab.preview')
  const placeholderTxt = placeholder ?? t('widgets.markdown_editor.placeholder.input')
  const listTriggerFormat = formats[6]
  const listOptionFormats = formats.slice(7)

  const updateSelection = useCallback((start: number, end: number) => {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return

      textarea.focus()
      textarea.setSelectionRange(start, end)
    })
  }, [])

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value, e),
    [onChange],
  )

  const handleFormat = useCallback(
    (format: TFormat) => {
      const textarea = textareaRef.current
      if (!textarea || disabled) return

      const update = format.action(textarea)
      onChange?.(update.value)
      updateSelection(update.start, update.end)
    },
    [disabled, onChange, updateSelection],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (disabled || e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.nativeEvent.isComposing) return

      const update = continueListOnEnter(e.currentTarget)
      if (!update) return

      e.preventDefault()
      onChange?.(update.value)
      updateSelection(update.start, update.end)
    },
    [disabled, onChange, updateSelection],
  )

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.tabs}>
          <button
            className={cn(s.tab, tab === TAB.WRITE ? s.tabActive : s.tabInactive)}
            type='button'
            onClick={() => setTab(TAB.WRITE)}
          >
            {writeLabelTxt}
          </button>
          <button
            className={cn(s.tab, tab === TAB.PREVIEW ? s.tabActive : s.tabInactive)}
            type='button'
            onClick={() => setTab(TAB.PREVIEW)}
          >
            {previewLabelTxt}
          </button>
        </div>

        <div className={s.toolbar}>
          {formats.slice(0, 6).map((format) => (
            <button
              aria-label={format.hint}
              className={cn(s.toolButton, format.className)}
              disabled={disabled || tab === TAB.PREVIEW}
              key={format.hint}
              title={format.hint}
              type='button'
              onClick={() => handleFormat(format)}
            >
              {format.label}
            </button>
          ))}

          {listTriggerFormat && (
            <div className={s.listGroup}>
              <button
                aria-label={listTriggerFormat.hint}
                className={cn(s.toolButton, s.listTrigger, listTriggerFormat.className)}
                disabled={disabled || tab === TAB.PREVIEW}
                title={listTriggerFormat.hint}
                type='button'
                onClick={() => handleFormat(listTriggerFormat)}
              >
                {listTriggerFormat.label}
              </button>

              <div className={s.listOptions}>
                {listOptionFormats.map((format) => (
                  <button
                    aria-label={format.hint}
                    className={cn(s.toolButton, format.className)}
                    disabled={disabled || tab === TAB.PREVIEW}
                    key={format.hint}
                    title={format.hint}
                    type='button'
                    onClick={() => handleFormat(format)}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={s.body}>
        {tab === TAB.WRITE ? (
          <TextareaAutosize
            autoFocus={autoFocus}
            className={cn(s.textarea, textareaClassName)}
            disabled={disabled}
            maxRows={maxRows}
            minRows={minRows}
            placeholder={placeholderTxt}
            ref={textareaRef}
            spellCheck='false'
            value={safeValue(value)}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div className={cn(s.preview, previewClassName)}>
            {safeValue(value) ? <Markdown>{value}</Markdown> : <div className={s.emptyPreview} />}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(MarkdownEditor)
