import type { TCursorRef, TRichEditorHandle } from '@groupher/rich-editor'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import PubSub from '~/utils/pubsub'

import { openDocImport, prepareDocImport } from './events'
import useImport from './useImport'

const createEditor = (cursor: TCursorRef): TRichEditorHandle => ({
  captureCursor: vi.fn(() => cursor),
  focus: vi.fn(),
  getOutline: vi.fn(() => []),
  insertContent: vi.fn(() => ({ ok: true as const })),
})

describe('useImport', () => {
  afterEach(() => PubSub.clearAllSubscriptions())

  it('captures the cursor synchronously before opening the current document drawer', () => {
    const cursor = { release: vi.fn() } as unknown as TCursorRef
    const editor = createEditor(cursor)
    const editorRef = { current: editor }
    const view = renderHook(() => useImport({ docId: 'doc-a', editorRef }))

    act(() => prepareDocImport('doc-a'))
    expect(editor.captureCursor).toHaveBeenCalledWith({ position: 'end' })

    act(() => openDocImport('doc-a'))
    expect(view.result.current.show).toBe(true)
    expect(view.result.current.cursor).toBe(cursor)

    act(() => view.result.current.close())
    expect(cursor.release).toHaveBeenCalledOnce()
  })

  it('ignores commands for another document', () => {
    const cursor = { release: vi.fn() } as unknown as TCursorRef
    const editor = createEditor(cursor)
    const editorRef = { current: editor }
    const view = renderHook(() => useImport({ docId: 'doc-a', editorRef }))

    act(() => prepareDocImport('doc-b'))
    act(() => openDocImport('doc-b'))

    expect(editor.captureCursor).not.toHaveBeenCalled()
    expect(view.result.current.show).toBe(false)
  })

  it('releases the prepared cursor when the active document changes', () => {
    const cursor = { release: vi.fn() } as unknown as TCursorRef
    const editor = createEditor(cursor)
    const editorRef = { current: editor }
    const view = renderHook(({ docId }) => useImport({ docId, editorRef }), {
      initialProps: { docId: 'doc-a' },
    })

    act(() => prepareDocImport('doc-a'))
    act(() => openDocImport('doc-a'))
    expect(view.result.current.show).toBe(true)

    view.rerender({ docId: 'doc-b' })

    expect(cursor.release).toHaveBeenCalledOnce()
    expect(view.result.current.show).toBe(false)
    expect(view.result.current.targetDocId).toBeNull()
  })
})
