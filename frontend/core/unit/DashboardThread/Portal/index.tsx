import type { FC, ReactNode } from 'react'

import type { TBreadcrumbItem, TSpace } from '~/spec'
import useDashboardStore from '~/stores/dashboard/hooks'
import Breadcrumbs from '~/widgets/Breadcrumbs'

import useSalon from './salon'

type TProps = {
  title: string
  desc?: ReactNode
  hideTitle?: boolean
  withDivider?: boolean
  crumbItems?: TBreadcrumbItem[]
  addon?: ReactNode
  testid?: string
} & TSpace

const DEFAULT_CRUMB_ITEMS: TBreadcrumbItem[] = []

const Portal: FC<TProps> = ({
  title,
  desc = null,
  hideTitle = false,
  withDivider = true,
  crumbItems = DEFAULT_CRUMB_ITEMS,
  addon = null,
  testid = '',
  ...spacing
}) => {
  const s = useSalon({ ...spacing })
  const { submenuCollapsed } = useDashboardStore()

  return (
    <div className={s.wrapper}>
      {!submenuCollapsed && crumbItems?.length ? <Breadcrumbs items={crumbItems} /> : null}

      {!hideTitle && (
        <div className={s.header}>
          <h3 className={s.title} data-testid={testid || undefined}>
            {title}
          </h3>
          {addon}
        </div>
      )}

      {desc && <p className={s.desc}>{desc}</p>}
      {withDivider && <div className={s.divider} />}
    </div>
  )
}

export default Portal
