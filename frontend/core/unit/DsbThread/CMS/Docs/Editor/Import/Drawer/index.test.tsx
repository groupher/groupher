import type {
  TBlockRef,
  TCursorRef,
  TRichEditorHandle,
  TRichEditorValue,
} from '@groupher/rich-editor'
import { fireEvent, render as renderUI, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'

import ImportDrawer from '.'

const render = (ui: ReactElement) => renderUI(ui, { wrapper: makeStoreWrapper() })

const mocks = vi.hoisted(() => ({
  importDocument: vi.fn(),
  importDocumentationPlatform: vi.fn(),
  toast: vi.fn(),
  editedValue: [{ type: 'p', children: [{ text: 'Edited import' }] }] as TRichEditorValue,
}))

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('~/lib/documentImport', () => ({
  DOCUMENT_IMPORT_ACCEPT: '.html',
  importDocument: mocks.importDocument,
  importDocumentationPlatform: mocks.importDocumentationPlatform,
}))

vi.mock('~/ui/Drawer', () => ({
  default: ({ children, show, wide }) =>
    show ? (
      <div data-testid='import-drawer' data-wide={String(!!wide)}>
        {children}
      </div>
    ) : null,
}))

vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))

vi.mock('~/ui/LogoList/salon', () => ({
  default: () =>
    new Proxy({ link: 'hover:underline' }, { get: (target, key: string) => target[key] ?? key }),
}))

vi.mock('~/ui/Tooltip', () => ({
  default: ({ children, content }) => (
    <div>
      {children}
      {content}
    </div>
  ),
}))

vi.mock('./ReviewEditor', () => ({
  default: ({
    defaultValue,
    onChange,
  }: {
    defaultValue: TRichEditorValue
    onChange: (value: TRichEditorValue) => void
  }) => (
    <div>
      <div>import-review</div>
      <div>{defaultValue.length}</div>
      <button type='button' onClick={() => onChange(mocks.editedValue)}>
        edit-review
      </button>
    </div>
  ),
}))

vi.mock('./salon', () => ({
  default: () => new Proxy({}, { get: (target, key: string) => target[key] ?? key }),
}))

vi.mock('./salon/local_file_picker', () => ({
  cn: (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' '),
  default: () => new Proxy({}, { get: (target, key: string) => target[key] ?? key }),
}))

vi.mock('./salon/insert_action', () => ({
  default: () =>
    new Proxy(
      {
        chevron: () => 'chevron',
        check: () => 'check',
        menuItem: () => 'menu-item',
        sectionItem: () => 'section-item',
      },
      { get: (target, key: string) => target[key] ?? key },
    ),
}))

vi.mock('./salon/platform_url_picker', () => ({
  default: () => new Proxy({}, { get: (target, key: string) => target[key] ?? key }),
}))

vi.mock('./salon/source_card', () => ({
  default: () =>
    new Proxy(
      {
        sourceCard: () => 'source-card',
        sourceCardTrigger: () => 'source-card-trigger',
      },
      { get: (target, key: string) => target[key] ?? key },
    ),
}))

vi.mock('~/icons/CloseLight', () => ({ default: () => <svg aria-hidden='true' /> }))
vi.mock('~/icons/ArrowSimple', () => ({ default: () => <svg aria-hidden='true' /> }))
vi.mock('~/icons/ChevronDown', () => ({ default: () => <svg aria-hidden='true' /> }))
vi.mock('~/icons/DownloadSimple', () => ({ default: () => <svg aria-hidden='true' /> }))
vi.mock('~/icons/FileText', () => ({ default: () => <svg aria-hidden='true' /> }))
vi.mock('~/icons/Link', () => ({ default: () => <svg aria-hidden='true' /> }))
vi.mock('~/icons/social/Google', () => ({ default: () => <svg aria-hidden='true' /> }))
vi.mock('~/icons/social/Notion', () => ({ default: () => <svg aria-hidden='true' /> }))

const importedValue: TRichEditorValue = [{ type: 'p', children: [{ text: 'Imported' }] }]

const createHandle = (
  outline: ReturnType<TRichEditorHandle['getOutline']> = [],
): TRichEditorHandle => ({
  insertContent: vi.fn(() => ({ ok: true as const })),
  captureCursor: vi.fn(() => null),
  getOutline: vi.fn(() => outline),
  focus: vi.fn(),
})

const importLocalFile = async (): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: /dsb.doc.import.source.local/ }))
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  const file = new File(['<p>Imported</p>'], 'guide.html', { type: 'text/html' })
  fireEvent.change(input!, { target: { files: [file] } })
  await screen.findByText('import-review')
}

describe('ImportDrawer', () => {
  beforeEach(() => {
    mocks.importDocument.mockReset()
    mocks.importDocumentationPlatform.mockReset()
    mocks.toast.mockReset()
    mocks.importDocument.mockResolvedValue({
      diagnostics: [],
      markdown: 'Imported',
      source: { filename: 'guide.html', mimeType: 'text/html', sizeBytes: 14 },
      value: importedValue,
    })
    mocks.importDocumentationPlatform.mockResolvedValue({
      diagnostics: [],
      markdown: 'Imported',
      source: {
        filename: 'docs.example.com/guide.md',
        mimeType: 'text/markdown',
        sizeBytes: 8,
      },
      value: importedValue,
    })
  })

  it('imports a public documentation page through its URL', async () => {
    render(
      <ImportDrawer
        show
        targetDocId='doc-a'
        cursor={null}
        editor={createHandle()}
        onClose={vi.fn()}
        onInserted={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /dsb.doc.import.source.platform/ }))
    fireEvent.change(screen.getByLabelText('dsb.doc.import.platform.label'), {
      target: { value: 'https://docs.example.com/guide' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'dsb.doc.import.platform.fetch' }))

    await screen.findByText('import-review')
    expect(mocks.importDocumentationPlatform).toHaveBeenCalledWith('https://docs.example.com/guide')
  })

  it('links to the Markdown support documentation for supported platforms', () => {
    render(
      <ImportDrawer
        show
        targetDocId='doc-a'
        cursor={null}
        editor={createHandle()}
        onClose={vi.fn()}
        onInserted={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /dsb.doc.import.source.platform/ }))

    const expectedLinks = {
      Mintlify: 'https://www.mintlify.com/docs/ai/markdown-export',
      GitBook: 'https://gitbook.com/docs/publishing-documentation/llm-ready-docs',
      Fern: 'https://buildwithfern.com/learn/docs/configuration/page-level-settings',
      ReadMe: 'https://docs.readme.com/main/changelog/ask-ai-llms-txt',
      Speakeasy: 'https://www.speakeasy.com/blog/prepare-your-website-for-llms',
      Fumadocs: 'https://www.fumadocs.dev/docs/integrations/llms',
      VitePress: 'https://vitepress.dev/guide/markdown',
      Rspress: 'https://rspress.dev/guide/basic/conventional-route',
    }

    for (const [name, href] of Object.entries(expectedLinks)) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
      expect(screen.getByRole('link', { name })).toHaveAttribute('target', '_blank')
      expect(screen.getByRole('link', { name })).toHaveAttribute('rel', 'noreferrer')
    }

    expect(screen.queryByText('dsb.doc.import.platform.and')).not.toBeInTheDocument()
    expect(screen.queryByText('…')).not.toBeInTheDocument()
  })

  it('expands each source picker inside its own source item', async () => {
    render(
      <ImportDrawer
        show
        targetDocId='doc-a'
        cursor={null}
        editor={createHandle()}
        onClose={vi.fn()}
        onInserted={vi.fn()}
      />,
    )

    const localButton = screen.getByRole('button', { name: /dsb.doc.import.source.local/ })
    const platformButton = screen.getByRole('button', { name: /dsb.doc.import.source.platform/ })

    fireEvent.click(localButton)
    expect(localButton).toHaveAttribute('aria-expanded', 'true')
    expect(platformButton).toHaveAttribute('aria-expanded', 'false')
    expect(localButton.parentElement?.querySelector('input[type="file"]')).not.toBeNull()
    expect(platformButton.parentElement?.querySelector('form')).toBeNull()

    fireEvent.click(platformButton)
    expect(localButton).toHaveAttribute('aria-expanded', 'false')
    expect(platformButton).toHaveAttribute('aria-expanded', 'true')
    expect(platformButton.parentElement?.querySelector('form')).not.toBeNull()
    await waitFor(() => {
      expect(localButton.parentElement?.querySelector('input[type="file"]')).toBeNull()
    })

    fireEvent.click(platformButton)
    expect(platformButton).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => {
      expect(platformButton.parentElement?.querySelector('form')).toBeNull()
    })
  })

  it('appends imported content to the document by default', async () => {
    const editor = createHandle()
    const onInserted = vi.fn()

    render(
      <ImportDrawer
        show
        targetDocId='doc-a'
        cursor={null}
        editor={editor}
        onClose={vi.fn()}
        onInserted={onInserted}
      />,
    )

    await importLocalFile()
    fireEvent.click(screen.getByRole('button', { name: 'dsb.doc.import.insert.end' }))

    expect(editor.insertContent).toHaveBeenCalledWith(importedValue, {
      type: 'document',
      position: 'end',
    })
    expect(onInserted).toHaveBeenCalledOnce()
  })

  it('inserts the value edited in the review editor', async () => {
    const editor = createHandle()

    render(
      <ImportDrawer
        show
        targetDocId='doc-a'
        cursor={null}
        editor={editor}
        onClose={vi.fn()}
        onInserted={vi.fn()}
      />,
    )

    await importLocalFile()
    fireEvent.click(screen.getByRole('button', { name: 'edit-review' }))
    fireEvent.click(screen.getByRole('button', { name: 'dsb.doc.import.insert.end' }))

    expect(editor.insertContent).toHaveBeenCalledWith(mocks.editedValue, {
      type: 'document',
      position: 'end',
    })
  })

  it('expands for review and returns to the narrow source list through Back', async () => {
    render(
      <ImportDrawer
        show
        targetDocId='doc-a'
        cursor={null}
        editor={createHandle()}
        onClose={vi.fn()}
        onInserted={vi.fn()}
      />,
    )

    expect(screen.getByTestId('import-drawer')).toHaveAttribute('data-wide', 'false')
    await importLocalFile()
    expect(screen.getByTestId('import-drawer')).toHaveAttribute('data-wide', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'dsb.doc.import.back' }))

    expect(screen.getByTestId('import-drawer')).toHaveAttribute('data-wide', 'false')
    expect(screen.getByRole('button', { name: /dsb.doc.import.source.local/ })).toBeVisible()
    expect(screen.queryByText('import-review')).not.toBeInTheDocument()
  })

  it('uses the cursor captured before opening the drawer', async () => {
    const cursor = { release: vi.fn() } as unknown as TCursorRef
    const editor = createHandle()

    render(
      <ImportDrawer
        show
        targetDocId='doc-a'
        cursor={cursor}
        editor={editor}
        onClose={vi.fn()}
        onInserted={vi.fn()}
      />,
    )

    await importLocalFile()
    fireEvent.click(screen.getByRole('button', { name: 'dsb.doc.import.target.title' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'dsb.doc.import.target.cursor' }))
    fireEvent.click(screen.getByRole('button', { name: 'dsb.doc.import.insert.cursor' }))

    expect(editor.insertContent).toHaveBeenCalledWith(importedValue, {
      type: 'cursor',
      cursor,
    })
  })

  it('maps a section end to the next same-level heading boundary', async () => {
    const firstBlock = { release: vi.fn() } as unknown as TBlockRef
    const childBlock = { release: vi.fn() } as unknown as TBlockRef
    const nextBlock = { release: vi.fn() } as unknown as TBlockRef
    const editor = createHandle([
      { key: 'a', block: firstBlock, level: 2, text: 'A' },
      { key: 'a-child', block: childBlock, level: 3, text: 'Child' },
      { key: 'b', block: nextBlock, level: 2, text: 'B' },
    ])

    const view = render(
      <ImportDrawer
        show
        targetDocId='doc-a'
        cursor={null}
        editor={editor}
        onClose={vi.fn()}
        onInserted={vi.fn()}
      />,
    )

    await importLocalFile()
    fireEvent.click(screen.getByRole('button', { name: 'dsb.doc.import.target.title' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'dsb.doc.import.insert.section' }))

    expect(editor.insertContent).toHaveBeenCalledWith(importedValue, {
      type: 'block',
      block: nextBlock,
      position: 'before',
    })

    view.unmount()
    await waitFor(() => {
      expect(firstBlock.release).toHaveBeenCalledOnce()
      expect(childBlock.release).toHaveBeenCalledOnce()
      expect(nextBlock.release).toHaveBeenCalledOnce()
    })
  })
})
