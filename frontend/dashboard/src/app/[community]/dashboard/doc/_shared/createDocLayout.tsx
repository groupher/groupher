'use client'

import type { ReactNode } from 'react'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig, TTransKey } from '~/spec'
import Portal from '~/unit/DashboardThread/Portal'

type TDocLayoutConfig = {
  path: string
  title: TTransKey
  crumbTitle: TTransKey
  desc?: TTransKey
  withDivider?: boolean
}

const seg = DSB_ROUTE.DOC

export default function createDocLayout({
  path,
  title,
  crumbTitle,
  desc,
  withDivider = false,
}: TDocLayoutConfig) {
  const crumbConfig = {
    title: 'dsb.crumb.cms',
    seg,
    toSeg: DSB_COVERS.CMS,
    children: [{ title: crumbTitle, seg: `${seg}/${path}` }],
  } satisfies TCrumbConfig

  return function DashboardDocSectionLayout({ children }: { children: ReactNode }) {
    const { t } = useTrans()
    const crumbItems = useDsbCrumbItems(crumbConfig)

    return (
      <>
        <Portal
          title={t(title)}
          desc={desc ? t(desc) : undefined}
          crumbItems={crumbItems}
          withDivider={withDivider}
        />
        {children}
      </>
    )
  }
}
