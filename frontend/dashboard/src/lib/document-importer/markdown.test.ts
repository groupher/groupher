import { describe, expect, it } from 'vitest'

import { deserializeMarkdown } from './markdown'

describe('deserializeMarkdown', () => {
  it('uses the rich-editor MarkdownKit schema', () => {
    expect(deserializeMarkdown('# Title\n\nBody **bold**')).toEqual([
      { children: [{ text: 'Title' }], type: 'h1' },
      {
        children: [{ text: 'Body ' }, { bold: true, text: 'bold' }],
        type: 'p',
      },
    ])
  })

  it('keeps Plate code blocks and tables as persisted editor nodes', () => {
    expect(
      deserializeMarkdown('```ts\nconst ready = true\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |'),
    ).toEqual([
      {
        children: [
          {
            children: [{ text: 'const ready = true' }],
            type: 'code_line',
          },
        ],
        lang: 'ts',
        type: 'code_block',
      },
      expect.objectContaining({ type: 'table' }),
    ])
  })

  it('rejects an empty conversion result', () => {
    expect(() => deserializeMarkdown('  \n')).toThrowError(
      expect.objectContaining({ code: 'empty_document', status: 422 }),
    )
  })
})
