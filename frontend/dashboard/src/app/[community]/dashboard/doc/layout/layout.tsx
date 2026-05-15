'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import Portal from '~/unit/DashboardThread/Portal'

const seg = DSB_ROUTE.DOC
const CRUMB_CONFIG = {
  title: 'dsb.crumb.cms',
  seg,
  toSeg: DSB_COVERS.CMS,
  children: [{ title: 'dsb.crumb.doc.layout', seg: `${seg}/layout` }],
} satisfies TCrumbConfig

export default function DashboardDocLayoutPageLayout({ children }) {
  const { t } = useTrans()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <>
      <Portal title={t('dsb.doc.layout')} desc={t('dsb.layout.doc.desc')} crumbItems={crumbItems} />
      {children}
    </>
  )
}
