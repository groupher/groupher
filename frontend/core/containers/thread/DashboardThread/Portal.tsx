import type { FC, ReactNode } from 'react'
import type { TBreadcrumbItem } from '~/spec'
import Breadcrumbs from '~/widgets/Breadcrumbs'
import useSalon from './salon/portal'

type TProps = {
  title: string
  desc?: ReactNode
  withDivider?: boolean
  crumbItems?: TBreadcrumbItem[]
}

const Portal: FC<TProps> = ({ title, desc = null, withDivider = true, crumbItems = [] }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {crumbItems?.length ? <Breadcrumbs items={crumbItems} /> : null}

      <h3 className={s.title}>{title}</h3>

      {desc && <p className={s.desc}>{desc}</p>}
      {withDivider && <div className={s.divider} />}
    </div>
  )
}

export default Portal
