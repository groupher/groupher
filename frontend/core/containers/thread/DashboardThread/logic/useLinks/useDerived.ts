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

export default function useDerived(): TRet {
  const dsb$ = useDashboard()
  const { isChanged } = useHelper()
  const community$ = useCommunity()

  const { editingLink, enable, nameAlias } = dsb$

  // console.log('## headerLinks: ', dsb$.headerLinks)
  // console.log('## headerLinks original: ', dsb$.original.headerLinks)

  const threads = useMemo(() => {
    // @ts-expect-error
    return publicThreads(community$.threads, { enable, nameAlias })
  }, [community$, enable, nameAlias])

  const isFooterLinksTouched = useMemo((): boolean => {
    return isChanged('footerLinks') && editingLink === null
  }, [editingLink, isChanged])

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const isHeaderLinksTouched = useMemo((): boolean => {
    return isChanged('headerLinks') && editingLink === null
  }, [editingLink])

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
