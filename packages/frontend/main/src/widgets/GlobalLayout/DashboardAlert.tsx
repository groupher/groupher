import type { FC } from 'react'
import Link from 'next/link'

import WarningSVG from '~/icons/Warning'

import useSalon from './salon/dashboard_alert'
// import { clearDemoSetting } from './logic'

const DashboardAlert: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <WarningSVG className={s.icon} />
      <div className={s.title}>当前自定义设置只对本地演示有效</div>
      <button
        className={s.resetBtn}
        onClick={() => {
          console.log('## ## clearDemoSetting')

          // clearDemoSetting()
        }}
      >
        恢复默认
      </button>
      <Link className={s.more} href="/">
        了解更多
      </Link>
    </div>
  )
}

export default DashboardAlert
