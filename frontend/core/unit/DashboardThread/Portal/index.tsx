import type { FC, ReactNode } from 'react'

import type { TBreadcrumbItem, TSpace } from '~/spec'
import useDashboardStore from '~/stores/dashboard/hooks'
import Breadcrumbs from '~/ui/Breadcrumbs'

import useSalon from './salon'

type TProps = {
  title: string
  desc?: ReactNode
  hideTitle?: boolean
  withDivider?: boolean
  addonAlign?: 'center' | 'edges'
  crumbItems?: TBreadcrumbItem[]
  breadcrumbAddon?: ReactNode
  addon?: ReactNode
  testid?: string
} & TSpace

const DEFAULT_CRUMB_ITEMS: TBreadcrumbItem[] = []

const Portal: FC<TProps> = ({
  title,
  desc = null,
  hideTitle = false,
  withDivider = true,
  addonAlign = 'center',
  crumbItems = DEFAULT_CRUMB_ITEMS,
  breadcrumbAddon = null,
  addon = null,
  testid = '',
  ...spacing
}) => {
  const s = useSalon({ ...spacing, addonAlign })
  const { submenuCollapsed } = useDashboardStore()
  const showBreadcrumbs = !submenuCollapsed && crumbItems.length > 0

  return (
    <div className={s.wrapper}>
      {(showBreadcrumbs || breadcrumbAddon) && (
        <div className={s.breadcrumbRow}>
          {showBreadcrumbs ? (
            <div className={s.breadcrumbs}>
              <Breadcrumbs items={crumbItems} bottom={0} />
            </div>
          ) : (
            <span />
          )}
          {breadcrumbAddon}
        </div>
      )}

      {(!hideTitle || desc || addon) && (
        <div className={s.body}>
          {!hideTitle && (
            <div className={s.header}>
              <h3 className={s.title} data-testid={testid || undefined}>
                {title}
              </h3>
            </div>
          )}

          {desc && <p className={s.desc}>{desc}</p>}
          {addon && <div className={s.addon}>{addon}</div>}
        </div>
      )}

      {withDivider && <div className={s.divider} />}
    </div>
  )
}

export default Portal
