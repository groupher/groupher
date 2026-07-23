import { describe, expect, it } from 'vitest'

import { parseDocument } from './documentFile'

const parse = (sourcePath: string, source: string) =>
  parseDocument(sourcePath, source, 'docs', Buffer.byteLength(source, 'utf8'))

describe('parseDocument title normalization', () => {
  it('promotes the first root H1 and extracts its plain text', () => {
    const document = parse('docs/guide.md', '# Markdown *Extension* [Examples](/examples)\n\nBody')

    expect(document).toMatchObject({
      body: '# Markdown *Extension* [Examples](/examples)\n\nBody',
      metadataTitle: undefined,
      title: 'Markdown Extension Examples',
      titleSource: 'heading',
    })
  })

  it('recognizes a leading Setext H1 through the Markdown AST', () => {
    const document = parse('docs/guide.md', 'Visible title\n=============\n\nBody')

    expect(document).toMatchObject({
      title: 'Visible title',
      titleSource: 'heading',
    })
  })

  it('uses YAML title metadata when there is no leading H1', () => {
    const source = '\uFEFF---\r\ntitle: Metadata Title\r\n---\r\nBody'
    const document = parse('docs/guide.md', source)

    expect(document).toMatchObject({
      body: 'Body',
      metadataTitle: 'Metadata Title',
      title: 'Metadata Title',
      titleSource: 'metadata',
    })
  })

  it('keeps metadata separately when the visible H1 has the same title', () => {
    const document = parse('docs/guide.md', '---\ntitle: Guide\n---\n# Guide\n\nBody')

    expect(document).toMatchObject({
      metadataTitle: 'Guide',
      title: 'Guide',
      titleSource: 'heading',
    })
  })

  it('prefers a different visible H1 without losing metadata title', () => {
    const document = parse(
      'docs/guide.md',
      '---\ntitle: Search-friendly title\n---\n# Reader-facing title\n\nBody',
    )

    expect(document).toMatchObject({
      metadataTitle: 'Search-friendly title',
      title: 'Reader-facing title',
      titleSource: 'heading',
    })
  })

  it('does not treat a navigation label as the document title', () => {
    const document = parse(
      'docs/getting-started.md',
      '---\nsidebar_label: Start Here\n---\n# Getting Started\n\nBody',
    )

    expect(document).toMatchObject({
      metadataTitle: undefined,
      title: 'Getting Started',
      titleSource: 'heading',
    })
    expect(document.frontmatter.sidebar_label).toBe('Start Here')
  })

  it('preserves a non-leading H1 as body content and falls back to the filename', () => {
    const document = parse('docs/getting-started.md', 'Intro paragraph.\n\n# Later heading')

    expect(document).toMatchObject({
      title: 'Getting Started',
      titleSource: 'filename',
    })
  })

  it('reads static MDX metadata but still promotes the visible H1', () => {
    const document = parse(
      'docs/guide.mdx',
      "export const metadata = { title: 'Search title' }\n\n# Visible *Title*\n\n<Component />",
    )

    expect(document).toMatchObject({
      metadataTitle: 'Search title',
      title: 'Visible Title',
      titleSource: 'heading',
    })
  })

  it('uses a static MDX title export when there is no leading H1', () => {
    const document = parse('docs/guide.mdx', "export const title = 'MDX title'\n\n<Component />")

    expect(document).toMatchObject({
      metadataTitle: 'MDX title',
      title: 'MDX title',
      titleSource: 'metadata',
    })
  })
})
