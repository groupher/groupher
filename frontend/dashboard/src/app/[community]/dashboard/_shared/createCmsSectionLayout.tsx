'use client'

import type { ReactNode } from 'react'

import { DSB_COVERS } from '~/const/route'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'
import type { TCrumbConfig, TTransKey } from '~/spec'
import AdminList from '~/unit/DashboardThread/AdminList'
import Portal from '~/unit/DashboardThread/Portal'

type TCmsSectionLayoutConfig = {
  crumbTitle: TTransKey
  desc?: TTransKey
  path: string
  seg: string
  showAdmins?: boolean
  hideTitle?: boolean
  title: TTransKey
  withDivider?: boolean
}

export default function createCmsSectionLayout({
  crumbTitle,
  desc,
  path,
  seg,
  showAdmins = false,
  hideTitle = false,
  title,
  withDivider = false,
}: TCmsSectionLayoutConfig) {
  const crumbConfig = {
    title: 'dsb.crumb.cms',
    seg,
    toSeg: DSB_COVERS.CMS,
    children: [{ title: crumbTitle, seg: `${seg}/${path}` }],
  } satisfies TCrumbConfig

  return function DashboardCmsSectionLayout({ children }: { children: ReactNode }) {
    const { t } = useTrans()
    const crumbItems = useDsbCrumbItems(crumbConfig)
    const adminList = showAdmins ? mockUsers(4) : null

    return (
      <>
        <Portal
          title={t(title)}
          desc={desc ? t(desc) : undefined}
          hideTitle={hideTitle}
          crumbItems={crumbItems}
          addon={adminList ? <AdminList userList={adminList} /> : undefined}
          withDivider={withDivider}
        />
        {children}
      </>
    )
  }
}
