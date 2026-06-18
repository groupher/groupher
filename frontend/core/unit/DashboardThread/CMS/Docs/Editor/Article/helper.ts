import type { TRichEditorValue } from '@groupher/rich-editor'

type TTextNode = {
  text?: unknown
  children?: TTextNode[]
}

export const DOC_AUTO_SAVE_DELAY = 1600

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

export const countEditorText = (value: TRichEditorValue) => {
  const text = collectText(value as TTextNode[]).trim()
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0

  return {
    characterCount: text.replace(/\s/g, '').length,
    wordCount: words,
  }
}
