import type { FC, ReactNode } from 'react'
import type { TBreadcrumbItem, TSpace } from '~/spec'
import Breadcrumbs from '~/widgets/Breadcrumbs'
import useSalon from './salon/portal'

type TProps = {
  title: string
  desc?: ReactNode
  withDivider?: boolean
  crumbItems?: TBreadcrumbItem[]
  addon?: ReactNode
  testid?: string
} & TSpace

const Portal: FC<TProps> = ({
  title,
  desc = null,
  withDivider = true,
  crumbItems = [],
  addon = null,
  testid = '',
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper}>
      {crumbItems?.length ? <Breadcrumbs items={crumbItems} /> : null}

      <div className={s.header}>
        <h3 className={s.title} data-testid={testid || undefined}>
          {title}
        </h3>
        {addon && <>{addon}</>}
      </div>

      {desc && <p className={s.desc}>{desc}</p>}
      {withDivider && <div className={s.divider} />}
    </div>
  )
}

export default Portal
