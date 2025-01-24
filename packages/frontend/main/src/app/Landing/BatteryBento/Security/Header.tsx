import type { FC } from 'react'

import MoreSVG from '~/icons/menu/MoreL'

import useSalon, { cn } from '../../salon/battery_bento/security/header'

type TProps = {
  hovering: boolean
}

const Header: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, !hovering && '-top-8')}>
      <div className={s.actions}>
        <div className={cn(s.dot, s.redBg)} />
        <div className={cn(s.dot, s.yellowBg)} />
        <div className={cn(s.dot, s.greenowBg)} />
      </div>

      <div className={s.domain}>
        <div className={s.domainText}>自定义域名</div>
      </div>

      <MoreSVG className={s.moreIcon} />
    </div>
  )
}

export default Header
