'use client'

import { DSB_ROUTE } from '~/const/route'
import type { TTransKey } from '~/spec'

import createCmsSectionLayout from '../../_shared/createCmsSectionLayout'

type TPostLayoutConfig = {
  path: string
  title: TTransKey
  crumbTitle: TTransKey
  desc?: TTransKey
  withDivider?: boolean
}

const seg = DSB_ROUTE.POST

export default function createPostLayout({
  path,
  title,
  crumbTitle,
  desc,
  withDivider = false,
}: TPostLayoutConfig) {
  return createCmsSectionLayout({
    crumbTitle,
    desc,
    path,
    seg,
    showAdmins: true,
    title,
    withDivider,
  })
}
