import { useMemo } from 'react'

import { publicThreads } from '~/helper'
import type { TCommunityThread } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../../constant'
import useHelper from '../useHelper'

export type TRet = {
  threads: TCommunityThread[]
  isHeaderLinksTouched: boolean
  isFooterLinksTouched: boolean
  isClassicLayoutTouched: boolean
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
    return isChanged(FIELD.FOOTER_LINKS) && editingLink === null
  }, [editingLink, isChanged])

  const isHeaderLinksTouched = useMemo((): boolean => {
    return isChanged(FIELD.HEADER_LINKS) && editingLink === null
  }, [editingLink])

  const isClassicLayoutTouched = isChanged(FIELD.HEADER_LAYOUT)
  const isFooterLayoutTouched = isChanged(FIELD.FOOTER_LAYOUT)

  return {
    threads,
    isHeaderLinksTouched,
    isFooterLinksTouched,
    isClassicLayoutTouched,
    isFooterLayoutTouched,
  }
}
