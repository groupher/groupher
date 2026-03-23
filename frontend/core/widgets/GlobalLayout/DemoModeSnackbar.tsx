'use client'

import type { FC } from 'react'
import { COLOR } from '~/const/colors'
import useTrans from '~/hooks/useTrans'
import MoreSVG from '~/icons/List'
import WarningSVG from '~/icons/Warning'
import useDashboard from '~/stores/dashboard/hooks'
import { resetDsbDemoConfig } from '~/utils/dsb-demo'
import Button from '~/widgets/Buttons/Button'
import useSalon from './salon/demo_mode_snackbar'

const DemoModeSnackbar: FC = () => {
  const s = useSalon()
  const dsb$ = useDashboard()
  const { t } = useTrans()

  const handleReset = () => {
    const snapshot = resetDsbDemoConfig()
    if (!snapshot) return

    dsb$.commit({ ...snapshot, original: snapshot })
  }

  return (
    <div className={s.wrapper} data-theme='dark'>
      <WarningSVG className={s.icon} />
      <div className={s.title}>当前自定义设置只对本地演示有效</div>
      <Button color={COLOR.PURPLE} size='tiny' className='' onClick={handleReset}>
        {t('dsb.demo.exit')}
      </Button>

      <div className={s.moreBox}>
        <MoreSVG className={s.moreIcon} />
      </div>
    </div>
  )
}

export default DemoModeSnackbar
