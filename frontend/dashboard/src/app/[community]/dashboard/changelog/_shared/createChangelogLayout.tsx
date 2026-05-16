'use client'

import type { ReactNode } from 'react'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'
import type { TCrumbConfig, TTransKey } from '~/spec'
import AdminList from '~/unit/DashboardThread/AdminList'
import Portal from '~/unit/DashboardThread/Portal'

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
  const crumbConfig = {
    title: 'dsb.crumb.cms',
    seg,
    toSeg: DSB_COVERS.CMS,
    children: [{ title: crumbTitle, seg: `${seg}/${path}` }],
  } satisfies TCrumbConfig

  return function DashboardChangelogSectionLayout({ children }: { children: ReactNode }) {
    const { t } = useTrans()
    const crumbItems = useDsbCrumbItems(crumbConfig)
    const adminList = mockUsers(4)

    return (
      <>
        <Portal
          title={t(title)}
          desc={desc ? t(desc) : undefined}
          crumbItems={crumbItems}
          addon={<AdminList userList={adminList} />}
          withDivider={withDivider}
        />
        {children}
      </>
    )
  }
}
