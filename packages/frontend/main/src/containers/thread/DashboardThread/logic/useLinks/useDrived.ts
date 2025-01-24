import { useCallback } from 'react'

import type { TCommunityThread } from '~/spec'
import { publicThreads } from '~/helper'

import useSubStore from '~/hooks/useSubStore'
import useViewingCommunity from '~/hooks/useViewingCommunity'

import useHelper from '../useHelper'

type TLinksType = 'headerLinks' | 'footerLinks'
type TLayoutType = 'headerLayout' | 'footerLayout'

export type TRet = {
  getThreads: () => TCommunityThread[]
  getIsTouched: (type?: TLinksType) => boolean
  getIsLayoutTouched: (layout?: TLayoutType) => boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged } = useHelper()
  const community = useViewingCommunity()

  const { editingLink, enable, nameAlias } = store

  const getThreads = useCallback(() => {
    return publicThreads(community.threads, { enable, nameAlias })
  }, [community, enable, nameAlias])

  const getIsTouched = useCallback(
    (type: TLinksType = 'headerLinks'): boolean => {
      return isChanged(type) && editingLink === null
    },
    [editingLink, isChanged],
  )

  const getIsLayoutTouched = useCallback(
    (layout: TLayoutType = 'headerLayout') => {
      return isChanged(layout)
    },
    [isChanged],
  )

  return {
    getThreads,
    getIsTouched,
    getIsLayoutTouched,
  }
}
