import { useMemo } from 'react'
import { publicThreads } from '~/helper'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import type { TCommunityThread } from '~/spec'

import useHelper from '../useHelper'

export type TRet = {
  threads: TCommunityThread[]
  isHeaderLinksTouched: boolean
  isFooterLinksTouched: boolean
  isHeaderLayoutTouched: boolean
  isFooterLayoutTouched: boolean
}

export default (): TRet => {
  const store = useDashboard()
  const { isChanged } = useHelper()
  const community = useCommunity()

  const { editingLink, enable, nameAlias } = store

  const threads = useMemo(() => {
    // @ts-expect-error
    return publicThreads(community.threads, { enable, nameAlias })
  }, [community, enable, nameAlias])

  const isFooterLinksTouched = useMemo((): boolean => {
    return isChanged('footerLinks') && editingLink === null
  }, [editingLink, isChanged])

  const isHeaderLinksTouched = useMemo((): boolean => {
    return isChanged('headerLinks') && editingLink === null
  }, [editingLink, isChanged])

  const isHeaderLayoutTouched = isChanged('headerLayout')
  const isFooterLayoutTouched = isChanged('footerLayout')

  return {
    threads,
    isHeaderLinksTouched,
    isFooterLinksTouched,
    isHeaderLayoutTouched,
    isFooterLayoutTouched,
  }
}
