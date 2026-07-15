import { act, renderHook } from '@testing-library/react'

import { THREAD } from '~/const/thread'
import type { TTagGroup } from '~/spec'

import useTagDragDraft from './useTagDragDraft'

const buildTagGroups = (): TTagGroup[] => [
  {
    id: 'group-a',
    title: 'Group A',
    index: 0,
    tags: [
      { id: 'a', groupId: 'group-a', index: 0, title: 'A' },
      { id: 'b', groupId: 'group-a', index: 1, title: 'B' },
      { id: 'c', groupId: 'group-a', index: 2, title: 'C' },
    ],
  },
  {
    id: 'group-b',
    title: 'Group B',
    index: 1,
    tags: [{ id: 'd', groupId: 'group-b', index: 0, title: 'D' }],
  },
  {
    id: 'group-c',
    title: 'Group C',
    index: 2,
    tags: [{ id: 'e', groupId: 'group-c', index: 0, title: 'E' }],
  },
]

const tagIds = (groups: readonly TTagGroup[], groupId: string): Array<string | undefined> =>
  groups.find((group) => group.id === groupId)?.tags.map((tag) => tag.id) || []

const sameGroupNoOps = [
  {
    label: 'after the previous tag',
    activeId: 'b',
    target: { groupId: 'group-a', tagId: 'a', position: 'after' },
  },
  {
    label: 'before the next tag',
    activeId: 'b',
    target: { groupId: 'group-a', tagId: 'c', position: 'before' },
  },
  {
    label: 'before the first adjacent tag',
    activeId: 'a',
    target: { groupId: 'group-a', tagId: 'b', position: 'before' },
  },
  {
    label: 'after the last adjacent tag',
    activeId: 'c',
    target: { groupId: 'group-a', tagId: 'b', position: 'after' },
  },
] as const

describe('useTagDragDraft', () => {
  let animationFrames: Map<number, FrameRequestCallback>
  let nextFrameId: number

  beforeEach(() => {
    animationFrames = new Map()
    nextFrameId = 0
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        nextFrameId += 1
        animationFrames.set(nextFrameId, callback)
        return nextFrameId
      }),
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((frameId: number) => animationFrames.delete(frameId)),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const flushAnimationFrames = (): void => {
    for (const [frameId, callback] of animationFrames) {
      animationFrames.delete(frameId)
      callback(0)
    }
  }

  const setup = () => {
    const onCommit = vi.fn()
    const tagGroups = buildTagGroups()
    const draftGroups = []
    const hook = renderHook(() =>
      useTagDragDraft({
        tagGroups,
        draftGroups,
        currentThread: THREAD.POST,
        onCommit,
      }),
    )

    return { ...hook, onCommit }
  }

  it.each(sameGroupNoOps)(
    'returns the current groups when placed $label',
    ({ activeId, target }) => {
      const { result, onCommit } = setup()
      const initialGroups = result.current.groups

      act(() => result.current.startDrag(activeId))
      act(() => result.current.moveTagDrag(target))

      expect(result.current.groups).toBe(initialGroups)

      act(() => result.current.commitTagDrag(target))

      expect(requestAnimationFrame).not.toHaveBeenCalled()
      expect(onCommit).not.toHaveBeenCalled()
    },
  )

  it('moves within one group without replacing unaffected groups', () => {
    const { result } = setup()
    const initialGroups = result.current.groups
    const target = { groupId: 'group-a', tagId: 'c', position: 'after' as const }

    act(() => result.current.startDrag('b'))
    act(() => result.current.moveTagDrag(target))

    expect(tagIds(result.current.groups, 'group-a')).toEqual(['a', 'c', 'b'])
    expect(result.current.groups[0].tags[0]).toBe(initialGroups[0].tags[0])
    expect(result.current.groups[1]).toBe(initialGroups[1])
    expect(result.current.groups[2]).toBe(initialGroups[2])

    const movedGroups = result.current.groups
    act(() => result.current.moveTagDrag(target))
    expect(result.current.groups).toBe(movedGroups)
  })

  it('updates the dragged tag group lookup incrementally across groups', () => {
    const { result } = setup()

    act(() => result.current.startDrag('b'))
    act(() =>
      result.current.moveTagDrag({
        groupId: 'group-b',
        tagId: 'd',
        position: 'before',
      }),
    )
    act(() =>
      result.current.moveTagDrag({
        groupId: 'group-a',
        tagId: 'c',
        position: 'after',
      }),
    )

    expect(tagIds(result.current.groups, 'group-a')).toEqual(['a', 'c', 'b'])
    expect(tagIds(result.current.groups, 'group-b')).toEqual(['d'])
  })

  it('restores the tag lookup when a cross-group drag is cancelled', () => {
    const { result } = setup()
    const initialGroups = result.current.groups

    act(() => result.current.startDrag('b'))
    act(() =>
      result.current.moveTagDrag({
        groupId: 'group-b',
        tagId: 'd',
        position: 'before',
      }),
    )
    act(() => result.current.cancelDrag())

    expect(result.current.groups).toBe(initialGroups)

    act(() => result.current.startDrag('b'))
    act(() =>
      result.current.moveTagDrag({
        groupId: 'group-a',
        tagId: 'c',
        position: 'after',
      }),
    )

    expect(tagIds(result.current.groups, 'group-a')).toEqual(['a', 'c', 'b'])
  })

  it('commits the final placement once with normalized indexes', () => {
    const { result, onCommit } = setup()
    const target = { groupId: 'group-b', tagId: 'd', position: 'before' as const }

    act(() => result.current.startDrag('b'))
    act(() => result.current.moveTagDrag(target))
    act(() => result.current.commitTagDrag(target))

    expect(onCommit).not.toHaveBeenCalled()

    act(flushAnimationFrames)

    expect(onCommit).toHaveBeenCalledTimes(1)
    const committedGroups = onCommit.mock.calls[0][0] as TTagGroup[]
    expect(
      committedGroups.map((group) => ({
        id: group.id,
        index: group.index,
        tags: group.tags.map((tag) => ({
          id: tag.id,
          groupId: tag.groupId,
          index: tag.index,
        })),
      })),
    ).toEqual([
      {
        id: 'group-a',
        index: 0,
        tags: [
          { id: 'a', groupId: 'group-a', index: 0 },
          { id: 'c', groupId: 'group-a', index: 1 },
        ],
      },
      {
        id: 'group-b',
        index: 1,
        tags: [
          { id: 'b', groupId: 'group-b', index: 0 },
          { id: 'd', groupId: 'group-b', index: 1 },
        ],
      },
      {
        id: 'group-c',
        index: 2,
        tags: [{ id: 'e', groupId: 'group-c', index: 0 }],
      },
    ])
  })
})
