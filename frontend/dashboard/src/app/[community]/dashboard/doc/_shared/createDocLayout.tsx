'use client'

import type { ReactNode } from 'react'

import { DSB_ROUTE } from '~/const/route'
import type { TTransKey } from '~/spec'

import createCmsSectionLayout from '../../_shared/createCmsSectionLayout'

type TDocLayoutConfig = {
  breadcrumbAddon?: ReactNode
  path: string
  title: TTransKey
  crumbTitle: TTransKey
  desc?: TTransKey
  hideTitle?: boolean
  withBodyGap?: boolean
  withDivider?: boolean
}

const seg = DSB_ROUTE.DOC

/** Creates the dashboard layout for documentation management routes. */
export default function createDocLayout({
  breadcrumbAddon,
  path,
  title,
  crumbTitle,
  desc,
  hideTitle = false,
  withBodyGap = true,
  withDivider = false,
}: TDocLayoutConfig) {
  return createCmsSectionLayout({
    breadcrumbAddon,
    crumbTitle,
    desc,
    hideTitle,
    path,
    seg,
    title,
    withBodyGap,
    withDivider,
  })
}
