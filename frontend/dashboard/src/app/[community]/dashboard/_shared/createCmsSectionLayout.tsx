'use client'

import type { ReactNode } from 'react'

import { DSB_COVERS } from '~/const/route'
import { cn } from '~/css'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'
import type { TCrumbConfig, TTransKey } from '~/spec'
import useDashboardStore from '~/stores/dashboard/hooks'
import AdminList from '~/unit/DashboardThread/AdminList'
import Portal from '~/unit/DashboardThread/Portal'

type TCmsSectionLayoutConfig = {
  breadcrumbAddon?: ReactNode
  crumbTitle: TTransKey
  desc?: TTransKey
  path: string
  seg: string
  showAdmins?: boolean
  hideTitle?: boolean
  title: TTransKey
  withBodyGap?: boolean
  withDivider?: boolean
}

const SECTION_BODY_GAP = 'mt-5'

export default function createCmsSectionLayout({
  breadcrumbAddon,
  crumbTitle,
  desc,
  path,
  seg,
  showAdmins = false,
  hideTitle = false,
  title,
  withBodyGap = true,
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
    const { submenuCollapsed } = useDashboardStore()
    const adminList = showAdmins ? mockUsers(4) : null
    const hasBreadcrumbs = !submenuCollapsed && crumbItems.length > 0
    const visibleBreadcrumbAddon = hasBreadcrumbs ? breadcrumbAddon : undefined
    const hasPortalContent =
      hasBreadcrumbs || !!visibleBreadcrumbAddon || !hideTitle || !!desc || withDivider
    const sectionBodyClass = cn(
      'w-full',
      withBodyGap && hasPortalContent && !withDivider && SECTION_BODY_GAP,
    )

    return (
      <>
        {hasPortalContent && (
          <Portal
            title={t(title)}
            desc={desc ? t(desc) : undefined}
            hideTitle={hideTitle}
            crumbItems={crumbItems}
            breadcrumbAddon={visibleBreadcrumbAddon}
            addon={adminList ? <AdminList userList={adminList} /> : undefined}
            withDivider={withDivider}
          />
        )}
        <div className={sectionBodyClass}>{children}</div>
      </>
    )
  }
}
