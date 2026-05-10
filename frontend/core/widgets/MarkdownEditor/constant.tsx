import type { ReactNode } from 'react'

import CodePhosphorSVG from '~/icons/CodePhosphor'
import LinkSVG from '~/icons/Link'
import ListSVG from '~/icons/ListBullets'
import ListBulletsSVG from '~/icons/ListBullets'
import ListChecksSVG from '~/icons/ListChecks'
import ListNumbersSVG from '~/icons/ListNumbers'
import QuotesSVG from '~/icons/Quotes'
import TextBSVG from '~/icons/TextB'
import TextItalicSVG from '~/icons/TextItalic'
import type { TTransKey } from '~/spec'

import type { TTab } from './spec'
import { applyLinePrefix, applyOrderedList, applyWrap } from './utils'
import type { TSelectionUpdate } from './utils'

export const TAB = {
  WRITE: 'write',
  PREVIEW: 'preview',
} as const satisfies Record<string, TTab>

type TActionMeta = {
  heading: string
  bold: string
  italic: string
  quote: string
  code: string
  linkText: string
  listItem: string
  taskItem: string
}

export type TFormat = {
  label: ReactNode
  hint: string
  action: (textarea: HTMLTextAreaElement) => TSelectionUpdate
  className?: string
}

export type TFormatConfig = {
  label: ReactNode
  hintKey: TTransKey
  action: (textarea: HTMLTextAreaElement, meta: TActionMeta) => TSelectionUpdate
  className?: string
}

export const FORMAT_CONFIGS: TFormatConfig[] = [
  {
    label: 'H',
    hintKey: 'widgets.markdown_editor.toolbar.heading',
    action: (textarea, meta) => applyLinePrefix(textarea, '### ', meta.heading),
  },
  {
    label: <TextBSVG className='size-4 fill-current' />,
    hintKey: 'widgets.markdown_editor.toolbar.bold',
    action: (textarea, meta) => applyWrap(textarea, '**', '**', meta.bold),
  },
  {
    label: <TextItalicSVG className='size-4 fill-current' />,
    hintKey: 'widgets.markdown_editor.toolbar.italic',
    action: (textarea, meta) => applyWrap(textarea, '*', '*', meta.italic),
  },
  {
    label: <QuotesSVG className='size-4 fill-current' />,
    hintKey: 'widgets.markdown_editor.toolbar.quote',
    action: (textarea, meta) => applyLinePrefix(textarea, '> ', meta.quote),
  },
  {
    label: <CodePhosphorSVG className='size-4 fill-current' />,
    hintKey: 'widgets.markdown_editor.toolbar.code',
    action: (textarea, meta) => applyWrap(textarea, '`', '`', meta.code),
  },
  {
    label: <LinkSVG className='size-4 fill-current' />,
    hintKey: 'widgets.markdown_editor.toolbar.link',
    action: (textarea, meta) => {
      const { selectionStart, selectionEnd, value } = textarea
      const selected = value.slice(selectionStart, selectionEnd) || meta.linkText
      const url = 'https://'
      const markdown = `[${selected}](${url})`
      const next = `${value.slice(0, selectionStart)}${markdown}${value.slice(selectionEnd)}`
      const start = selectionStart + selected.length + 3
      const end = start + url.length

      return { value: next, start, end }
    },
  },
  {
    label: <ListSVG className='size-4 fill-current' />,
    hintKey: 'widgets.markdown_editor.toolbar.lists',
    action: (textarea, meta) => applyLinePrefix(textarea, '- ', meta.listItem),
  },
  {
    label: <ListNumbersSVG className='size-4 fill-current' />,
    hintKey: 'widgets.markdown_editor.toolbar.ordered_list',
    action: (textarea, meta) => applyOrderedList(textarea, meta.listItem),
  },
  {
    label: <ListBulletsSVG className='size-4 fill-current' />,
    hintKey: 'widgets.markdown_editor.toolbar.unordered_list',
    action: (textarea, meta) => applyLinePrefix(textarea, '- ', meta.listItem),
  },
  {
    label: <ListChecksSVG className='size-4 fill-current' />,
    hintKey: 'widgets.markdown_editor.toolbar.task_list',
    action: (textarea, meta) => applyLinePrefix(textarea, '- [ ] ', meta.taskItem),
  },
]
