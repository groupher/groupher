'use client'

import { DSB_ROUTE } from '~/const/route'
import type { TTransKey } from '~/spec'

import createCmsSectionLayout from '../../_shared/createCmsSectionLayout'

type TDocLayoutConfig = {
  path: string
  title: TTransKey
  crumbTitle: TTransKey
  desc?: TTransKey
  hideTitle?: boolean
  withDivider?: boolean
}

const seg = DSB_ROUTE.DOC

export default function createDocLayout({
  path,
  title,
  crumbTitle,
  desc,
  hideTitle = false,
  withDivider = false,
}: TDocLayoutConfig) {
  return createCmsSectionLayout({
    crumbTitle,
    desc,
    hideTitle,
    path,
    seg,
    title,
    withDivider,
  })
}
