import { renderHook } from '@testing-library/react'

import type { TTagGroup } from '~/spec'

import useIndexTouched, { buildTagPlacementIndex, hasTagPlacementChanged } from './useIndexTouched'

const dashboardMock = vi.hoisted(() => ({
  tagGroups: [] as TTagGroup[],
  originalTagGroups: [] as TTagGroup[],
}))

vi.mock('~/stores/dashboard/hooks', () => ({
  default: () => ({
    tagGroups: dashboardMock.tagGroups,
    original: { tagGroups: dashboardMock.originalTagGroups },
  }),
}))

const makeTagGroups = (): TTagGroup[] => [
  {
    id: 'group-b',
    title: 'Group B',
    index: 1,
    tags: [{ id: 'tag-b', groupId: 'group-b', index: 0, title: 'Tag B' }],
  },
  {
    id: 'group-a',
    title: 'Group A',
    index: 0,
    tags: [{ id: 'tag-a', groupId: 'group-a', index: 0, title: 'Tag A' }],
  },
]

describe('tag placement dirty-check', () => {
  beforeEach(() => {
    dashboardMock.tagGroups = []
    dashboardMock.originalTagGroups = []
  })

  it('ignores collection order when identity and placement are unchanged', () => {
    const original = makeTagGroups()
    const current = [original[1], original[0]]
    const baseline = buildTagPlacementIndex(original)

    expect(hasTagPlacementChanged(current, baseline)).toBe(false)
  })

  it('detects group, tag, and cross-group placement changes', () => {
    const original = makeTagGroups()
    const baseline = buildTagPlacementIndex(original)
    const groupIndexChanged = original.map((group) =>
      group.id === 'group-a' ? { ...group, index: 2 } : group,
    )
    const tagIndexChanged = original.map((group) => ({
      ...group,
      tags: group.tags.map((tag) => (tag.id === 'tag-a' ? { ...tag, index: 1 } : tag)),
    }))
    const [groupB, groupA] = original
    const movedTag = { ...groupA.tags[0], groupId: groupB.id, index: 1 }
    const crossGroupChanged = [
      { ...groupB, tags: [...groupB.tags, movedTag] },
      { ...groupA, tags: [] },
    ]

    expect(hasTagPlacementChanged(groupIndexChanged, baseline)).toBe(true)
    expect(hasTagPlacementChanged(tagIndexChanged, baseline)).toBe(true)
    expect(hasTagPlacementChanged(crossGroupChanged, baseline)).toBe(true)
  })

  it('ignores idless tags but detects added or removed persisted entries', () => {
    const original = makeTagGroups()
    const baseline = buildTagPlacementIndex(original)
    const withDraftTag = original.map((group) =>
      group.id === 'group-a'
        ? { ...group, tags: [...group.tags, { title: 'Unsaved tag', index: 99 }] }
        : group,
    )
    const withoutPersistedTag = original.map((group) =>
      group.id === 'group-a' ? { ...group, tags: [] } : group,
    )

    expect(hasTagPlacementChanged(withDraftTag, baseline)).toBe(false)
    expect(hasTagPlacementChanged(withoutPersistedTag, baseline)).toBe(true)
  })

  it('does not collapse duplicate ids', () => {
    const original: TTagGroup[] = [
      {
        id: 'group-a',
        title: 'Group A',
        index: 0,
        tags: [{ id: 'same-tag', groupId: 'group-a', index: 0 }],
      },
      {
        id: 'group-b',
        title: 'Group B',
        index: 1,
        tags: [{ id: 'same-tag', groupId: 'group-b', index: 0 }],
      },
    ]
    const baseline = buildTagPlacementIndex(original)

    expect(hasTagPlacementChanged([original[1], original[0]], baseline)).toBe(true)
  })

  it('refreshes the baseline when original tag groups change', () => {
    const original = makeTagGroups()
    const changed = original.map((group) =>
      group.id === 'group-a' ? { ...group, index: 2 } : group,
    )
    dashboardMock.tagGroups = original
    dashboardMock.originalTagGroups = original

    const { result, rerender } = renderHook(() => useIndexTouched())
    expect(result.current).toBe(false)

    dashboardMock.tagGroups = changed
    rerender()
    expect(result.current).toBe(true)

    dashboardMock.originalTagGroups = changed
    rerender()
    expect(result.current).toBe(false)
  })
})
