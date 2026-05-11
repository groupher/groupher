import { useAutoAnimate } from '@formkit/auto-animate/react'
import type { Dispatch, FC, SetStateAction } from 'react'
import { useMemo, useState } from 'react'

import { CHANGE_MODE } from '~/const/mode'
import { resolveHeaderLinks } from '~/hooks/useHeaderLinks/helper'
import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Plus'
import type { TChangeMode, THeaderLinkChild, THeaderLinkItem, TLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import Button from '~/widgets/Buttons/Button'

import LinkEditor from '../../Footer/Editors/LinkEditor'
import useSalon from '../../salon/header/editors'
import type { TMoveLinkDir } from '../../spec'
import FixedLinks from './FixedLinks'
import GroupHead from './GroupHead'
import GroupInputer from './GroupInputer'

type TColumn = {
  id: string
  kind: 'link' | 'group' | 'system'
  title: string
  sourceIndex: number
  links: TLinkItem[]
}

type TProps = {
  links: readonly THeaderLinkItem[]
  onChange: Dispatch<SetStateAction<readonly THeaderLinkItem[]>>
  makeId: (prefix: string) => string
}

const toLinkItem = (
  link: Pick<THeaderLinkChild, 'title' | 'url'>,
  group: string,
  groupIndex: number,
  index: number,
): TLinkItem => ({
  index,
  title: link.title,
  link: link.url,
  group,
  groupIndex,
})

const move = <T,>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

const moveTo = <T,>(items: readonly T[], from: number, dir: TMoveLinkDir): T[] => {
  if (items.length <= 1) return [...items]

  const to =
    dir === 'top' ? 0 : dir === 'bottom' ? items.length - 1 : dir === 'up' ? from - 1 : from + 1

  if (to < 0 || to >= items.length || to === from) return [...items]

  return move(items, from, to)
}

const linkCountLabel = (count: number, t: ReturnType<typeof useTrans>['t']): string =>
  `${count} ${t(
    count === 1 ? 'dsb.header.editors.link_count.one' : 'dsb.header.editors.link_count.other',
  )}`

const Editor: FC<TProps> = ({ links, makeId, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug } = useCommunity()
  const [groupAnimateRef] = useAutoAnimate()

  const [editingLink, setEditingLink] = useState<TLinkItem | null>(null)
  const [editingLinkMode, setEditingLinkMode] = useState<TChangeMode>(CHANGE_MODE.CREATE)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set())

  const columns = useMemo<TColumn[]>(() => {
    return links.flatMap<TColumn>((item, sourceIndex) => {
      if (item.type === 'LINK') {
        return [
          {
            id: item.id,
            kind: 'link',
            title: item.title,
            sourceIndex,
            links: [toLinkItem(item, item.id, sourceIndex, 0)],
          },
        ]
      }

      if (item.type === 'GROUP') {
        return [
          {
            id: item.id,
            kind: 'group',
            title: item.title,
            sourceIndex,
            links: item.links.map((link, index) => toLinkItem(link, item.id, sourceIndex, index)),
          },
        ]
      }

      return []
    })
  }, [links])

  const systemColumn = useMemo<TColumn | null>(() => {
    const systemMore = resolveHeaderLinks(links, slug).find((item) => item.type === 'system-group')

    if (!systemMore) return null

    return {
      id: systemMore.id,
      kind: 'system',
      title: systemMore.title,
      sourceIndex: links.length,
      links: systemMore.links.map((link, index) =>
        toLinkItem(link, systemMore.id, links.length, index),
      ),
    }
  }, [links, slug])

  const triggerLinkAdd = (): void => {
    const item: THeaderLinkItem = { id: makeId('link'), type: 'LINK', title: '', url: '' }

    onChange((items) => [...items, item])
    setEditingLink(toLinkItem(item, item.id, links.length, 0))
    setEditingLinkMode(CHANGE_MODE.CREATE)
  }

  const triggerGroupAdd = (): void => {
    setEditingGroup('')
    setEditingGroupIndex(null)
  }

  const cancelGroupChange = (): void => {
    setEditingGroup(null)
    setEditingGroupIndex(null)
  }

  const updateEditingGroup = (value: string): void => {
    setEditingGroup(value)
  }

  const confirmGroupAdd = (): void => {
    if (editingGroup === null) return

    const groupId = makeId('group')
    const childId = makeId('child')
    const nextGroup: THeaderLinkItem = {
      id: groupId,
      type: 'GROUP',
      title: editingGroup.trim(),
      links: [{ id: childId, title: '', url: '' }],
    }

    onChange((items) => [...items, nextGroup])
    setEditingLink(toLinkItem(nextGroup.links[0], groupId, links.length, 0))
    setEditingLinkMode(CHANGE_MODE.CREATE)
    cancelGroupChange()
  }

  const confirmGroupUpdate = (): void => {
    if (editingGroup === null || editingGroupIndex === null) return

    onChange((items) =>
      items.map((item, index) =>
        index === editingGroupIndex && item.type === 'GROUP'
          ? { ...item, title: editingGroup.trim() }
          : item,
      ),
    )
    cancelGroupChange()
  }

  const triggerGroupUpdate = (title: string, index: number): void => {
    setEditingGroup(title)
    setEditingGroupIndex(index)
  }

  const add2Group = (groupId: string, groupIndex: number): void => {
    const child = { id: makeId('child'), title: '', url: '' }

    onChange((items) =>
      items.map((item) => {
        if (item.id !== groupId || item.type !== 'GROUP') return item
        return { ...item, links: [...item.links, child] }
      }),
    )

    const group = links.find((item) => item.id === groupId && item.type === 'GROUP')
    setEditingLink(toLinkItem(child, groupId, groupIndex, group?.links.length ?? 0))
    setEditingLinkMode(CHANGE_MODE.CREATE)
  }

  const updateEditingLink = (key: string, value: string): void => {
    if (!editingLink || (key !== 'title' && key !== 'link')) return
    setEditingLink({ ...editingLink, [key]: value })
  }

  const updateInGroup = (linkItem: TLinkItem): void => {
    setEditingLink(linkItem)
    setEditingLinkMode(CHANGE_MODE.UPDATE)
  }

  const confirmLinkEditing = (): void => {
    if (!editingLink?.group) return

    onChange((items) =>
      items.map((item) => {
        if (item.id !== editingLink.group) return item

        if (item.type === 'LINK') {
          return { ...item, title: editingLink.title, url: editingLink.link || '' }
        }

        return {
          ...item,
          links: item.links.map((link, index) =>
            index === editingLink.index
              ? { ...link, title: editingLink.title, url: editingLink.link || '' }
              : link,
          ),
        }
      }),
    )
    setEditingLink(null)
  }

  const deleteLink = (linkItem: TLinkItem): void => {
    if (!linkItem.group) return

    onChange((items) =>
      items.flatMap((item) => {
        if (item.id !== linkItem.group) return [item]
        if (item.type === 'LINK') return []

        return [
          {
            ...item,
            links: item.links.filter((_, index) => index !== linkItem.index),
          },
        ]
      }),
    )

    if (editingLink?.group === linkItem.group && editingLink.index === linkItem.index) {
      setEditingLink(null)
    }
  }

  const cancelLinkEditing = (): void => {
    if (editingLinkMode === CHANGE_MODE.CREATE && editingLink) {
      deleteLink(editingLink)
    }

    setEditingLink(null)
  }

  const moveLink = (linkItem: TLinkItem, dir: TMoveLinkDir): void => {
    if (!linkItem.group) return

    onChange((items) =>
      items.map((item) => {
        if (item.id !== linkItem.group || item.type !== 'GROUP') return item

        return {
          ...item,
          links: moveTo(item.links, linkItem.index, dir),
        }
      }),
    )
  }

  const moveGroup = (from: number, dir: TMoveLinkDir): void => {
    onChange((items) => moveTo(items, from, dir))
  }

  const deleteGroup = (index: number): void => {
    onChange((items) => items.filter((_, itemIndex) => itemIndex !== index))
  }

  const toggleGroup = (id: string): void => {
    setCollapsedGroups((groups) => {
      const next = new Set(groups)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  const saveGroup = editingGroupIndex === null ? confirmGroupAdd : confirmGroupUpdate
  const isAboutLinkFold = links.length > 0

  return (
    <div className={s.wrapper}>
      <div className={s.topWrapper}>
        <div className={s.leftPart}>
          <FixedLinks isAboutLinkFold={isAboutLinkFold} />
        </div>
        <ul className={s.rightPart}>
          <h3 className={s.noteTitle}>{t('dsb.header.editors.note.title')}</h3>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.fixed')}</li>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.about')}</li>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.preview')}</li>
        </ul>
      </div>

      <div className={s.divider} />

      <div className={s.adder}>
        <Button size='small' onClick={triggerLinkAdd} space={0.5} ghost noBorder>
          <PlusSVG className={s.plusIcon} />
          {t('dsb.header.editors.link')}
        </Button>
        <div className={s.slash}>/</div>
        <Button size='small' onClick={triggerGroupAdd} space={0.5} ghost noBorder>
          <PlusSVG className={s.plusIcon} />
          {t('dsb.header.editors.group')}
        </Button>
      </div>

      {editingGroup !== null && editingGroupIndex === null && (
        <div className={s.groupInputer}>
          <GroupInputer
            value={editingGroup}
            onChange={updateEditingGroup}
            onConfirm={saveGroup}
            onCancel={cancelGroupChange}
          />
        </div>
      )}

      <div className={s.linkGroup} ref={groupAnimateRef}>
        {[...columns, ...(systemColumn ? [systemColumn] : [])].map((column) => {
          const isSystem = column.kind === 'system'
          const isSingleLink = column.kind === 'link'
          const isLastCustom = column.sourceIndex === links.length - 1
          const isCollapsible = column.kind === 'group' || column.kind === 'system'
          const isCollapsed = isCollapsible && collapsedGroups.has(column.id)
          const isEmptyGroup = column.kind === 'group' && column.links.length === 0

          return (
            <div className={s.columnWrapper} key={column.id}>
              <GroupHead
                title={column.title}
                kind={column.kind}
                curGroupIndex={column.sourceIndex}
                isEdgeLeft={column.sourceIndex === 0}
                isEdgeRight={isLastCustom}
                moveLeft={() => moveGroup(column.sourceIndex, 'up')}
                moveRight={() => moveGroup(column.sourceIndex, 'down')}
                moveEdgeLeft={() => moveGroup(column.sourceIndex, 'top')}
                moveEdgeRight={() => moveGroup(column.sourceIndex, 'bottom')}
                onDelete={() => deleteGroup(column.sourceIndex)}
                collapsed={isCollapsed}
                onToggle={isCollapsible ? () => toggleGroup(column.id) : undefined}
                editingGroup={editingGroup}
                editingGroupIndex={editingGroupIndex}
                triggerGroupUpdate={triggerGroupUpdate}
                cancelGroupChange={cancelGroupChange}
                updateEditingGroup={updateEditingGroup}
                confirmGroupUpdate={confirmGroupUpdate}
              />

              <div className={s.itemsWrapper}>
                {isEmptyGroup ? (
                  <div className={s.noLinks}>{t('dsb.header.editors.no_links_in_group')}</div>
                ) : isCollapsed ? (
                  <div className={s.linksCount}>{linkCountLabel(column.links.length, t)}</div>
                ) : (
                  column.links.map((linkItem, index) => (
                    <LinkEditor
                      key={`${column.id}-${index}`}
                      linkItem={linkItem}
                      editingLink={editingLink}
                      mode={editingLinkMode}
                      isFirst={isSingleLink || index === 0}
                      isLast={isSingleLink || index === column.links.length - 1}
                      disableSetting={isSystem || isSingleLink}
                      disableEdit={isSystem}
                      compact
                      actions={{
                        cancelLinkEditing,
                        deleteLink,
                        updateEditingLink,
                        confirmLinkEditing,
                        updateInGroup,
                        moveLink,
                      }}
                    />
                  ))
                )}

                {!isSystem && !isSingleLink && !isCollapsed && (
                  <div className={s.addLinkRow}>
                    <Button
                      size='small'
                      onClick={() => add2Group(column.id, column.sourceIndex)}
                      space={2}
                      ghost
                      noBorder
                      left={-1.5}
                    >
                      <PlusSVG className={s.plusIcon} />
                      {t('dsb.header.editors.link')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Editor
