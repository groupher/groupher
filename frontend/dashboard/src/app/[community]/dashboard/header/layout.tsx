'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import Portal from '~/unit/dashboard-thread/Portal'
import useSalon, { cnMerge } from '~/unit/dashboard-thread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'

const seg = DSB_ROUTE.HEADER
const CRUMB_CONFIG = {
  title: 'dsb.crumb.workplace',
  seg,
  toSeg: DSB_COVERS.INTEGRATIONS,
  children: [{ title: 'dsb.crumb.header', seg }],
} satisfies TCrumbConfig

export default function Layout({ children }) {
  const s = useSalon()
  const { t } = useTrans()

  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cnMerge(s.content, 'w-10/12 ml-20')}>
      <Portal
        title={t('dsb.portal.header.title')}
        desc={t('dsb.portal.header.desc')}
        withDivider={true}
        crumbItems={crumbItems}
      />

      {children}
    </div>
  )
}
