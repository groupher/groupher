import { RICH_EDITOR_SCHEMA_VERSION } from '@groupher/rich-editor/node'
import { describe, expect, it } from 'vitest'

import { ArtimentPublisherError } from './error'
import { publishArtiment } from './index'
import { sanitizeArtimentHtml } from './sanitize'
import { ARTIMENT_DIGEST_LENGTH } from './serialize'
import { ARTIMENT_MAX_NODE_COUNT, ARTIMENT_MAX_VALUE_DEPTH } from './validate'

const articleValue = [
  {
    type: 'h2',
    children: [{ text: 'Phase 2' }],
  },
  {
    id: 'paragraph-id',
    type: 'p',
    children: [
      { text: 'Node codec ' },
      { bold: true, text: 'works' },
      { text: ' with ' },
      {
        type: 'a',
        children: [{ text: 'unsafe link' }],
        target: '_blank',
        url: 'javascript:alert(1)',
      },
    ],
  },
]

const registeredNodesValue = [
  {
    type: 'p',
    children: [
      { text: 'Marks: ' },
      { bold: true, text: 'bold' },
      { italic: true, text: 'italic' },
      { underline: true, text: 'underline' },
      { code: true, text: 'code' },
      { strikethrough: true, text: 'strike' },
      { subscript: true, text: 'sub' },
      { superscript: true, text: 'sup' },
      { highlight: true, text: 'highlight' },
      { kbd: true, text: 'kbd' },
    ],
  },
  {
    type: 'p',
    children: [
      {
        type: 'mention',
        children: [{ text: '' }],
        key: 'u-1',
        value: 'Alice',
      },
    ],
  },
  {
    type: 'callout',
    children: [{ text: 'Important note.' }],
    icon: '💡',
    variant: 'info',
  },
  {
    type: 'toggle',
    children: [{ text: 'Toggle details.' }],
    collapsed: false,
  },
  { type: 'blockquote', children: [{ text: 'Quoted text.' }] },
  { type: 'hr', children: [{ text: '' }] },
  {
    type: 'p',
    children: [{ text: 'Bullet item.' }],
    indent: 1,
    listStyleType: 'disc',
  },
  {
    type: 'p',
    children: [{ text: 'Numbered item.' }],
    indent: 1,
    listStart: 3,
    listStyleType: 'decimal',
  },
  {
    type: 'p',
    checked: true,
    children: [{ text: 'Finished task.' }],
    indent: 1,
    listStyleType: 'todo',
  },
]

const stepsValue = [
  {
    type: 'steps',
    children: [
      {
        type: 'step',
        stepNumber: 1,
        children: [
          {
            type: 'step_title',
            children: [{ text: 'Connect domain' }],
          },
          {
            type: 'step_content',
            children: [
              {
                type: 'p',
                children: [{ text: 'Configure the DNS records.' }],
              },
            ],
          },
        ],
      },
    ],
  },
]

describe('publishArtiment', () => {
  it('builds a sanitized BodyBag from the rich-editor Node codec', async () => {
    const bodyBag = await publishArtiment(articleValue)

    expect(bodyBag.schemaVersion).toBe(RICH_EDITOR_SCHEMA_VERSION)
    expect(bodyBag.markdown).toContain('## Phase 2')
    expect(bodyBag.plainText).toBe('Phase 2\nNode codec works with unsafe link')
    expect(bodyBag.toc).toEqual([{ id: 'phase-2', level: 2, title: 'Phase 2' }])
    expect(bodyBag.html).toContain('id="phase-2"')
    expect(bodyBag.html).not.toContain('javascript:')
    expect(bodyBag.html).toContain('rel="noopener noreferrer"')
    expect(bodyBag.bodyHash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.parse(bodyBag.json)).toEqual(articleValue)
  })

  it('preserves node identity in JSON but excludes it from bodyHash', async () => {
    const first = await publishArtiment([
      { id: 'first-id', type: 'p', children: [{ text: 'same body' }] },
    ])
    const second = await publishArtiment([
      { _id: 'second-id', children: [{ id: 'leaf-id', text: 'same body' }], type: 'p' },
    ])

    expect(first.json).not.toBe(second.json)
    expect(first.bodyHash).toBe(second.bodyHash)
  })

  it('keeps every currently registered persisted node through final sanitization', async () => {
    const bodyBag = await publishArtiment(registeredNodesValue)

    expect(bodyBag.html).toContain('<strong')
    expect(bodyBag.html).toContain('<em')
    expect(bodyBag.html).toContain('<u')
    expect(bodyBag.html).toContain('<code')
    expect(bodyBag.html).toContain('<sub')
    expect(bodyBag.html).toContain('<sup')
    expect(bodyBag.html).toContain('<mark')
    expect(bodyBag.html).toContain('<kbd')
    expect(bodyBag.html).toContain('@Alice')
    expect(bodyBag.html).toContain('class="slate-callout')
    expect(bodyBag.html).toContain('<details')
    expect(bodyBag.html).toContain('<blockquote')
    expect(bodyBag.html).toContain('<hr')
    expect(bodyBag.html).toContain('<ul')
    expect(bodyBag.html).toContain('<ol')
    expect(bodyBag.html).toContain('type="checkbox"')
  })

  it('keeps the native Steps disclosure through final sanitization', async () => {
    const bodyBag = await publishArtiment(stepsValue)

    expect(bodyBag.html).toContain('class="rich-editor-step-details"')
    expect(bodyBag.html).toContain('<details')
    expect(bodyBag.html).toContain(' open')
    expect(bodyBag.html).toContain('<summary class="rich-editor-step-heading"')
    expect(bodyBag.html).toContain('rich-editor-step-collapse-pill')
    expect(bodyBag.html).toContain('Configure the DNS records.')
  })

  it('rejects unknown nodes with editor diagnostics', async () => {
    const error = await publishArtiment([
      { type: 'unknown-block', children: [{ text: 'lost content' }] },
    ]).catch((reason) => reason)

    expect(error).toBeInstanceOf(ArtimentPublisherError)
    expect(error).toMatchObject({
      code: 'invalid_value',
      diagnostics: [
        expect.objectContaining({
          code: 'unknown_node',
          nodeType: 'unknown-block',
          path: [0],
        }),
      ],
    })
  })

  it('rejects over-deep values before the recursive editor validator runs', async () => {
    const metadata: Record<string, unknown> = {}
    let cursor = metadata

    for (let index = 0; index <= ARTIMENT_MAX_VALUE_DEPTH; index += 1) {
      const next: Record<string, unknown> = {}
      cursor.next = next
      cursor = next
    }

    await expect(
      publishArtiment([{ type: 'p', children: [{ text: 'body' }], metadata }]),
    ).rejects.toMatchObject({ code: 'value_too_deep' })
  })

  it('rejects values with too many editor nodes', async () => {
    const value = Array.from({ length: ARTIMENT_MAX_NODE_COUNT + 1 }, () => ({
      type: 'p',
      children: [{ text: 'x' }],
    }))

    await expect(publishArtiment(value)).rejects.toMatchObject({ code: 'too_many_nodes' })
  })

  it('creates a grapheme-safe digest with the shared length rule', async () => {
    const bodyBag = await publishArtiment([
      { type: 'p', children: [{ text: '😀'.repeat(ARTIMENT_DIGEST_LENGTH + 1) }] },
    ])

    expect(Array.from(bodyBag.digest)).toHaveLength(ARTIMENT_DIGEST_LENGTH)
    expect(bodyBag.digest.endsWith('😀')).toBe(true)
  })
})

describe('sanitizeArtimentHtml', () => {
  it('removes scripts, event handlers, dangerous URLs, and inline styles', () => {
    const html = sanitizeArtimentHtml(`
      <h2 data-block-id="safe" onclick="alert(1)" style="color:red">Heading</h2>
      <a href="javascript:alert(1)" target="_blank">Link</a>
      <script>alert(1)</script>
    `)

    expect(html).toContain('id="safe"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('style=')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)')
  })
})
