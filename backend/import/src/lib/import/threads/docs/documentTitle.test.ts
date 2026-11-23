import { describe, expect, it } from 'vitest'

import { deserializeMarkdown } from '../../../document-importer/markdown'
import { extractDocumentSource, parseDocument } from './analyzer/documentFile'
import { consumePromotedHeading } from './documentTitle'

const normalizedBody = (sourcePath: string, markdown: string) => {
  const document = parseDocument(sourcePath, markdown, 'docs', Buffer.byteLength(markdown, 'utf8'))
  const value = deserializeMarkdown(extractDocumentSource(markdown).body, {
    source: 'vitepress',
  })
  return consumePromotedHeading(value, document.titleSource)
}

describe('document title body normalization', () => {
  it('removes the promoted H1 after real Markdown deserialization', () => {
    const value = normalizedBody(
      'docs/markdown-examples.md',
      '---\ntitle: Search title\n---\n# Markdown Extension Examples\n\nBody',
    )

    expect(value).toHaveLength(1)
    expect(value[0]).toMatchObject({ type: 'p' })
  })

  it('handles comments before the promoted H1 consistently', () => {
    const value = normalizedBody('docs/guide.md', '<!-- source note -->\n\n# Visible title\n\nBody')

    expect(value.some((node) => node.type === 'h1')).toBe(false)
  })

  it('preserves all headings when the title came from metadata', () => {
    const value = normalizedBody(
      'docs/guide.md',
      '---\ntitle: Guide\n---\nIntro paragraph.\n\n# First section',
    )

    expect(value.some((node) => node.type === 'h1')).toBe(true)
  })
})
