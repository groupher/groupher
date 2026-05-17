'use client'

import { DSB_ROUTE } from '~/const/route'
import type { TTransKey } from '~/spec'

import createCmsSectionLayout from '../../_shared/createCmsSectionLayout'

type TChangelogLayoutConfig = {
  path: string
  title: TTransKey
  crumbTitle: TTransKey
  desc?: TTransKey
  withDivider?: boolean
}

const seg = DSB_ROUTE.CHANGELOG

export default function createChangelogLayout({
  path,
  title,
  crumbTitle,
  desc,
  withDivider = false,
}: TChangelogLayoutConfig) {
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
