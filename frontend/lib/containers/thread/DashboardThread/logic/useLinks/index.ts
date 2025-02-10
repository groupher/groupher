// logics for header & footer links
import { useEffect, useRef } from 'react'
import { find, findIndex, filter, reject, clone } from 'ramda'

import { ONE_LINK_GROUP, MORE_GROUP } from '~/const/dashboard'
import { DASHBOARD_ROUTE } from '~/const/route'
import { CHANGE_MODE } from '~/const/mode'

import type { TLinkItem } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

import type { TMoveLinkDir } from '../../spec'
import { EMPTY_LINK_ITEM } from '../../constant'

import useUtils from './useUtils'
import useDrived, { type TRet as TDrived } from './useDrived'

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

export default (): TRet => {
  const store = useSubStore('dashboard')

  const storeRef = useRef(store)

  useEffect(() => {
    storeRef.current = store
  }, [store])

  const {
    getLinks,
    moveGroup,
    reindex,
    doMoveLink,
    doMoveLink2Edge,
    reindexGroup,
    emptyLinksIfNedd,
    confirmGroupAdd,
    confirmGroupUpdate,
    // keepMoreGroup2EndIfNeed,
  } = useUtils()
  const drived = useDrived()

  const { curTab } = store
  const linksKey = curTab !== DASHBOARD_ROUTE.FOOTER ? 'headerLinks' : 'footerLinks'

  const updateInGroup = (link: TLinkItem): void => {
    store.commit({ editingLink: link, editingLinkMode: CHANGE_MODE.UPDATE })
  }

  const add2Group = (group: string, index: number): void => {
    const links = getLinks()
    const grouplinks = filter((link: TLinkItem) => link.group === group, links)

    if (grouplinks.length <= 0) return
    const { groupIndex } = grouplinks[0]

    const newItem = {
      ...EMPTY_LINK_ITEM,
      index,
      group,
      groupIndex,
    }

    store.commit({
      [linksKey]: [...links, newItem],
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

    linksAfter = emptyLinksIfNedd(linksAfter)

    store.commit({
      [linksKey]: reindex(linksAfter),
    })
  }

  const deleteGroup = (groupIndex: number): void => {
    const links = getLinks()
    let linksAfter = reject((link: TLinkItem) => link.groupIndex === groupIndex, links)

    linksAfter = emptyLinksIfNedd(linksAfter)

    store.commit({
      [linksKey]: reindexGroup(linksAfter),
    })
  }

  const cancelLinkEditing = (): void => {
    const { editingLink, editingLinkMode, original } = store
    const links = getLinks()

    if (editingLinkMode === CHANGE_MODE.UPDATE) {
      store.commit({ editingLink: null })
      return
    }

    let linksAfter = reject(
      (link: TLinkItem) => link.group === editingLink.group && link.index === editingLink.index,
      links,
    )

    linksAfter = emptyLinksIfNedd(linksAfter)

    store.commit({
      [linksKey]: linksAfter,
      editingLink: null,
      original: { ...original, [linksKey]: linksAfter },
    })
  }

  const confirmLinkEditing = (): void => {
    const { editingLink, editingLinkMode } = store
    const links = getLinks()

    if (editingLinkMode === CHANGE_MODE.UPDATE) {
      const editingIndex = findIndex(
        (item: TLinkItem) => item.index === editingLink.index && item.group === editingLink.group,
        links,
      )

      links[editingIndex].title = editingLink.title
      links[editingIndex].link = editingLink.link

      store.commit({
        [linksKey]: links,
        editingLink: null,
      })
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

    store.commit({
      [linksKey]: clone(linksAfter),
      editingLink: null,
    })

    // setTimeout(keepMoreGroup2EndIfNeed, 100)

    if (newAddLink.group === MORE_GROUP) {
      setTimeout(moveAboutLink2Bottom, 100)
    }
  }

  const updateEditingLink = (key: string, value: string): void => {
    const { editingLink } = store

    const editingLinkAfter = { ...editingLink, [key]: value }

    store.commit({ editingLink: editingLinkAfter })
  }

  const resetEditingLink = (): void => {
    store.commit({ editingLink: null, editingGroup: null, editingGroupIndex: null })
  }

  const updateEditingGroup = (title: string): void => {
    store.commit({ editingGroup: title })
  }

  const triggerGroupUpdate = (title: string, index: number): void => {
    store.commit({ editingGroup: title, editingGroupIndex: index })
  }

  const triggerGroupAdd = (): void => {
    store.commit({ editingGroup: '', editingGroupIndex: null })
  }

  const cancelGroupChange = (): void => {
    store.commit({ editingGroup: null, editingGroupIndex: null })
  }

  const addHeaderLinkGroup = () => {
    const time = new Date().getTime()

    store.commit({ editingGroup: `${ONE_LINK_GROUP}_${time}` })
    // TMP
    store.commit({ editingLink: { title: 'hello', link: 'hello', index: 0 } })
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
    if (linksKey !== 'headerLinks') return

    const aboutLink = find(
      (item: TLinkItem) => item.group === MORE_GROUP && item.title === '关于',
      store.headerLinks,
    )

    moveLink(aboutLink, 'bottom')
  }

  const moveGroup2Left = (group: string): void => moveGroup(group, 'left')
  const moveGroup2Right = (group: string): void => moveGroup(group, 'right')

  const moveGroup2EdgeLeft = (group: string): void => moveGroup(group, 'edge-left')
  const moveGroup2EdgeRight = (group: string): void => moveGroup(group, 'edge-right')

  return {
    ...drived,
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
