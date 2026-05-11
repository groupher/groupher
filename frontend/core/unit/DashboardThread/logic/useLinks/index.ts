// logics for header & footer links

import { clone, filter, find, findIndex, reject } from 'ramda'
import { useEffect, useRef } from 'react'

import { MORE_GROUP, ONE_LINK_GROUP } from '~/const/dashboard'
import { CHANGE_MODE } from '~/const/mode'
import { DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import { getAboutPath } from '~/hooks/useHeaderLinks/helper'
import type { TLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

import { EMPTY_LINK_ITEM, FIELD } from '../../constant'
import type { TMoveLinkDir } from '../../spec'
import useDerived, { type TRet as TDrived } from './useDerived'
import useUtils from './useUtils'

export type TRet = {
  resetEditingLink: () => void
  updateEditingGroup: (title: string) => void
  updateInGroup: (link: TLinkItem) => void
  add2Group: (group: string, index: number) => void
  deleteLink: (linkItem: TLinkItem) => void
  deleteGroup: (groupIndex: number) => void
  cancelLinkEditing: () => void
  confirmLinkEditing: () => void
  updateEditingLink: (key: string, value: string) => void
  //
  confirmGroupAdd: () => void
  confirmGroupUpdate: () => void
  //
  triggerGroupUpdate: (title: string, index: number) => void
  cancelGroupChange: () => void
  triggerGroupAdd: () => void
  //
  addHeaderLinkGroup: () => void
  moveAboutLink2Bottom: () => void
  moveLink: (link: TLinkItem, dir: TMoveLinkDir) => void
  //
  moveGroup2Left: (group: string) => void
  moveGroup2Right: (group: string) => void
  moveGroup2EdgeLeft: (group: string) => void
  moveGroup2EdgeRight: (group: string) => void
} & TDrived

export default function useLinks(): TRet {
  const dsb$ = useDashboard()
  const { slug: community } = useCommunity()

  const storeRef = useRef(dsb$)

  useEffect(() => {
    storeRef.current = dsb$
  }, [dsb$])

  const {
    getLinks,
    moveGroup,
    reindex,
    doMoveLink,
    doMoveLink2Edge,
    reindexGroup,
    emptyLinksIfNeed,
    confirmGroupAdd,
    confirmGroupUpdate,
    // keepMoreGroup2EndIfNeed,
  } = useUtils()

  const { mainTab } = useDsbTab()

  const derived = useDerived()

  // derived
  const linksKey = mainTab !== DSB_ROUTE.FOOTER ? FIELD.HEADER_LINKS : FIELD.FOOTER_LINKS
  const editLinks = (links: TLinkItem[]): void => {
    dsb$.editField(linksKey as typeof FIELD.FOOTER_LINKS, links)
  }

  const updateInGroup = (link: TLinkItem): void => {
    dsb$.commit({ editingLink: link, editingLinkMode: CHANGE_MODE.UPDATE })
  }

  const add2Group = (group: string, index: number): void => {
    const links = getLinks()
    const groupLinks = filter((link: TLinkItem) => link.group === group, links)

    if (groupLinks.length <= 0) return
    const { groupIndex } = groupLinks[0]

    const newItem = {
      ...EMPTY_LINK_ITEM,
      index,
      group,
      groupIndex,
    }

    editLinks([...links, newItem])
    dsb$.commit({
      editingLink: newItem,
      editingLinkMode: CHANGE_MODE.CREATE,
    })
  }

  const deleteLink = (linkItem: TLinkItem): void => {
    const links = getLinks()

    let linksAfter = reject(
      (link: TLinkItem) => link.group === linkItem.group && link.index === linkItem.index,
      links,
    )

    linksAfter = emptyLinksIfNeed(linksAfter)

    editLinks(reindex(linksAfter))
  }

  const deleteGroup = (groupIndex: number): void => {
    const links = getLinks()
    let linksAfter = reject((link: TLinkItem) => link.groupIndex === groupIndex, links)

    linksAfter = emptyLinksIfNeed(linksAfter)

    editLinks(reindexGroup(linksAfter))
  }

  const cancelLinkEditing = (): void => {
    const { editingLink, editingLinkMode, original } = dsb$
    const links = getLinks()

    if (editingLinkMode === CHANGE_MODE.UPDATE) {
      dsb$.commit({ editingLink: null })
      return
    }

    let linksAfter = reject(
      (link: TLinkItem) => link.group === editingLink.group && link.index === editingLink.index,
      links,
    )

    linksAfter = emptyLinksIfNeed(linksAfter)

    editLinks(linksAfter)
    dsb$.commit({
      editingLink: null,
      original: { ...original, [linksKey]: clone(linksAfter) },
    })
  }

  const confirmLinkEditing = (): void => {
    const { editingLink, editingLinkMode } = dsb$
    const links = getLinks()

    if (editingLinkMode === CHANGE_MODE.UPDATE) {
      const editingIndex = findIndex(
        (item: TLinkItem) => item.index === editingLink.index && item.group === editingLink.group,
        links,
      )

      links[editingIndex].title = editingLink.title
      links[editingIndex].link = editingLink.link

      editLinks(links)
      dsb$.commit({ editingLink: null })
      return
    }

    const curGroupLinks = filter((link: TLinkItem) => editingLink.group === link.group, links)

    const newAddLink = find(
      (link: TLinkItem) =>
        editingLink.group === link.group && link.index === curGroupLinks.length - 1,
      links,
    )

    const editingLinkAfter = {
      ...clone(editingLink),
      index: newAddLink.index,
      group: newAddLink.group,
      groupIndex: newAddLink.groupIndex,
    }

    const linksAfter = reject(
      (link: TLinkItem) => link.group === newAddLink.group && link.index === newAddLink.index,
      links,
    ).concat(editingLinkAfter)

    editLinks(clone(linksAfter))
    dsb$.commit({ editingLink: null })

    // setTimeout(keepMoreGroup2EndIfNeed, 100)

    if (newAddLink.group === MORE_GROUP) {
      setTimeout(moveAboutLink2Bottom, 100)
    }
  }

  const updateEditingLink = (key: string, value: string): void => {
    const { editingLink } = dsb$

    const editingLinkAfter = { ...editingLink, [key]: value }

    dsb$.commit({ editingLink: editingLinkAfter })
  }

  const resetEditingLink = (): void => {
    dsb$.commit({ editingLink: null, editingGroup: null, editingGroupIndex: null })
  }

  const updateEditingGroup = (title: string): void => {
    dsb$.commit({ editingGroup: title })
  }

  const triggerGroupUpdate = (title: string, index: number): void => {
    dsb$.commit({ editingGroup: title, editingGroupIndex: index })
  }

  const triggerGroupAdd = (): void => {
    dsb$.commit({ editingGroup: '', editingGroupIndex: null })
  }

  const cancelGroupChange = (): void => {
    dsb$.commit({ editingGroup: null, editingGroupIndex: null })
  }

  const addHeaderLinkGroup = () => {
    const time = Date.now()

    dsb$.commit({ editingGroup: `${ONE_LINK_GROUP}_${time}` })
    // TMP
    dsb$.commit({ editingLink: { title: 'hello', link: 'hello', index: 0 } })
    // TMP end
    setTimeout(confirmGroupAdd, 100)
  }

  const moveLink = (link: TLinkItem, dir: TMoveLinkDir): void => {
    switch (dir) {
      case 'up':
        doMoveLink(link, 'up')
        return
      case 'down':
        doMoveLink(link, 'down')
        return
      case 'top':
        doMoveLink2Edge(link, 'top')
        return
      case 'bottom':
        doMoveLink2Edge(link, 'bottom')
        return

      default:
    }
  }

  const moveAboutLink2Bottom = (): void => {
    if (linksKey !== FIELD.HEADER_LINKS) return

    const aboutLink = find(
      (item: TLinkItem) => item.group === MORE_GROUP && item.link === getAboutPath(community),
      dsb$[FIELD.HEADER_LINKS] as unknown as TLinkItem[],
    )

    if (!aboutLink) return

    moveLink(aboutLink, 'bottom')
  }

  const moveGroup2Left = (group: string): void => moveGroup(group, 'left')
  const moveGroup2Right = (group: string): void => moveGroup(group, 'right')

  const moveGroup2EdgeLeft = (group: string): void => moveGroup(group, 'edge-left')
  const moveGroup2EdgeRight = (group: string): void => moveGroup(group, 'edge-right')

  return {
    ...derived,
    updateInGroup,
    add2Group,
    deleteLink,
    deleteGroup,
    cancelLinkEditing,
    updateEditingLink,
    confirmLinkEditing,
    resetEditingLink,
    updateEditingGroup,
    triggerGroupUpdate,
    triggerGroupAdd,
    cancelGroupChange,
    //
    confirmGroupAdd,
    confirmGroupUpdate,
    //
    addHeaderLinkGroup,
    moveLink,
    moveAboutLink2Bottom,
    //
    moveGroup2Left,
    moveGroup2Right,
    moveGroup2EdgeLeft,
    moveGroup2EdgeRight,
  }
}
