import { THREAD } from '~/const/thread'
import type { TTag, TTagGroup } from '~/spec'

import { applyTagSortOrder, createTagsEditorStore, tagSortOrderFromGroups } from './index'

const groups: TTagGroup[] = [
  {
    id: 'group-a',
    title: 'A',
    index: 0,
    tags: [
      { id: 'tag-a', groupId: 'group-a', title: 'A', index: 0 },
      { id: 'tag-b', groupId: 'group-a', title: 'B', index: 1 },
    ],
  },
  {
    id: 'group-b',
    title: 'B',
    index: 1,
    tags: [{ id: 'tag-c', groupId: 'group-b', title: 'C', index: 0 }],
  },
]

describe('TagsEditorStore', () => {
  it('isolates community, thread, and tag-form sessions', () => {
    const first = createTagsEditorStore('first')
    const second = createTagsEditorStore('second')
    const firstForm = first.beginTagForm('update', groups[0].tags[0] as TTag)

    first.setActiveThread(THREAD.CHANGELOG)

    expect(first.community).toBe('first')
    expect(second.community).toBe('second')
    expect(first.activeThread).toBe(THREAD.CHANGELOG)
    expect(second.activeThread).toBe(THREAD.POST)
    expect(first.tagFormDraft).toBeNull()
    expect(first.tagFormSession).not.toBe(firstForm)
  })

  it('keeps confirmed sort baselines separate by thread and preserves newer drafts', () => {
    const store = createTagsEditorStore('community')
    const postOrder = tagSortOrderFromGroups(groups)
    const changelogGroups = groups.toReversed().map((group, index) => ({ ...group, index }))
    const changelogOrder = tagSortOrderFromGroups(changelogGroups)

    store.syncConfirmedOrder(THREAD.POST, groups)
    store.syncConfirmedOrder(THREAD.CHANGELOG, changelogGroups)
    store.setSortingDraft(THREAD.POST, {
      groupIds: ['group-b', 'group-a'],
      tagIdsByGroup: { 'group-a': ['tag-b', 'tag-a'], 'group-b': ['tag-c'] },
    })

    store.reconcileSorting(THREAD.POST, postOrder, changelogOrder)

    expect(store.hasSortingChanges(THREAD.POST)).toBe(true)
    expect(store.getSortingDraft(THREAD.POST)?.groupIds).toEqual(['group-b', 'group-a'])
    expect(store.getSortingDraft(THREAD.CHANGELOG)?.groupIds).toEqual(changelogOrder.groupIds)
  })

  it('ignores a late inline-editor clear from an older session', () => {
    const store = createTagsEditorStore('community')
    const olderSession = store.beginInlineEdit(groups[0].tags[0] as TTag)
    const newerTag = { ...groups[0].tags[1], title: 'Newer draft' }
    const newerSession = store.beginInlineEdit(newerTag as TTag)

    store.clearInlineEdit(olderSession)

    expect(store.inlineEditSession).toBe(newerSession)
    expect(store.inlineTagDraft?.title).toBe('Newer draft')
  })

  it('applies stable ID order over newly confirmed group data', () => {
    const order = {
      groupIds: ['group-b', 'group-a'],
      tagIdsByGroup: { 'group-a': ['tag-b', 'tag-a'] },
    }
    const result = applyTagSortOrder(groups, order)

    expect(result.map((group) => group.id)).toEqual(['group-b', 'group-a'])
    expect(result[1].tags.map((tag) => tag.id)).toEqual(['tag-b', 'tag-a'])
    expect(result[1].title).toBe('A')
  })

  it('projects a tag move across groups without restoring it to its source group', () => {
    const order = {
      groupIds: ['group-a', 'group-b'],
      tagIdsByGroup: { 'group-a': ['tag-a'], 'group-b': ['tag-c', 'tag-b'] },
    }
    const result = applyTagSortOrder(groups, order)

    expect(result[0].tags.map((tag) => tag.id)).toEqual(['tag-a'])
    expect(result[1].tags.map((tag) => tag.id)).toEqual(['tag-c', 'tag-b'])
    expect(result[1].tags[1]).toMatchObject({ groupId: 'group-b', index: 1 })
  })
})
