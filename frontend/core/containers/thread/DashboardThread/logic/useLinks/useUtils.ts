// logics for header & footer links

import { clone, filter, find, findIndex, forEach, keys, reject, remove } from 'ramda'
import { useEffect, useRef } from 'react'
import { MORE_GROUP } from '~/const/dashboard'
import { DSB_ROUTE, ROUTE } from '~/const/route'
import { groupByKey, sortByGroupIndex } from '~/helper'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import useDsbTab from '~/hooks/useDsbTab'
import type { TGroupedLinks, TLinkItem } from '~/spec'

import { EMPTY_LINK_ITEM } from '../../constant'

export type TRet = {
  getLinks: () => TLinkItem[]
  moveGroup: (group: string, opt: 'left' | 'right' | 'edge-left' | 'edge-right') => void
  reindex: (links: TLinkItem[]) => TLinkItem[]
  keepMoreGroup2EndIfNeed: () => void
  doMoveLink: (link: TLinkItem, opt: 'up' | 'down') => void
  doMoveLink2Edge: (link: TLinkItem, opt: 'top' | 'bottom') => void
  reindexGroup: (_targetLinks: TLinkItem[]) => TLinkItem[]
  emptyLinksIfNeed: (links: TLinkItem[]) => TLinkItem[]
  confirmGroupAdd: () => void
  confirmGroupUpdate: () => void
}

export default (): TRet => {
  const dsb$ = useDashboard()
  const community$ = useCommunity()
  const { mainTab } = useDsbTab()

  const storeRef = useRef(dsb$)

  useEffect(() => {
    storeRef.current = dsb$
  }, [dsb$])

  const getLinks = (): TLinkItem[] => {
    const { headerLinks, footerLinks } = storeRef.current

    return clone(mainTab !== DSB_ROUTE.FOOTER ? headerLinks : footerLinks)
  }

  const linksKey = mainTab !== DSB_ROUTE.FOOTER ? 'headerLinks' : 'footerLinks'

  const emptyLinksIfNeed = (links: TLinkItem[]): TLinkItem[] => {
    if (linksKey === 'headerLinks' && links.length === 1 && links[0].group === MORE_GROUP) {
      return []
    }

    return links
  }

  const reindex = (links: TLinkItem[]): TLinkItem[] => {
    return links.map((item, index) => ({
      ...item,
      index,
    }))
  }

  /**
   * move links actions
   */
  const doMoveLink = (link: TLinkItem, opt: 'up' | 'down'): void => {
    const links = getLinks()
    const { group } = link

    const groupLinks = filter((item: TLinkItem) => item.group === group, links)
    const restLinks = reject((item: TLinkItem) => item.group === group, links)

    const linkIndex = findIndex((item: TLinkItem) => item.index === link.index, groupLinks)

    const targetIndex = opt === 'up' ? linkIndex - 1 : linkIndex + 1

    const tmp = groupLinks[targetIndex]
    groupLinks[targetIndex] = groupLinks[linkIndex]
    groupLinks[linkIndex] = tmp

    const tmpIndex = groupLinks[targetIndex].index
    groupLinks[targetIndex].index = groupLinks[linkIndex].index
    groupLinks[linkIndex].index = tmpIndex

    dsb$.commit({
      [linksKey]: [...restLinks, ...reindex(groupLinks)],
    })
  }

  const doMoveLink2Edge = (link: TLinkItem, opt: 'top' | 'bottom'): void => {
    const links = getLinks()
    const { group } = link

    const groupLinks = filter((item: TLinkItem) => item.group === group, links)
    const restLinks = reject((item: TLinkItem) => item.group === group, links)

    const curLinkItemIndex = findIndex((item: TLinkItem) => item.index === link.index, groupLinks)
    const curLinkItem = clone(groupLinks[curLinkItemIndex])

    const newLinks =
      opt === 'top'
        ? [curLinkItem, ...remove(curLinkItemIndex, 1, groupLinks)]
        : [...remove(curLinkItemIndex, 1, groupLinks), curLinkItem]

    dsb$.commit({
      [linksKey]: [...restLinks, ...reindex(newLinks)],
    })
  }

  /**
   * move group actions
   */
  const reindexGroup = (_targetLinks: readonly TLinkItem[]): TLinkItem[] => {
    const targetLinks = clone(sortByGroupIndex(_targetLinks))

    const _groupedLinks = groupByKey(targetLinks, 'group')
    const groupKeys = keys(_groupedLinks) as string[]

    for (let i = 0; i < groupKeys.length; i += 1) {
      const gkey = groupKeys[i]

      for (let j = 0; j < targetLinks.length; j += 1) {
        if (targetLinks[j].group === gkey) {
          targetLinks[j].groupIndex = i
        }
      }
    }

    return targetLinks as TLinkItem[]
  }

  const keepMoreGroup2EndIfNeed = () => {
    if (linksKey !== 'headerLinks') return
    const links = getLinks()

    const _groupedLinks = groupByKey(links, 'group')
    const groupKeys = keys(_groupedLinks) as string[]

    const moreGroup = find((item: string) => item === MORE_GROUP, groupKeys)

    // create if no custom link exists
    if (links.length > 0 && !moreGroup) {
      const newLinkItem = {
        ...EMPTY_LINK_ITEM,
        title: '关于',
        link: `/${community$.slug}/${ROUTE.ABOUT}`,
        group: MORE_GROUP,
        // make sure the "more" group is always in the end
        groupIndex: groupKeys.length + 2,
      }

      const linksAfter = [...links, newLinkItem]

      dsb$.commit({
        headerLinks: reindexGroup(linksAfter),
      })
    } else {
      // make sure the "more" group is always in the end
      const linksAfter = links.map((item) => ({
        ...item,
        groupIndex: item.group === MORE_GROUP ? links.length + 2 : item.groupIndex,
      }))

      dsb$.commit({
        headerLinks: reindexGroup(linksAfter),
      })
    }
  }

  const confirmGroupAdd = (): void => {
    const { editingGroup } = storeRef.current

    const links = getLinks()

    const _groupedLinks = groupByKey(links, 'group')
    const groupKeys = keys(_groupedLinks) as string[]

    const newLinkItem = {
      ...EMPTY_LINK_ITEM,
      group: editingGroup,
      groupIndex: groupKeys.length,
    }

    const linksAfter = [...links, newLinkItem]

    dsb$.commit({
      editingGroup: null,
      editingLink: newLinkItem,
      [linksKey]: linksAfter,
    })

    setTimeout(keepMoreGroup2EndIfNeed, 100)
  }

  const confirmGroupUpdate = (): void => {
    const { editingGroup, editingGroupIndex } = dsb$
    const links = getLinks()

    const linksAfter = clone(links)

    for (let i = 0; i < links.length; i += 1) {
      const linkItem = links[i]

      if (linkItem.groupIndex === editingGroupIndex) {
        linksAfter[i].group = editingGroup
      }
    }

    dsb$.commit({
      editingGroup: null,
      editingGroupIndex: null,
      [linksKey]: reindexGroup(reindex(linksAfter)),
    })
  }

  const reindexByGroup = (groupKeys: string[], groupedLinks: TGroupedLinks): TGroupedLinks => {
    for (let index = 0; index < groupKeys.length; index += 1) {
      const gkey = groupKeys[index]

      groupedLinks[gkey] = groupedLinks[gkey].map((item) => ({
        ...item,
        groupIndex: index,
      }))
    }

    return groupedLinks
  }

  const moveGroup = (group: string, opt: 'left' | 'right' | 'edge-left' | 'edge-right'): void => {
    const links = getLinks()

    const _groupedLinks = groupByKey(sortByGroupIndex(links), 'group')
    const groupKeys = keys(_groupedLinks) as string[]

    const groupedLinks = reindexByGroup(groupKeys, _groupedLinks)
    const curIndex = groupedLinks[group][0].groupIndex

    let nextIndex = -1

    switch (opt) {
      case 'left': {
        nextIndex = curIndex - 1
        break
      }

      case 'right': {
        nextIndex = curIndex + 1
        break
      }

      case 'edge-left': {
        nextIndex = 0
        break
      }

      default: {
        nextIndex = groupKeys.length - 1
        break
      }
    }

    groupedLinks[group] = groupedLinks[group].map((item) => ({
      ...item,
      groupIndex: nextIndex,
    }))

    groupedLinks[groupKeys[nextIndex]] = groupedLinks[groupKeys[nextIndex]].map((item) => ({
      ...item,
      groupIndex: curIndex,
    }))

    const newLinks = []
    forEach((key) => newLinks.push(...groupedLinks[key]), groupKeys)

    dsb$.commit({ [linksKey]: newLinks })
  }

  return {
    getLinks,
    moveGroup,
    reindex,
    keepMoreGroup2EndIfNeed,
    doMoveLink,
    doMoveLink2Edge,
    reindexGroup,
    emptyLinksIfNeed,
    confirmGroupAdd,
    confirmGroupUpdate,
  }
}
