import type { FC, SVGProps } from 'react'

import LinkOutsideSVG from '~/icons/LinkOutside'

import useSalon from './salon/action'

type TProps = {
  title: string
  desc: string
  Icon: FC<SVGProps<SVGSVGElement>>
  external?: boolean
}

const MenuItem: FC<TProps> = ({ title, desc, Icon, external = false }) => {
  const s = useSalon()

  return (
    <button type='button' className={s.menuItem}>
      <span className={s.menuIconBox}>
        <Icon className={s.menuIcon} />
      </span>
      <span className={s.menuText}>
        <span className={s.menuTitle}>
          {title}
          {external && <LinkOutsideSVG className={s.menuExternalIcon} />}
        </span>
        <span className={s.menuDesc}>{desc}</span>
      </span>
    </button>
  )
}

export default MenuItem
