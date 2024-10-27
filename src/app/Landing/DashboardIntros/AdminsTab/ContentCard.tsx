import type { FC } from 'react'

import FingerPrintSVG from '~/icons/FingerPrintDuo'

import PermissionItems from './PermissionItems'

import useSalon from '../../salon/dashboard_intros/admins_tab/content_card'

type TProps = {
  userHover: boolean[]
}

const ContentCard: FC<TProps> = ({ userHover }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.bar} />
        <FingerPrintSVG className={s.printIcon} />
        <PermissionItems userHover={userHover} />
      </div>
    </div>
  )
}

export default ContentCard
