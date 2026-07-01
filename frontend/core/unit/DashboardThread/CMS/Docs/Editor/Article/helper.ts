import type { TRichEditorValue } from '@groupher/rich-editor'

import type { TSideTreePage } from '../SideTree/spec'
import { EMPTY_EDITOR_VALUE } from './constant'
import type { TDocDraftDTO, TDocDraftSession } from './spec'

type TTextNode = {
  text?: unknown
  children?: TTextNode[]
}

const collectText = (nodes: TTextNode[]): string => {
  let text = ''

  for (const node of nodes) {
    if (typeof node.text === 'string') {
      text += node.text
    }

    if (Array.isArray(node.children)) {
      text += ` ${collectText(node.children)}`
    }
  }

  return text
}

/**
 * Count plain-text stats from the rich-editor document tree.
 *
 * @example
 * countEditorText([{ type: 'p', children: [{ text: 'hello doc' }] }])
 * // => { characterCount: 8, wordCount: 2 }
 */
export const countEditorText = (value: TRichEditorValue) => {
  const text = collectText(value as TTextNode[]).trim()
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0

  return {
    characterCount: text.replace(/\s/g, '').length,
    wordCount: words,
  }
}

/**
 * Parse the persisted editor JSON into a valid rich-editor value.
 *
 * @example
 * parseEditorValue('[{"type":"p","children":[{"text":"hello"}]}]')
 * // => [{ type: 'p', children: [{ text: 'hello' }] }]
 */
export const parseEditorValue = (json?: string | null): TRichEditorValue => {
  if (!json) return EMPTY_EDITOR_VALUE

  try {
    const value = JSON.parse(json)
    return Array.isArray(value) ? (value as TRichEditorValue) : EMPTY_EDITOR_VALUE
  } catch {
    return EMPTY_EDITOR_VALUE
  }
}

/**
 * Serialize the rich-editor value for draft persistence.
 *
 * @example
 * serializeEditorValue([{ type: 'p', children: [{ text: 'hello' }] }])
 * // => '[{"type":"p","children":[{"text":"hello"}]}]'
 */
export const serializeEditorValue = (value: TRichEditorValue): string => JSON.stringify(value)

/**
 * Normalize a fetched draft and its active tree page into editor session state.
 *
 * @example
 * resolveDraftSession({ docId: 'doc_1', title: 'Intro' }, { docId: 'doc_1', title: 'Fallback' })
 * // => { title: 'Intro', slug: '', body: EMPTY_EDITOR_VALUE, ... }
 */
export const resolveDraftSession = (
  draft: TDocDraftDTO | null | undefined,
  activePage: TSideTreePage | null,
): TDocDraftSession => {
  const title = draft?.title || activePage?.title || ''
  const subtitle = draft?.subtitle || ''
  const body = parseEditorValue(draft?.document?.json)

  return {
    body,
    bodyJson: serializeEditorValue(body),
    info: {
      id: draft?.docId || activePage?.docId || '',
      title,
      subtitle,
      slug: draft?.slug || '',
      stage: draft?.stage || null,
      insertedAt: draft?.insertedAt || null,
      updatedAt: draft?.updatedAt || null,
      author: draft?.author || null,
      publishState: activePage?.publishState || null,
      ...countEditorText(body),
    },
    slug: draft?.slug || '',
    subtitle,
    title,
  }
}
