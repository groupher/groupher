'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cnMerge } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'

const seg = DSB_ROUTE.FOOTER
const CRUMB_CONFIG = {
  title: 'dsb.crumb.workplace',
  seg,
  toSeg: DSB_COVERS.INTEGRATIONS,
  children: [{ title: 'dsb.crumb.footer', seg }],
} satisfies TCrumbConfig

export default function Layout({ children }) {
  const s = useSalon()
  const { t } = useTrans()

  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cnMerge(s.content, 'w-10/12 ml-20')}>
      <Portal
        title={t('dsb.portal.footer.title')}
        desc={t('dsb.portal.footer.desc')}
        withDivider={true}
        crumbItems={crumbItems}
      />

      {children}
    </div>
  )
}
